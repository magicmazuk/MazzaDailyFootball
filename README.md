# MazzaDailyFootball

A personal, ad-free football app for Scottish and English club football —
fixtures, results, live scores, tables, squads — in a quality-newspaper
design language. React learning project.

**Stack:** Vite · React 19 · Tailwind · React Router · TanStack Query ·
Zustand, deployed on Vercel. Two serverless functions proxy the public
ESPN and BBC JSON feeds with edge caching. **No API keys, no accounts,
no cost.**

## Run it

    npm install
    npm run dev        # http://localhost:5173 — /api/* works via the dev shim
    npm run test:run   # full test suite
    npm run build      # production build

## Deploy

Push to GitHub, import the repo at vercel.com — no environment variables
needed. `vercel.json` maps `/api/espn/*` to the proxy and everything else
to the SPA.

## Where things live

- `api/` — the two proxies (allowlist + edge cache + last-known-good)
- `src/domain/` — competition registry, computed tables, form, monograms
- `src/data/` — source adapters (ESPN, BBC) and query hooks
- `src/features/` — one folder per screen
- `docs/superpowers/specs/` — the design spec this app implements

Data quirks worth knowing before touching `src/data/`: see spec §3.5
(the User-Agent trap, "Away at Home", round slugs, error bodies).

## TV listings (curated)

The "on TV" badges read `src/data/tvListings.json`. When broadcasters
announce picks, add one object per televised match to `listings`:

    { "comp": "sco.1", "date": "2026-08-22", "home": "St Mirren", "tv": ["Sky Sports"] }

`comp` is the competition id from `src/domain/competitions.js`; `home` is
case/punctuation-insensitive; channels are: Sky Sports, TNT Sports, BBC,
ITV, Amazon Prime, Premier Sports. Commit and push — Vercel redeploys automatically.

## Match video (the one API key)

A finished fixture's match room can show a YouTube highlights card — the
app's only API key, and it's necessarily client-side (browsers can't keep
a secret from their own network tab). The key is:

- **Locally:** `VITE_YOUTUBE_API_KEY` in `.env.local` (gitignored — never
  commit it).
- **On Vercel:** the same name, `VITE_YOUTUBE_API_KEY`, set as a project
  environment variable.
- **Locked down:** in Google Cloud Console, restrict the key's allowed
  HTTP referrers to `https://mazza-daily-football.vercel.app/*` (plus
  `http://localhost:5173/*` for local dev if you want the card to work
  there too) so it's useless if scraped from a page source.

Without a key set, the app behaves exactly as if no highlights exist —
the video card simply never appears. Nothing else about the app depends
on this key; every other data source goes through the two proxies above.
