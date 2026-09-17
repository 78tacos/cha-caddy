import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  TEA_FORMS,
  normalizeTeaType,
  restDaysFor,
  tempFor,
  tempRangeFor,
  type TeaForm,
  type TeaType,
} from "./types";
import { extractSteepTime, extractTempRange, TYPE_BREW } from "./brew";
import { gongfuTimeFromText, lifeBrewHint, loadLifeWiki, matchLifeEntries, matchLifeEntry, type LifeEntry } from "./wiki-life";
import {
  detectShop,
  fuzzyShops,
  isWikiHost,
  normalizeHost,
  shopHosts,
  type PageHit,
  type PhotoCandidate,
} from "./sources";

export type { PageHit, PhotoCandidate } from "./sources";

const SHOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type TeaLookup = {
  name: string;
  nameZh: string;
  pinyin: string;
  type: TeaType;
  subtype: string;
  origin: string;
  region: string;
  cultivar: string;
  vendorGuess: string;
  yearTypical: string;
  processing: string;
  description: string;
  descriptionSource: "listing" | "general";
  tastingNotes: string[];
  liquor: string;
  brew: {
    vessel: string;
    grams: string;
    tempC: number;
    tempLowC?: number;
    tempHighC?: number;
    rinse: string;
    time: string;
    infusions: string;
  };
  tempRange: string;
  aging: string;
  restDays: number;
  aliases: string[];
  sources: string[];
  photoUrl: string;
  factory: string;
  recipe: string;
  listingUrl: string;
  form: TeaForm;
  originalGrams: number | null;
};

export type TeaGuess = {
  name: string;
  why: string;
};

export type UnknownPrompt = TeaLookup & {
  unknown: true;
  guesses: TeaGuess[];
  prompt: string;
};

export type LookupResult =
  | { ok: true; tea: TeaLookup; from: string[]; photos: PhotoCandidate[] }
  | { ok: false; error: string };

export type SearchPagesResult =
  | { ok: true; pages: PageHit[] }
  | { ok: false; error: string };

export type PromptResult =
  | { ok: true; tea: UnknownPrompt }
  | { ok: false; error: string };

export type WrapperResult =
  | {
      ok: true;
      factory: string;
      recipe: string;
      year: string;
      name: string;
      nameZh: string;
      pinyin: string;
      vendor: string;
      type: TeaType;
    }
  | { ok: false; error: string };

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host) || host === "169.254.169.254") return true;
  return false;
}

function assertPublicHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("That listing URL does not look valid.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) shop listings can be read.");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("That address cannot be fetched.");
  }
  return parsed;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/"/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/'/gi, "'")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

function absUrl(raw: string, base: URL): string | null {
  try {
    const u = new URL(raw.replace(/&/g, "&"), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (isPrivateHost(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function photoHint(url: string, alt = ""): string {
  const hay = `${alt} ${url}`.toLowerCase();
  if (/packag|wrapper|nei.?fei|ticket|box|tin|bag|pouch|label|carton|neifei/.test(hay)) {
    return "Packaging / wrapper";
  }
  if (/leaf|gan cha|dry|loose|maocha|cake|bing|beeng|tuo/.test(hay)) return "Dry leaf";
  if (/brew|liquor|soup|cup|gaiwan|gongfu/.test(hay)) return "Brewed";
  return "";
}

function extractImageUrls(html: string, base: URL): { url: string; hint: string }[] {
  const found: { url: string; hint: string }[] = [];
  const push = (raw: string | undefined, hint = "") => {
    if (!raw) return;
    const abs = absUrl(raw, base);
    if (abs && !found.some((f) => f.url === abs)) found.push({ url: abs, hint: hint || photoHint(abs) });
  };
  const og = html.match(/property=["']og:image["'][\s\S]{0,120}?content=["']([^"']+)/i);
  const og2 = html.match(/content=["']([^"']+)["'][\s\S]{0,120}?property=["']og:image["']/i);
  push(og?.[1] ?? og2?.[1]);
  const tw = html.match(/name=["']twitter:image["'][\s\S]{0,120}?content=["']([^"']+)/i);
  const tw2 = html.match(/property=["']twitter:image["'][\s\S]{0,120}?content=["']([^"']+)/i);
  push(tw?.[1] ?? tw2?.[1]);
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1] ?? "") as unknown;
      const walk = (node: unknown) => {
        if (!node) return;
        if (typeof node === "string") {
          if (/\.(jpe?g|png|webp)(\?|$)/i.test(node)) push(node);
          return;
        }
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (typeof node === "object") {
          const rec = node as Record<string, unknown>;
          if (typeof rec.image === "string") push(rec.image);
          if (Array.isArray(rec.image)) rec.image.forEach(walk);
          if (typeof rec.url === "string" && /\.(jpe?g|png|webp)(\?|$)/i.test(rec.url)) push(rec.url);
          Object.values(rec).forEach(walk);
        }
      };
      walk(json);
    } catch {
      /* ignore bad json-ld */
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/(?:src|data-src|data-original)=["']([^"']+)/i)?.[1] ?? "";
    const alt = tag.match(/alt=["']([^"']*)/i)?.[1] ?? "";
    if (/logo|icon|sprite|pixel|1x1|badge|payment/i.test(src)) continue;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(src) && !src.includes("cdn")) continue;
    push(src, photoHint(src, alt));
    if (found.length > 8) break;
  }
  return found.slice(0, 8);
}

function extractMetaDescription(html: string): string {
  const og = html.match(/property=["']og:description["'][\s\S]{0,160}?content=["']([^"']+)/i);
  const og2 = html.match(/content=["']([^"']+)["'][\s\S]{0,160}?property=["']og:description["']/i);
  const meta = html.match(/name=["']description["'][\s\S]{0,160}?content=["']([^"']+)/i);
  const raw = og?.[1] ?? og2?.[1] ?? meta?.[1] ?? "";
  return htmlToText(raw).slice(0, 2000);
}

async function scrapeListing(
  url: string,
): Promise<{ text: string; title: string; photos: PhotoCandidate[]; listingUrl: string; meta: string } | null> {
  const parsed = assertPublicHttpUrl(url);
  const res = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": SHOP_UA,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 280000);
  const ogTitle =
    html.match(/property=["']og:title["'][\s\S]{0,160}?content=["']([^"']+)/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][\s\S]{0,160}?property=["']og:title["']/i)?.[1];
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = htmlToText(ogTitle ?? titleMatch?.[1] ?? parsed.hostname).slice(0, 160) || parsed.hostname;
  const host = parsed.hostname.replace(/^www\./, "");
  const photos: PhotoCandidate[] = [];
  for (const img of extractImageUrls(html, parsed)) {
    if (isWikiHost(host)) continue;
    photos.push({
      url: img.url,
      source: host,
      label: img.hint || (photos.length === 0 ? title.slice(0, 80) : `Listing photo ${photos.length + 1}`),
    });
  }
  return {
    text: htmlToText(html),
    title,
    photos: photos.slice(0, 8),
    listingUrl: parsed.toString(),
    meta: extractMetaDescription(html),
  };
}

function absHttp(raw: string): string {
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
}

type ShopifyProduct = {
  title?: string;
  url?: string;
  handle?: string;
  body?: string;
  image?: string | { url?: string };
  featured_image?: { url?: string };
};

function shopifyImage(p: ShopifyProduct, host: string): string {
  const raw =
    (typeof p.image === "string" && p.image) ||
    (p.image && typeof p.image === "object" && p.image.url) ||
    p.featured_image?.url ||
    "";
  if (!raw) return "";
  const abs = absHttp(String(raw));
  if (abs.startsWith("http://") || abs.startsWith("https://")) return abs;
  try {
    return new URL(abs, `https://${host}/`).toString();
  } catch {
    return "";
  }
}

function shopifyHref(host: string, p: ShopifyProduct): string {
  if (p.url) {
    try {
      return new URL(p.url, `https://${host}/`).toString();
    } catch {
      /* fall through */
    }
  }
  if (p.handle) return `https://${host}/products/${p.handle}`;
  return "";
}

async function shopifyProducts(host: string, query: string): Promise<PageHit[]> {
  const url = `https://${host}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=4`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": SHOP_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      resources?: { results?: { products?: ShopifyProduct[] } };
    };
    const products = json.resources?.results?.products;
    if (!Array.isArray(products) || products.length === 0) return [];
    const hits: PageHit[] = [];
    for (const p of products) {
      const title = (p.title ?? "").trim();
      const href = shopifyHref(host, p);
      if (!title || !href) continue;
      hits.push({
        url: href,
        title,
        snippet: p.body ? htmlToText(String(p.body)).slice(0, 180) : "",
        thumbnail: shopifyImage(p, host),
        host,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

function decodeBingHref(href: string): string | null {
  try {
    const u = new URL(href, "https://www.bing.com/");
    const enc = u.searchParams.get("u");
    if (enc) {
      const payload = enc.replace(/^a1/i, "").replace(/-/g, "+").replace(/_/g, "/");
      const decoded = Buffer.from(payload, "base64").toString("utf8");
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
    if (!/bing\.com$/i.test(u.hostname.replace(/^www\./, ""))) return u.toString();
  } catch {
    /* ignore */
  }
  return null;
}

function isAmazonHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return /(?:^|\.)amazon\.[a-z.]+$/i.test(h) || h === "amzn.to" || h.endsWith(".amzn.to");
}

function amazonTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const dp = parts.findIndex((p) => p === "dp" || p === "gp");
    const slug = (dp > 0 ? parts[dp - 1] : parts.find((p) => p.includes("-") && p.length > 6)) ?? "";
    return decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\b\d{10,}\b/g, "").trim();
  } catch {
    return "";
  }
}

function cleanAmazonTitle(raw: string): string {
  return raw
    .replace(/^amazon\.com\s*[:\-–]\s*/i, "")
    .replace(/\s*[:\-–]\s*amazon\.com\b.*$/i, "")
    .replace(/\s*[|\-–:]\s*(grocery|& gourmet|health|home|kitchen|industrial).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function amazonLooksUnusable(scraped: { text: string; title: string; meta: string } | null): boolean {
  if (!scraped) return true;
  const head = `${scraped.title} ${scraped.meta} ${scraped.text.slice(0, 2500)}`;
  if (/robot check|captcha|enter the characters you see|automated access|something went wrong on amazon/i.test(head)) {
    return true;
  }
  const hasProduct = /add to cart|buy now|in stock|about this item|product details|customer reviews/i.test(scraped.text);
  if (!hasProduct) return true;
  return listingLooksThin(scraped.text, scraped.meta);
}

async function lookupFromAmazonTitle(
  url: string,
  query: string,
  titleHint: string,
  photos: PhotoCandidate[],
): Promise<LookupResult> {
  const title = cleanAmazonTitle(titleHint || amazonTitleFromUrl(url) || query);
  if (!title) {
    return { ok: false, error: "That Amazon page did not return a listing we could read." };
  }
  const generic = await genericFromClues({
    name: title,
    notes: `Pasted Amazon product URL. Title from the page or link: ${title}`,
  });
  const tea = generic.teas[0];
  if (!tea) {
    return { ok: false, error: "Could not identify that Amazon tea from the title." };
  }
  return {
    ok: true,
    from: ["Amazon title", ...generic.from],
    photos,
    tea: {
      ...tea,
      listingUrl: url,
      vendorGuess: tea.vendorGuess || "Amazon",
      descriptionSource: "general",
    },
  };
}

function isJunkHost(host: string): boolean {
  const h = host.toLowerCase();
  if (isWikiHost(h)) return true;
  if (h === "shop.app" || h.endsWith(".shop.app")) return true;
  return /(?:^|\.)(facebook|instagram|pinterest|reddit|tiktok|twitter|x|youtube|amazon|ebay|aliexpress)\./.test(
    ` ${h} `,
  ) || /(?:facebook|instagram|pinterest|reddit|tiktok|twitter|youtube|amazon)\.com$/.test(h);
}

function parseBingHtml(html: string): PageHit[] {
  const hits: PageHit[] = [];
  const seen = new Set<string>();
  const blocks = html.matchAll(/<li[^>]*class="[^"]*b_algo[^"]*"[\s\S]*?<\/li>/gi);
  for (const block of blocks) {
    const chunk = block[0] ?? "";
    const a =
      chunk.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
      chunk.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a?.[1]) continue;
    const resolved = decodeBingHref(a[1].replace(/&/g, "&"));
    if (!resolved) continue;
    let parsed: URL;
    try {
      parsed = new URL(resolved);
    } catch {
      continue;
    }
    const host = parsed.hostname.replace(/^www\./, "");
    if (isPrivateHost(host) || isJunkHost(host) || seen.has(parsed.toString())) continue;
    seen.add(parsed.toString());
    const title = htmlToText(a[2] ?? "").slice(0, 140);
    const snip = htmlToText((chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "")).slice(0, 180);
    if (!title) continue;
    hits.push({ url: parsed.toString(), title, snippet: snip, thumbnail: "", host });
    if (hits.length >= 8) break;
  }
  return hits;
}

async function searchWebPages(query: string): Promise<PageHit[]> {
  const q = /\btea\b/i.test(query) ? query : `${query} tea`;
  const [bing, ddg] = await Promise.all([searchBingPages(q), searchDdgPages(q)]);
  const merged: PageHit[] = [];
  const seen = new Set<string>();
  for (const hit of [...ddg, ...bing]) {
    const key = hit.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key) || !hit.url || !hit.title) continue;
    seen.add(key);
    merged.push(hit);
  }
  return merged.slice(0, 8);
}

async function searchBingPages(query: string): Promise<PageHit[]> {
  try {
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en&setmkt=en-US`, {
      headers: {
        "User-Agent": SHOP_UA,
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 220000);
    return parseBingHtml(html);
  } catch {
    return [];
  }
}

function decodeDdgHref(href: string): string | null {
  try {
    const u = new URL(href, "https://duckduckgo.com/");
    const uddg = u.searchParams.get("uddg");
    if (uddg && /^https?:\/\//i.test(uddg)) return uddg;
    const host = u.hostname.replace(/^www\./, "");
    if (!/duckduckgo\.com$/i.test(host)) return u.toString();
  } catch {
    /* ignore */
  }
  return null;
}

function parseDdgHtml(html: string): PageHit[] {
  const hits: PageHit[] = [];
  const seen = new Set<string>();
  const links = html.matchAll(
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<a[^>]*href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
  );
  for (const m of links) {
    const href = (m[1] || m[3] || "").replace(/&/g, "&");
    const label = m[2] || m[4] || "";
    const resolved = decodeDdgHref(href);
    if (!resolved) continue;
    let parsed: URL;
    try {
      parsed = new URL(resolved);
    } catch {
      continue;
    }
    const host = parsed.hostname.replace(/^www\./, "");
    if (isPrivateHost(host) || isJunkHost(host) || seen.has(parsed.toString())) continue;
    seen.add(parsed.toString());
    const title = htmlToText(label).slice(0, 140);
    if (!title) continue;
    hits.push({ url: parsed.toString(), title, snippet: "", thumbnail: "", host });
    if (hits.length >= 8) break;
  }
  return hits;
}

async function searchDdgPages(query: string): Promise<PageHit[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": SHOP_UA,
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 220000);
    return parseDdgHtml(html);
  } catch {
    return [];
  }
}


function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((w) => w.length > 2 && !["tea", "the", "and", "shop"].includes(w));
}

function pageScore(hit: PageHit, query: string, focusHost: string | null, rankHosts: Set<string>): number {
  const title = hit.title.toLowerCase();
  const snip = hit.snippet.toLowerCase();
  const words = queryTokens(query);
  const titleHits = words.filter((w) => title.includes(w)).length;
  let score = titleHits * 4;
  score += words.filter((w) => snip.includes(w)).length;
  if (words.length >= 2 && titleHits === 0) score -= 12;
  if (focusHost && hit.host === focusHost) score += 80;
  else if (rankHosts.has(hit.host)) score += 18;
  if (/\/products\//i.test(hit.url)) score += 8;
  if (hit.thumbnail) score += 3;
  if (/\b(tea|dancong|oolong|pu-?erh|hong cha|gong fu)\b/i.test(title)) score += 2;
  if (isWikiHost(hit.host)) score -= 40;
  if (isJunkHost(hit.host)) score -= 20;
  return score;
}

function diversifyHosts(hits: PageHit[], limit: number): PageHit[] {
  const picked: PageHit[] = [];
  const used = new Set<string>();
  for (const hit of hits) {
    if (used.has(hit.host)) continue;
    picked.push(hit);
    used.add(hit.host);
    if (picked.length >= limit) return picked;
  }
  for (const hit of hits) {
    if (picked.includes(hit)) continue;
    picked.push(hit);
    if (picked.length >= limit) break;
  }
  return picked;
}

async function collectPages(query: string, sources: string[], focusHost: string | null): Promise<PageHit[]> {
  const detected = detectShop(query);
  const shopHost = focusHost || detected?.host || null;
  const remainder = (detected?.remainder || query).trim() || query;
  const rankHosts = new Set(shopHosts(sources));
  const webQuery = shopHost ? remainder : query;

  const tasks: Array<Promise<PageHit[]>> = [];
  if (shopHost) {
    tasks.push(shopifyProducts(shopHost, remainder));
    tasks.push(searchWebPages(`${remainder} site:${shopHost}`));
  }
  tasks.push(searchWebPages(webQuery));

  const settled = await Promise.allSettled(tasks);
  const merged: PageHit[] = [];
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const hit of result.value) {
      const key = hit.url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key) || !hit.url || !hit.title) continue;
      if (isWikiHost(hit.host)) continue;
      seen.add(key);
      merged.push(hit);
    }
  }
  merged.sort((a, b) => pageScore(b, remainder, shopHost, rankHosts) - pageScore(a, remainder, shopHost, rankHosts));
  return diversifyHosts(merged, 3);
}


function wikiLooksLikeTea(title: string, extract: string): boolean {
  const s = `${title} ${extract}`.toLowerCase();
  if (
    /\b(macaque|primate|old world monkey|snub-nosed|rhesus|ape|lemur|howler|mammal|wildlife|species of monkey|rhinopithecus)\b/.test(
      s,
    ) &&
    !/\b(tea|camellia|pu-?erh|hong cha|black tea|gong fu|jin hou)\b/.test(s)
  ) {
    return false;
  }
  return /\b(tea|camellia sinensis|pu-?erh|puerh|oolong|hong cha|black tea|white tea|green tea|heicha|dancong|yancha)\b/.test(
    s,
  );
}

async function wikiSummary(query: string): Promise<{ extract: string } | null> {
  const headers = { "Api-User-Agent": "ChaCaddy/1.0 (tea cellar; lookup)" };
  const wikiQuery = /\b(tea|cha|puer|oolong|hong)\b/i.test(query) ? query : `${query} tea`;
  const tryTitle = async (title: string) => {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      extract?: string;
      title?: string;
    };
    if (!body.extract) return null;
    const pageTitle = body.title ?? title;
    if (!wikiLooksLikeTea(pageTitle, body.extract)) return null;
    return { extract: `${pageTitle}: ${body.extract}` };
  };

  try {
    const direct = await tryTitle(wikiQuery.replace(/\s+/g, "_"));
    if (direct) return direct;

    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wikiQuery)}&utf8=1&format=json&origin=*`,
      { headers, signal: AbortSignal.timeout(5000) },
    );
    if (!searchRes.ok) return null;
    const searchBody = (await searchRes.json()) as {
      query?: { search?: { title: string }[] };
    };
    for (const hit of (searchBody.query?.search ?? []).slice(0, 2)) {
      const page = await tryTitle(hit.title);
      if (page) return page;
    }
    return null;
  } catch {
    return null;
  }
}

function coerceType(value: unknown, subtype = ""): TeaType {
  return normalizeTeaType(String(value ?? ""), subtype).type;
}

function coerceSubtype(typeValue: unknown, subtypeValue: unknown): string {
  const rawSub = asString(subtypeValue);
  return normalizeTeaType(String(typeValue ?? ""), rawSub).subtype || rawSub;
}

function coerceForm(value: unknown): TeaForm {
  const s = String(value ?? "").toLowerCase();
  if ((TEA_FORMS as readonly string[]).includes(s)) return s as TeaForm;
  if (s.includes("tuo") || s.includes("nido")) return "tuo";
  if (s.includes("sample") || s.includes("pouch")) return "sample";
  if (s.includes("wedge") || s.includes("broken") || s.includes("chunk")) return "wedge";
  if (s.includes("loose")) return "loose";
  if (s.includes("cake") || s.includes("bing") || s.includes("brick")) return "cake";
  return "loose";
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function asNotes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).slice(0, 10);
  if (typeof v === "string") {
    return v
      .split(/[,;|/]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
  }
  return [];
}

function parseModelJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listingLooksThin(text: string, meta: string): boolean {
  const body = `${meta} ${text}`.trim();
  if (/robot check|enter the characters you see|captcha|enable javascript|sorry, we just need to make sure|automated access/i.test(body)) {
    return true;
  }
  if (body.length < 180) return true;
  const words = body.split(/\s+/).filter((w) => w.length > 3);
  return words.length < 40;
}

function normalize(
  obj: Record<string, unknown>,
  fallbackName: string,
  sources: string[],
  extras: Partial<Pick<TeaLookup, "photoUrl" | "listingUrl" | "descriptionSource">> & {
    tempC?: number | null;
    tempLowC?: number | null;
    tempHighC?: number | null;
    time?: string;
  } = {},
): TeaLookup {
  const type = coerceType(obj.type, asString(obj.subtype));
  const subtype = coerceSubtype(obj.type, obj.subtype);
  const restRaw = Number(obj.restDays);
  const gramsRaw = Number(obj.originalGrams);
  const grokTemp = Number((obj.brew as Record<string, unknown> | undefined)?.tempC ?? obj.tempC);
  const grokLow = Number((obj.brew as Record<string, unknown> | undefined)?.tempLowC ?? obj.tempLowC);
  const grokHigh = Number((obj.brew as Record<string, unknown> | undefined)?.tempHighC ?? obj.tempHighC);
  const tempC =
    extras.tempC && extras.tempC >= 70 && extras.tempC <= 100
      ? extras.tempC
      : grokTemp >= 70 && grokTemp <= 100
        ? grokTemp
        : tempFor(type, subtype);
  const tempLowC =
    extras.tempLowC && extras.tempLowC >= 50 && extras.tempLowC <= 100
      ? extras.tempLowC
      : grokLow >= 50 && grokLow <= 100
        ? grokLow
        : undefined;
  const tempHighC =
    extras.tempHighC && extras.tempHighC >= 50 && extras.tempHighC <= 100
      ? extras.tempHighC
      : grokHigh >= 50 && grokHigh <= 100
        ? grokHigh
        : undefined;
  const sourceFlag =
    extras.descriptionSource ??
    (asString(obj.descriptionSource) === "general" || obj.listingHasDescription === false
      ? "general"
      : "listing");
  let description = asString(obj.description);
  if (sourceFlag === "general" && description && !/^general notes/i.test(description)) {
    description = `General notes: ${description}`;
  }
  const brewObj = obj.brew && typeof obj.brew === "object" ? (obj.brew as Record<string, unknown>) : {};
  const time =
    extras.time ||
    asString(brewObj.time) ||
    asString(obj.steepTime) ||
    (TYPE_BREW[type] ? `${TYPE_BREW[type].first}s, +${TYPE_BREW[type].step}s` : "10s, +5s");
  return {
    name: asString(obj.name) || fallbackName,
    nameZh: asString(obj.nameZh),
    pinyin: asString(obj.pinyin),
    type,
    subtype,
    origin: asString(obj.origin),
    region: asString(obj.region),
    cultivar: asString(obj.cultivar),
    vendorGuess: asString(obj.vendorGuess),
    yearTypical: asString(obj.yearTypical) || asString(obj.year),
    processing: asString(obj.processing),
    description,
    descriptionSource: sourceFlag,
    tastingNotes: asNotes(obj.tastingNotes),
    liquor: asString(obj.liquor),
    brew: {
      vessel: "",
      grams: "",
      tempC,
      ...(tempLowC != null ? { tempLowC } : {}),
      ...(tempHighC != null ? { tempHighC } : {}),
      rinse: "",
      time,
      infusions: "",
    },
    tempRange: tempRangeFor(type),
    aging: asString(obj.aging),
    restDays: Number.isFinite(restRaw) && restRaw >= 7 ? Math.round(restRaw) : restDaysFor(type),
    aliases: asNotes(obj.aliases),
    sources,
    photoUrl: extras.photoUrl ?? asString(obj.photoUrl),
    factory: asString(obj.factory),
    recipe: asString(obj.recipe),
    listingUrl: extras.listingUrl ?? asString(obj.listingUrl),
    form: coerceForm(obj.form),
    originalGrams: Number.isFinite(gramsRaw) && gramsRaw > 0 ? gramsRaw : null,
  };
}

const GENERIC_TASTING_PROMPT = `1. Dry leaf
Compression (cake, tuo, brick, loose), bud ratio, leaf size, color (olive, brown, black, gold tips), and any smoke, warehouse, or roast smell.

2. Warm lid
Cover the dry leaf with the gaiwan lid for 10 seconds. Note orchard fruit, incense, damp wood, charcoal, floral, or nothing.

3. Wash
A 5–10s rinse. The liquor color already sorts sheng (gold) from ripe/heicha (opaque mahogany) from roasted oolong (amber) from green/white (pale). Smell the wet leaf.

4. Steeps 1–3
Bitterness vs astringency, throat cooling, smoke that lifts or stays, sweetness that arrives late. Write one word per steep.

5. Later steeps
Does it hollow out, turn mineral, or keep sweet? Factory blends fade more evenly; old-tree material often lengthens.

6. Wet leaf
Unfurl a leaf. Look at grade, oxidation, and whether it looks blended.

7. What would confirm a guess
A wrapper, a cultivar name, a roast that matches Wuyi rock, betel-nut on Liu Bao, camphor on aged sheng. Log what you actually tasted — do not force a famous name.`;

function fallbackUnknown(data: {
  clues: string;
  appearance: string;
  dryAroma: string;
  acquiredFrom: string;
  suspectedType?: string;
}): UnknownPrompt {
  const title = data.clues.trim().slice(0, 80) || "Unknown tea";
  const type = coerceType(data.suspectedType);
  return {
    ...normalize(
      {
        name: title,
        type,
        description:
          "Identity is not confirmed. Use the tasting prompt on the first session, then edit the cellar card with what the leaf actually did.",
        origin: "",
        processing: data.appearance,
        vendorGuess: data.acquiredFrom,
      },
      title,
      [],
    ),
    unknown: true,
    guesses: [],
    prompt: GENERIC_TASTING_PROMPT,
  };
}

function asGuesses(value: unknown): TeaGuess[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = asString(row.name);
      if (!name) return null;
      return { name, why: asString(row.why) };
    })
    .filter((g): g is TeaGuess => g != null)
    .slice(0, 3);
}

type ChatContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

async function grokJson(
  system: string,
  user: ChatContent,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Lookup is unavailable in this environment." };

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(22000),
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 2200,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return { ok: false, error: `Lookup failed (${res.status}). Try again in a moment.` };
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(content);
    if (!parsed) return { ok: false, error: "Could not parse cellar notes for that tea." };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "Lookup could not reach the tea references." };
  }
}

const LISTING_SYSTEM = `You extract cellar fields from ONE tea product listing. Return ONLY JSON with keys: name, nameZh, pinyin, type (white|green|yellow|oolong|black|sheng|heicha|herbal), subtype (e.g. Wuyi rock, Tieguanyin, Phoenix dancong, Silver Needle, Jin Jun Mei, Ripe puerh, Liu Bao — empty if unknown), origin, region, cultivar, vendorGuess, yearTypical, recipe, form (cake|wedge|tuo|loose|sample), processing, description, tastingNotes (array), liquor, tempC (number from the listing or 0 if the listing does not state water temperature), restDays, aliases, listingHasDescription (boolean), descriptionSource ("listing" or "general").

Rules:
- Copy or tightly paraphrase the listing for description. Do not invent shop notes, origin stories, or tasting notes that are not on the page.
- If the listing has no real product description, set listingHasDescription to false and descriptionSource to "general", and write 5–8 sentences of accurate generic information about this tea type or cultivar (cellar-note tone, like a careful encyclopedia). Prefix is added by the app.
- tastingNotes only if the listing names flavors; otherwise [].
- type is the broad category first; subtype is the style (Wuyi rock, TGY, Phoenix dancong, Ripe puerh, etc.).
- Ripe puerh / shou puerh is type heicha, subtype Ripe puerh. Liu Bao and Fu brick are also heicha. Raw puerh is type sheng.
- Golden Monkey / 金猴 / Jin Hou is Fujian hong cha (Bai Lin Gong Fu), never an animal.
- Water temperature: from the listing if present, otherwise 0. Also extract gongfu steeping as steepTime like "10s, +5s" when the listing gives times.`;

export const searchTeaPages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      query: z.string().trim().min(2).max(220),
      sources: z.array(z.string().max(200)).max(40).optional(),
      focusHost: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ data }): Promise<SearchPagesResult> => {
    const sources = data.sources ?? [];
    try {
      const pages = await collectPages(data.query, sources, data.focusHost ? normalizeHost(data.focusHost) : null);
      return { ok: true, pages };
    } catch {
      return { ok: false, error: "Could not search listings." };
    }
  });

export const searchShops = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ query: z.string().trim().min(2).max(120) }))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; shops: { host: string; title: string; url: string }[] } | { ok: false; error: string }
    > => {
      try {
        const known = fuzzyShops(data.query).map((s) => ({
          host: s.host,
          title: s.title,
          url: `https://${s.host}`,
        }));
        const web = await searchWebPages(`${data.query} tea shop`);
        const shops = [...known];
        const seen = new Set(shops.map((s) => s.host));
        for (const hit of web) {
          if (seen.has(hit.host) || isWikiHost(hit.host) || isJunkHost(hit.host)) continue;
          seen.add(hit.host);
          shops.push({ host: hit.host, title: hit.title.slice(0, 80), url: `https://${hit.host}` });
          if (shops.length >= 3) break;
        }
        return { ok: true, shops: shops.slice(0, 3) };
      } catch {
        return { ok: false, error: "Could not find that shop." };
      }
    },
  );

const GUESS_SYSTEM = `You identify teas from incomplete names a cellar owner typed. They may be from an Asian grocery, travel, a nickname, or no listing at all. Return ONLY JSON:
{ "teas": [ { name, nameZh, pinyin, type (white|green|yellow|oolong|black|sheng|heicha|herbal), subtype, origin, region, cultivar, vendorGuess, yearTypical, processing, description, tastingNotes (array), liquor, tempC, tempLowC, tempHighC, steepTime, restDays, aliases (array), why } ] }

Rules:
- Rank 1–3 guesses, most likely first. Decode nicknames (e.g. "halmoni cha (korean grandma tea)" → Korean barley tea / corn tea / ssanghwa / homemade herbal — NOT a random Chinese oolong).
- The owner's typed name is the primary clue. Do not substitute a famous Chinese tea unless the name actually refers to it.
- description: 5–8 sentences of accurate generic cellar information. Honest. No shop marketing. No invented vintage or specific farm unless the name implies it.
- If chinesetea.life or Wikipedia snippets are given, prefer those facts.
- Ripe/shou puerh is type heicha, subtype Ripe puerh. Korean/Japanese roasted grain or herbal drinks are herbal unless clearly Camellia sinensis.
- tempC/tempLowC/tempHighC in Celsius. steepTime like "10s, +5s" for gongfu, or "3 min" if that's typical.
- Do not invent a shop listing URL.`;

function lifeToLookup(entry: LifeEntry, sources: string[]): TeaLookup {
  const coerced = normalizeTeaType(entry.category || entry.name, entry.name);
  const hint = lifeBrewHint(entry);
  const desc = [entry.description, entry.flavor].filter(Boolean).join(" ").trim();
  return normalize(
    {
      name: entry.name,
      nameZh: entry.chinese,
      type: coerced.type,
      subtype: coerced.subtype || entry.name,
      description: desc,
      descriptionSource: "general",
      tastingNotes: entry.flavor
        ? entry.flavor
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
    },
    entry.name,
    sources,
    { tempC: hint.tempC, tempLowC: hint.tempLowC, tempHighC: hint.tempHighC, time: hint.time, descriptionSource: "general" },
  );
}

async function genericFromClues(clues: {
  name: string;
  type?: string;
  subtype?: string;
  origin?: string;
  vendor?: string;
  notes?: string;
}): Promise<{ teas: TeaLookup[]; from: string[] }> {
  const q = [clues.name, clues.subtype, clues.type].filter(Boolean).join(" ").trim();
  const from: string[] = [];
  const [life, wiki, web] = await Promise.all([
    loadLifeWiki(),
    wikiSummary(q),
    searchWebPages(`${q} tea`),
  ]);
  const lifeHits = matchLifeEntries(q, life, 3);
  if (lifeHits.length) from.push("chinesetea.life");
  if (wiki) from.push("Wikipedia");
  const snippets = web
    .slice(0, 5)
    .map((h) => `${h.title} (${h.host}): ${h.snippet}`)
    .join("\n");
  if (web.length) from.push("web");

  const userParts = [
    `Name / nickname: ${clues.name || "(none)"}`,
    clues.type ? `Owner currently has type bin "${clues.type}" selected — override it if the name is clearly a different category (do not force a famous tea of that type).` : null,
    clues.subtype ? `Style: ${clues.subtype}` : null,
    clues.origin ? `Origin they typed: ${clues.origin}` : null,
    clues.vendor ? `Vendor / shop: ${clues.vendor}` : null,
    clues.notes ? `Extra notes: ${clues.notes}` : null,
    lifeHits.length
      ? `Chinese Tea Wiki (chinesetea.life) matches:\n${lifeHits
          .map((e) => `${e.name} (${e.chinese}, ${e.category}): ${e.description}\nFlavor: ${e.flavor}\nBrewing: ${e.brewing}`)
          .join("\n\n")}`
      : null,
    wiki ? `Wikipedia:\n${wiki.extract}` : null,
    snippets ? `Web snippets:\n${snippets}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const parsed = await grokJson(GUESS_SYSTEM, userParts);
  if (parsed.ok) {
    const rows = Array.isArray(parsed.data.teas) ? parsed.data.teas : [parsed.data];
    const teas: TeaLookup[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      teas.push(
        normalize(rec, clues.name || asString(rec.name), from.length ? from : ["generic"], {
          descriptionSource: "general",
          tempC: Number(rec.tempC) || null,
          tempLowC: Number(rec.tempLowC) || null,
          tempHighC: Number(rec.tempHighC) || null,
          time: asString(rec.steepTime),
        }),
      );
      if (teas.length >= 3) break;
    }
    if (teas.length) return { teas, from: from.length ? from : ["Grok"] };
  }

  const fallback = lifeHits.map((e) => lifeToLookup(e, from));
  if (fallback.length) return { teas: fallback, from };
  if (wiki) {
    return {
      teas: [
        normalize(
          {
            name: clues.name,
            type: clues.type,
            subtype: clues.subtype,
            description: wiki.extract,
            descriptionSource: "general",
            origin: clues.origin,
            vendorGuess: clues.vendor,
          },
          clues.name,
          from,
          { descriptionSource: "general" },
        ),
      ],
      from,
    };
  }
  const korean = /halmoni|boricha|barley tea|ssanghwa|oksusu|korean|mugicha|grandma tea/i.test(clues.name);
  return {
    teas: [
      normalize(
        {
          name: clues.name,
          type: korean ? "herbal" : clues.type || "herbal",
          subtype: korean ? "Tisane" : clues.subtype || "",
          origin: korean ? "Korea" : clues.origin,
          description: korean
            ? `General notes: “${clues.name}” reads as a Korean home or grocery tea rather than a named Chinese cultivar. Teas like this are often roasted barley (boricha), corn (oksusu cha), or a household mix a grandmother would pour — toasted grain, mild, and drunk throughout the day rather than gongfu. Treat this as a working card: taste the first pot and edit what the leaf actually is.`
            : `General notes: No shop listing was found for “${clues.name}”. This is a working cellar card from the name alone. Grocery and travel teas are often a house blend or a common type sold unlabeled. Taste the first session and edit the card with what the leaf actually did.`,
          descriptionSource: "general",
          vendorGuess: clues.vendor,
        },
        clues.name,
        from.length ? from : ["generic"],
        { descriptionSource: "general" },
      ),
    ],
    from: from.length ? from : ["generic"],
  };
}

export const lookupTea = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      query: z.string().trim().max(220).default(""),
      url: z.string().trim().min(8).max(500),
      sources: z.array(z.string().max(200)).max(40).optional(),
      pullPhotos: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<LookupResult> => {
    const from: string[] = [];
    const pullPhotos = data.pullPhotos !== false;

    let scraped: {
      text: string;
      title: string;
      photos: PhotoCandidate[];
      listingUrl: string;
      meta: string;
    } | null = null;
    try {
      scraped = await scrapeListing(data.url);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not read that listing.",
      };
    }
    if (!scraped || (isAmazonHost(hostOf(data.url)) && amazonLooksUnusable(scraped))) {
      const host = hostOf(data.url);
      if (isAmazonHost(host)) {
        return lookupFromAmazonTitle(
          data.url,
          data.query,
          scraped?.title || scraped?.meta || "",
          scraped?.photos ?? [],
        );
      }
      if (!scraped) {
        return { ok: false, error: "That page did not return a listing we could read." };
      }
    }
    if (!scraped) {
      return { ok: false, error: "That page did not return a listing we could read." };
    }
    from.push(hostOf(scraped.listingUrl) || scraped.listingUrl);

    const q = data.query.trim() || scraped.title.replace(/\s*[|\-–].*$/, "").trim();
    const thin = listingLooksThin(scraped.text, scraped.meta);
    const wiki = thin ? await wikiSummary(q) : null;
    if (wiki) from.push("Wikipedia");

    const life = await loadLifeWiki();
    const lifeHit = matchLifeEntry(`${q} ${scraped.title}`, life);
    if (lifeHit) from.push("chinesetea.life");

    const listingRange = extractTempRange(`${scraped.meta}\n${scraped.text}`);
    const lifeHint = lifeBrewHint(lifeHit);
    const listingTime = extractSteepTime(`${scraped.meta}\n${scraped.text}`) || lifeHint.time || gongfuTimeFromText(lifeHit?.brewing ?? "");
    const photos = pullPhotos && !isWikiHost(hostOf(scraped.listingUrl)) ? scraped.photos : [];

    const userParts = [
      `Tea the cellar owner typed: ${q || "(from the listing title)"}`,
      `Chosen listing URL: ${scraped.listingUrl}`,
      `Page title: ${scraped.title}`,
      scraped.meta ? `Listing meta description:\n${scraped.meta}` : null,
      `Listing text:\n${scraped.text.slice(0, 8000)}`,
      wiki ? `General reference (use ONLY if the listing has no real description):\n${wiki.extract}` : null,
      lifeHit
        ? `Chinese Tea Wiki (chinesetea.life) — use for brew temp/time or a short description ONLY if the listing is thin:\n${lifeHit.name}: ${lifeHit.description}\nFlavor: ${lifeHit.flavor}\nBrewing: ${lifeHit.brewing}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const parsed = await grokJson(LISTING_SYSTEM, userParts);
    const photoUrl = "";
    const listingUrl = scraped.listingUrl;
    const extras = {
      photoUrl,
      listingUrl,
      tempC: listingRange?.tempC ?? lifeHint.tempC,
      tempLowC: listingRange?.tempLowC ?? lifeHint.tempLowC,
      tempHighC: listingRange?.tempHighC ?? lifeHint.tempHighC,
      time: listingTime,
    };

    if (!parsed.ok) {
      const fallbackDesc =
        scraped.meta ||
        scraped.text.slice(0, 600) ||
        (lifeHit ? `${lifeHit.description} ${lifeHit.flavor}`.trim() : "") ||
        wiki?.extract ||
        "";
      return {
        ok: true,
        from,
        photos,
        tea: normalize(
          {
            name: scraped.title.replace(/\s*[|\-–].*$/, "").trim() || q,
            description: fallbackDesc,
            descriptionSource: scraped.meta || scraped.text.length > 180 ? "listing" : "general",
            vendorGuess: hostOf(listingUrl),
          },
          q,
          from,
          extras,
        ),
      };
    }

    const grokHasDesc = parsed.data.listingHasDescription !== false && asString(parsed.data.description).length > 0;
    return {
      ok: true,
      from,
      photos,
      tea: normalize(parsed.data, q, from, {
        ...extras,
        descriptionSource: grokHasDesc ? "listing" : "general",
        tempC: listingRange?.tempC ?? extras.tempC,
        tempLowC: listingRange?.tempLowC ?? extras.tempLowC,
        tempHighC: listingRange?.tempHighC ?? extras.tempHighC,
        time: listingTime,
      }),
    };
  });

export const promptUnknownTea = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      clues: z.string().trim().max(2000).default(""),
      appearance: z.string().trim().max(500).default(""),
      dryAroma: z.string().trim().max(500).default(""),
      acquiredFrom: z.string().trim().max(400).default(""),
      suspectedType: z.string().trim().max(40).optional(),
    }),
  )
  .handler(async ({ data }): Promise<PromptResult> => {
    const bits = [
      data.clues ? `What they know: ${data.clues}` : "What they know: almost nothing — unlabeled or forgotten.",
      data.appearance ? `Dry leaf / wrapper: ${data.appearance}` : null,
      data.dryAroma ? `Dry aroma: ${data.dryAroma}` : null,
      data.acquiredFrom ? `Where it came from: ${data.acquiredFrom}` : null,
      data.suspectedType ? `They suspect the type is: ${data.suspectedType}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const parsed = await grokJson(
      "You are a Chinese tea specialist helping someone add an UNKNOWN tea to a private cellar. Identity may be a guess. Return ONLY JSON with keys: name (honest working title, e.g. 'Unknown Menghai-style ripe tuo', never invent a famous cake you cannot support), nameZh, pinyin, type (white|green|yellow|oolong|black|sheng|heicha|herbal), subtype, origin, region, cultivar, vendorGuess, yearTypical, recipe, form (cake|wedge|tuo|loose|sample), processing, description (2-4 sentences: what the clues suggest, what is uncertain), tastingNotes (array of likely notes — mark them as expected, not claimed), liquor, tempC (typical water temperature for the suspected type), restDays, aliases, guesses (1-3 objects {name, why}), prompt (plain text tasting protocol, 160-280 words, numbered sections: Dry leaf, Warm lid, Wash, Steeps 1–3, Later steeps, Wet leaf, What would confirm a guess). Direct and concrete. No marketing. If clues are thin, write a generic identification protocol for compressed Chinese tea and say so. Ripe/shou puerh is heicha, not a separate top type.",
      bits,
    );
    if (!parsed.ok) {
      if (parsed.error.includes("unavailable")) {
        return { ok: true, tea: fallbackUnknown(data) };
      }
      return { ok: false, error: parsed.error };
    }

    const lookup = normalize(parsed.data, "Unknown tea", ["Grok tasting prompt"]);
    const guesses = asGuesses(parsed.data.guesses);
    const prompt = asString(parsed.data.prompt) || GENERIC_TASTING_PROMPT;
    return {
      ok: true,
      tea: {
        ...lookup,
        unknown: true,
        guesses,
        prompt,
      },
    };
  });

export const readWrapper = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ image: z.string().min(40).max(1_800_000) }))
  .handler(async ({ data }): Promise<WrapperResult> => {
    if (!data.image.startsWith("data:image/")) {
      return { ok: false, error: "That does not look like an image." };
    }
    const parsed = await grokJson(
      "You read Chinese tea wrappers, nei fei tickets, and vendor screenshots. Return ONLY JSON with keys: factory, recipe (e.g. 7542, 8582, V93, 8653), year (four digits or empty), name (English short name), nameZh, pinyin, vendor, type (white|green|yellow|oolong|black|sheng|heicha|herbal), subtype. Transcribe what is visible. If a field is unreadable, use an empty string. Do not invent a famous cake. Ripe/shou puerh is type heicha.",
      [
        {
          type: "text",
          text: "Read this wrapper, inner ticket, or shop screenshot for factory, recipe number, year, Chinese name, pinyin, and vendor.",
        },
        { type: "image_url", image_url: { url: data.image } },
      ],
    );
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return {
      ok: true,
      factory: asString(parsed.data.factory),
      recipe: asString(parsed.data.recipe),
      year: asString(parsed.data.year) || asString(parsed.data.yearTypical),
      name: asString(parsed.data.name),
      nameZh: asString(parsed.data.nameZh),
      pinyin: asString(parsed.data.pinyin),
      vendor: asString(parsed.data.vendor) || asString(parsed.data.vendorGuess),
      type: coerceType(parsed.data.type, asString(parsed.data.subtype)),
    };
  });

export type GuessInfoResult =
  | { ok: true; teas: TeaLookup[]; from: string[] }
  | { ok: false; error: string };

export const guessTeaInfo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().max(220).default(""),
      type: z.string().trim().max(40).optional(),
      subtype: z.string().trim().max(120).optional(),
      origin: z.string().trim().max(240).optional(),
      vendor: z.string().trim().max(200).optional(),
      notes: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<GuessInfoResult> => {
    const name = data.name.trim();
    if (!name && !data.subtype && !data.type) {
      return { ok: false, error: "Type a name, or pick a type, then try again." };
    }
    try {
      const result = await genericFromClues({
        name: name || [data.subtype, data.type].filter(Boolean).join(" "),
        type: data.type,
        subtype: data.subtype,
        origin: data.origin,
        vendor: data.vendor,
        notes: data.notes,
      });
      if (!result.teas.length) {
        return { ok: false, error: "No matching notes found. Try a clearer name." };
      }
      return { ok: true, teas: result.teas, from: result.from };
    } catch {
      return { ok: false, error: "Could not look that tea up. Try again in a moment." };
    }
  });
