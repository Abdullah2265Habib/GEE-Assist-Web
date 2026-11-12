# GEE-Assist-Web

The website for [GEE-Assist](https://github.com/Abdullah2265Habib/GEE-Assist), the Windows app for downloading
and analysing Google Earth Engine imagery. It explains what the app does, lists the datasets it supports, lets
visitors try its terminal, and lets signed-in users rate the app, send feedback and suggest features.

React + TypeScript, built with Vite. Accounts, ratings, feedback and suggestions come from
[GEE-Assist-Backend](https://github.com/Abdullah2265Habib/GEE-Assist-Backend), the same server the desktop app uses.

## Pages

| Path | Who | What |
|---|---|---|
| `/` | everyone | Interactive globe, how a request works, live terminal demo, datasets, analyses, themes |
| `/features` | everyone | Plain-language requests, the parameter form, chunked downloads, terminal, accounts, shortcuts |
| `/datasets` | everyone | All 15 datasets: years covered (chart), pixel size, analyses, Earth Engine IDs, filters |
| `/terminal` | everyone | gkonsol running in the browser (simulated, downloads nothing) and a command reference |
| `/about` | everyone | The problem, what was built, how the pieces fit, tech stack, licence, privacy |
| `/download` | everyone | Requirements, setup from source, Earth Engine setup, FAQ |
| `/community` | everyone sees it, signed-in users use it | Rate the app, send feedback, suggest features, see status and replies |
| `/login`, `/signup`, `/verify` | everyone | Username/password or Google sign-in; email confirmation screen that signs in by itself |
| `/account` | signed in | Account details |
| `/admin` | administrators | Overview, reply to feedback and suggestions, ratings, enable/disable users and change roles |

The site has the desktop app's three themes (light, dark blue-green, dark grey), switchable from the header.
The choice is kept in the browser.

## Running it

You need Node.js 20 or newer, and the backend running (by default on `http://localhost:8000`).

```bash
npm install
copy .env.example .env      # optional: the defaults work for local development
npm run dev                 # http://localhost:5173
```

In development the site calls `/api/...`, and Vite forwards those requests to the backend
(`BACKEND_URL` in `.env`). The backend needs no CORS setting for this.

Other scripts:

```bash
npm run build      # type-check and build to dist/
npm run preview    # serve dist/ (also forwards /api to the backend)
npm run lint       # type-check only
```

## Deploying

1. Set `VITE_API_BASE_URL` to the backend's public address, e.g. `https://api.example.com`, then `npm run build`.
2. In the backend's `.env`, add the website's address to `CORS_ORIGINS`, e.g. `CORS_ORIGINS=https://gee-assist.example.com`.
3. Serve `dist/` from any static host. Configure it to answer every unknown path with `index.html`,
   so links like `/datasets` work when opened directly.
4. Set `VITE_DOWNLOAD_URL` to the installer's address once there is one. Until then the download buttons point to the
   GitHub releases page.

Google sign-in works on the website only if it is configured on the backend (`GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`). The site uses the backend's desktop flow: it opens Google in a new tab and waits for the result.

## Code layout

```
src/
├── api/            fetch client (token refresh on 401), one module per backend feature, response types
├── auth/           AuthProvider (session, sign-up, Google, verification) and RequireAuth
├── theme/          ThemeProvider: the three themes
├── data/           datasets.ts, copied from the desktop app's backend/config/datasets.py
├── components/
│   ├── globe/      d3-geo globe: pick a country, get its "form aoi bbox" command
│   ├── terminal/   engine.ts (gkonsol command interpreter) and Terminal.tsx
│   ├── community/  stars, rating breakdown, status pills
│   └── layout/     header, footer, theme switcher, server status
├── pages/          one file per route; auth/ and admin/ in their own folders
└── styles/         tokens.css (colours from the app's palette.py), base, pages, content
public/media/       app icons (three themes), globe and satellite animations
docs/reference/     the original globe loading-page concept
```

When the desktop app gains a dataset or a gkonsol command, update `src/data/datasets.ts` or
`src/components/terminal/engine.ts` to match.
