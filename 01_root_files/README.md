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

## What's new in this update

1. **Text-first manual index, image as supporting evidence.** Each entry now leads
   with a clean written summary (brand, model, serial, and what the page actually
   shows/says) instead of just a photo of a book page. A small thumbnail and a
   "View original page" button are still there if you want to see the real photo —
   tap either one to open it full-screen with pinch/scroll zoom and drag-to-pan.
2. **Flagging for plates we don't recognize.** When the data-plate reader can't
   find a matching entry for a scanned brand/model, it now offers a "Flag for Eddie
   to add" button. Flagged scans (brand/model/serial, plus a small photo if one was
   taken) are saved so you can review and add them to the index later.
3. **An Admin panel** (link at the bottom of the page) lists everything flagged,
   lets you view the photo full-size, and mark each one resolved or delete it once
   you've acted on it.

### One more env variable, and one more setup step

Because of items 2 and 3 above, there are two small additions to the setup from before:

- **A new environment variable**: `ADMIN_PASSCODE` — a *separate* passcode from
  `SITE_PASSCODE`, since flagged scans may include photos of customer equipment that
  only you (not every tech with the regular passcode) should be reviewing. Add it
  the same way as the others: Netlify dashboard → Site configuration →
  Environment variables.
- **Netlify Blobs** (the storage for flagged scans) is built into every Netlify
  site automatically — nothing to sign up for separately. But it does mean this
  site now has a real dependency (`@netlify/blobs`, declared in `package.json`),
  so **deploy via the GitHub-connected method, not plain drag-and-drop** — Netlify's
  build step needs to run `npm install` to pull that dependency in, which only
  happens on a proper build, not a static file upload.

After adding `ADMIN_PASSCODE`, redeploy once (Deploys → Trigger deploy) so the function
picks it up, same as with the other environment variables.

## Real manual photos — now included, with permission

Russell at Heat Exchanger Experts gave the OK to use the manual's own photos in this
internal field tool. This version goes further than a photo per page: every individual
finding photo was cropped out of its page, paired with its own caption copied from the
book, and tagged by chamber type and finding type for cross-brand lookup.

- **`images/findings/`** — 511 individually cropped photos (eyelets, weld seams, cracks,
  corrosion, etc.), each matched to the real caption text from the manual.
- **`images/originals/`** — 89 full-page reference photos, one per source page-spread,
  used only by the "View original page(s)" link on each entry.

The data driving all of this is the `FINDINGS` array near the top of `index.html`'s
`<script>` block. Each entry looks like:

```js
{
  pages: "36–37", title: "...", brand: "...", model: "...", serial: "...",
  chamberTags: ["clamshell"], issueTags: ["corrosion-condensation"],
  groups: [
    { images: ["images/findings/036-037_xyz.jpg"], caption: "Caption copied from the book." }
  ],
  note: "...",
  originalPage: "images/originals/20260928_000033889.jpg"
}
```

A `groups` entry can hold more than one image when the book shows several photos under
one caption (e.g. three fold-crack close-ups described together) — all of them render
side by side with the one caption beneath.

**Chamber-type and finding-type filters** sit above the manual index results (Clamshell /
Serpentine / Tubular / Drum-Gravity / Horizontal, and Eyelet / Weld Seam /
Corrosion-Condensation / Install Error / Recall / CO Reading / Secondary-Collector-Box /
Unsafe Tag / Technique-Tool) — these read `chamberTags` and `issueTags` on each entry, so
a tech can pull up "every eyelet failure across every brand" instead of browsing one
brand at a time. The two filters and the text search all combine (AND, not OR).

Three places in the tool now use this data:
- **The manual index panel** — grouped photos with captions, filterable by chamber/finding type.
- **The data-plate reader** — after it reads a brand/model off a nameplate, it checks for
  a matching finding and shows the first photo from that entry alongside the written info.
- **Ask HEX** — the context sent to Claude now includes each entry's note and captions,
  not just a one-line summary.

To add a new finding later: crop the photo, caption it from the source, add it to a
`groups` array (new or existing entry), and add the relevant tags to `chamberTags` /
`issueTags` if they're not already covered by that entry.

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
- Manual index / findings: edit the `FINDINGS` array (and `CHAMBER_FILTERS` / `ISSUE_FILTERS`
  for the filter pills), a bit further down.
- Model used for API calls: `MODEL` constant at the top of `netlify/functions/claude.js`
  (currently `claude-sonnet-4-6`).
