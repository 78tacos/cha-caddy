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

## GitHub Pages

The live static copy is meant for [https://78tacos.github.io/cha-caddy/](https://78tacos.github.io/cha-caddy/). GitHub Pages cannot run the Node server, so that build keeps the cellar in this browser (timer, photos, notes). Listing lookup, Grok, accounts, and household sharing stay on a hosted deploy.

```bash
npm run build:pages
```

After merge to `main`, turn on **Settings → Pages → GitHub Actions** once. Later pushes to `main` publish automatically.

## What’s in here

- Cellar cards with type-colored Chinese motif backgrounds
- Add / edit tea, listing lookup, **Find tea info** for grocery and travel teas
- Temperature ranges in °F (toggle °C), wrapper / nei fei photos
- Gongfu timer with +1s / −1s (saved per tea), gong / bell / pour sounds
- Shared household cellars

v1.6
