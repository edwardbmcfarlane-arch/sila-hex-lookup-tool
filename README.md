# HEX Field Lookup — Netlify + Your Own Anthropic API Key

This is the AI-powered version of the field lookup tool: same search, data-plate reader,
codes-by-location, and the new "Ask HEX" question box — but instead of running on Claude's
own hosting, it runs on **your own Netlify site, using your own Anthropic API key.**

## Why there's a serverless function involved

A static site's JavaScript is fully visible to anyone who opens the page — view-source,
browser dev tools, all of it. If your Anthropic API key were pasted directly into `index.html`,
anyone who visited the site could copy it out and run up charges on your account. There is no
safe way to put a real secret key into client-side code.

So the key lives **only** in `netlify/functions/claude.js`, read from a Netlify environment
variable at request time. The page never sees it — it just calls your own site's
`/.netlify/functions/claude` endpoint, and that function calls Anthropic on the page's behalf.

## What's in this folder

```
index.html                     <- the tool itself (search, plate reader, codes, Ask HEX)
netlify.toml                   <- tells Netlify where the function lives
netlify/functions/claude.js    <- the only place your API key is used
```

## Setup (one time)

1. **Get an Anthropic API key** at console.anthropic.com if you don't already have one for
   this purpose. Treat it like a password.

2. **Deploy this folder to Netlify.** Two ways:
   - **Git-connected (recommended):** push this folder to a GitHub repo, then in Netlify
     choose "Add new site" → "Import an existing project" → connect the repo. Netlify will
     detect `netlify.toml` automatically and deploy both the site and the function.
   - **Netlify CLI:** from inside this folder, run `netlify deploy --prod` (requires
     `npm install -g netlify-cli` and `netlify login` first).

3. **Set your environment variables** in the Netlify dashboard: Site settings → Environment
   variables → Add a variable.
   - `ANTHROPIC_API_KEY` — your real key. **Never commit this to git, never put it in
     index.html.**
   - `SITE_PASSCODE` — pick a passphrase (e.g. a word your team will recognize). This is a
     **light speed-bump, not real security** — see the warning below. Every tech who uses the
     tool enters it once and their browser remembers it.

4. **Redeploy** after setting the environment variables (Netlify → Deploys → Trigger deploy),
   since functions only pick up new env vars on a fresh deploy.

5. Open your Netlify URL, enter the passcode when prompted, and try it — search, the plate
   reader, codes lookup, and Ask HEX should all work.

## Important: this is not full authentication

`SITE_PASSCODE` stops casual/accidental traffic from hitting your function and spending your
API budget — it does **not** stop someone who has the passcode (or who inspects the network
traffic while using the tool) from calling the function directly, as many times as they want.
If you need real access control — logins, per-user limits, usage caps — that's a further step
up from what's built here. Two easy things worth doing regardless:

- **Set a budget alert** on your Anthropic account so you're notified if usage spikes
  unexpectedly.
- **Rotate `SITE_PASSCODE`** if you ever suspect it's leaked outside your team, and redeploy.

## What still isn't reproduced here

The manual index panel, recall list, and reference data all point to pages, brands, and
models — none of it reproduces the Heat Exchanger Experts manual's actual text or photos.
That boundary doesn't change with the hosting setup. The "Ask HEX" panel is explicitly told
to answer only from this same reference data, and to say plainly when something isn't in
scope rather than guess — same rule, same honesty, just running on your own infrastructure now.

## Customizing

- Brand/model reference data: edit the `ENTRIES` array near the top of the `<script>` block
  in `index.html`.
- State codes/CO laws: edit `STATE_REGS`.
- Manual index: edit `MANUAL_INDEX`, `MANUAL_RECALLS`, etc., a bit further down.
- Model used for API calls: `MODEL` constant at the top of `netlify/functions/claude.js`
  (currently `claude-sonnet-4-6`).
