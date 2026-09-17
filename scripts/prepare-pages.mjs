#!/usr/bin/env node
/**
 * Stage a GitHub Pages payload in dist/client:
 * SPA fallback 404.html, .nojekyll, and an index.html that boots the client.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "dist/client");
const base = "/cha-caddy/";

const CANDIDATES = [
  join(root, "dist/client"),
  join(root, "dist"),
  join(root, ".output/public"),
];

function hasAssets(dir) {
  try {
    return existsSync(join(dir, "assets")) && readdirSync(join(dir, "assets")).length > 0;
  } catch {
    return false;
  }
}

function pickDir() {
  for (const dir of CANDIDATES) {
    if (hasAssets(dir)) return dir;
  }
  return null;
}

function pickAsset(dir, test) {
  const names = readdirSync(join(dir, "assets"));
  const match = names.find(test);
  if (!match) return null;
  return `${base}assets/${match}`;
}

const src = pickDir();
if (!src) {
  console.error("[pages] No client assets found (looked in dist/client, dist, .output/public).");
  process.exit(1);
}

if (src !== dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

const css = pickAsset(dest, (name) => name.startsWith("styles-") && name.endsWith(".css"));
const js = pickAsset(dest, (name) => name.startsWith("index-") && name.endsWith(".js"));
if (!css || !js) {
  console.error("[pages] Missing styles-*.css or index-*.js in assets.");
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="en" class="antialiased">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cha Caddy</title>
    <meta name="description" content="A cellar for Chinese tea — track the leaves, the last cup, and what has sat too long." />
    <meta name="theme-color" content="#0e0d0b" />
    <link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />
    <link rel="manifest" href="${base}manifest.webmanifest" />
    <link rel="stylesheet" href="${css}" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${js}"></script>
  </body>
</html>
`;

writeFileSync(join(dest, "index.html"), html);
copyFileSync(join(dest, "index.html"), join(dest, "404.html"));
writeFileSync(join(dest, ".nojekyll"), "");
console.log(`[pages] Prepared ${dest}`);
console.log(`[pages] css=${css}`);
console.log(`[pages] js=${js}`);
