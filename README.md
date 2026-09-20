# Cha Caddy

A personal / shared Chinese tea cellar: photos, brew notes, gongfu timer, listing lookup, and household shelves.

## Run it

Needs **Node 22**.

```bash
git clone https://github.com/78tacos/cha-caddy.git
cd cha-caddy
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) and create an account (email + password).

Optional env (copy `.env.example` to `.env`):

```bash
# Grok lookup, Find tea info, polish notes, generated photos
XAI_API_KEY=xai-...

# Postgres — otherwise it uses a local PGLite file
DATABASE_URL=postgres://...
```

```bash
npm run build
npm run typecheck
```

## What’s in here

- Cellar cards with type-colored Chinese motif backgrounds
- Add / edit tea, listing lookup, **Find tea info** for grocery and travel teas
- Temperature ranges in °F (toggle °C), photo carousel (tea / packaging labels), Find photos online
- Gongfu timer with +1s / −1s (saved per tea), gong / bell / pour sounds (capped at 4 seconds)
- Shared household cellars
- **Remake kit** (Share → Backup everything): teas, photos, sessions, notes. Restore with Add/Replace from file after you sign in on a new copy. Does not include your password.
- Local `./data/pglite` keeps the cellar across `npm run dev` restarts
- Harvest / vintage year pulled from listings (e.g. “2021 harvest”)
- Full backup of the live cellar (Share → Full backup)

## v1.7

- Timer sounds no longer play a long train/plane sample; every chime stops at 4s
- One photo carousel instead of separate portrait + wrapper slots, with Tea / Packaging labels
- Find photos online when you are filling a generic tea by hand
- Listing harvest years land in Year / vintage
- Share → Full backup dumps every cellar you can open (teas, photos, sessions)

v1.6
