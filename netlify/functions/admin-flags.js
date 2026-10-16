// netlify/functions/admin-flags.js
//
// Admin-only endpoint for reviewing flagged data-plate scans.
// Requires ADMIN_PASSCODE (separate from the regular SITE_PASSCODE techs use,
// since flagged scans may include photos of customer equipment that only
// Eddie/L&D should be reviewing, not every tech with the field-tool passcode).
//
// POST { action: "list", passcode }              -> { flags: [...] }
// POST { action: "resolve", passcode, id }        -> { ok: true }
// POST { action: "delete", passcode, id }         -> { ok: true }

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

  const adminPasscode = process.env.ADMIN_PASSCODE;
  if (!adminPasscode) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Server is missing ADMIN_PASSCODE. Set it in Netlify site settings." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Bad JSON" }) };
  }

  const { action, passcode, id } = body;

  if (passcode !== adminPasscode) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "wrong_passcode" }) };
  }

  const store = getStore("flagged-plates");

  try {
    if (action === "list") {
      const { blobs } = await store.list();
      const flags = [];
      for (const b of blobs) {
        const record = await store.get(b.key, { type: "json" });
        if (record) flags.push(record);
      }
      flags.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return { statusCode: 200, headers: cors, body: JSON.stringify({ flags }) };
    }

    if (action === "resolve") {
      if (!id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing id" }) };
      const record = await store.get(id, { type: "json" });
      if (!record) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Not found" }) };
      record.resolved = true;
      await store.setJSON(id, record);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    if (action === "delete") {
      if (!id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing id" }) };
      await store.delete(id);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Unknown action" }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Server error: " + e.message }) };
  }
};
