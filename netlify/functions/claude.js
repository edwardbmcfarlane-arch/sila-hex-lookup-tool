// netlify/functions/claude.js
//
// Server-side proxy to the Anthropic API. This is the ONLY place the API key
// ever lives — it reads it from an environment variable (set in the Netlify
// dashboard, never committed to code, never sent to the browser).
//
// The page calls this function instead of calling api.anthropic.com directly.
//
// Required Netlify environment variables (Site settings -> Environment variables):
//   ANTHROPIC_API_KEY  - your real Anthropic API key
//   SITE_PASSCODE      - a shared passphrase techs enter once (stored in their
//                        browser's localStorage after that). This is a light
//                        speed-bump against random internet traffic hitting your
//                        function and spending your API budget — it is NOT real
//                        authentication. Anyone with the passphrase can use it.
//                        Rotate it if it leaks, and keep an eye on API usage.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "POST only" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const expectedPasscode = process.env.SITE_PASSCODE;

  if (!apiKey) {
    return {
      statusCode: 500, headers: cors,
      body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. Set it in Netlify site settings." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Bad JSON in request body" }) };
  }

  const { prompt, images, passcode, max_tokens } = body;

  if (expectedPasscode && passcode !== expectedPasscode) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "wrong_passcode" }) };
  }
  if (!prompt || typeof prompt !== "string") {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing 'prompt' string" }) };
  }

  // Build the user content block: optional image(s) first, then the text prompt.
  const content = [];
  if (Array.isArray(images)) {
    for (const img of images.slice(0, 4)) {
      if (!img || !img.data || !img.media_type) continue;
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.data },
      });
    }
  }
  content.push({ type: "text", text: prompt });

  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: max_tokens || 1000,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status, headers: cors,
        body: JSON.stringify({ error: data?.error?.message || "Anthropic API error" }),
      };
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return { statusCode: 200, headers: cors, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: "Failed to reach Anthropic API: " + e.message }) };
  }
};
