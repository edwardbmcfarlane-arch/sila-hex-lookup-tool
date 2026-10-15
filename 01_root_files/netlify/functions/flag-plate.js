// netlify/functions/flag-plate.js
//
// Called by the page whenever a tech scans a data plate the tool doesn't
// recognize. Saves it to a Netlify Blobs store ("flagged-plates") so Eddie
// can review and add it to the index later, without needing any separate
// database or signup — Netlify Blobs comes with the Netlify account itself.

const { getStore } = require("@netlify/blobs");

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

  const expectedPasscode = process.env.SITE_PASSCODE;

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Bad JSON" }) };
  }

  const { passcode, brand, model, serial, note, photo, photo_media_type } = body;

  if (expectedPasscode && passcode !== expectedPasscode) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "wrong_passcode" }) };
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    createdAt: new Date().toISOString(),
    brand: brand || "",
    model: model || "",
    serial: serial || "",
    note: note || "",
    photo: photo || null, // base64, already downscaled client-side
    photo_media_type: photo_media_type || "image/jpeg",
    resolved: false,
  };

  try {
    const store = getStore("flagged-plates");
    await store.setJSON(id, record);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, id }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Failed to save: " + e.message }) };
  }
};
