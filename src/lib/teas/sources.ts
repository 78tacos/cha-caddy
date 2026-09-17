/** Hosts Cha Caddy prefers when searching for listings. One host per line in settings. */
export const DEFAULT_LOOKUP_SOURCES = [
  "yunnansourcing.com",
  "white2tea.com",
  "crimsonlotustea.com",
  "farmerleaf.com",
  "teavivre.com",
  "essenceoftea.com",
  "chawangshop.com",
  "teasenz.com",
  "nannuoshan.org",
  "en.wikipedia.org",
] as const;

export type PhotoCandidate = {
  url: string;
  source: string;
  label: string;
};

export type PageHit = {
  url: string;
  title: string;
  snippet: string;
  thumbnail: string;
  host: string;
};

export const KNOWN_SHOPS: { host: string; aliases: string[] }[] = [
  { host: "white2tea.com", aliases: ["white2tea", "white 2 tea", "white two tea", "w2t"] },
  { host: "yunnansourcing.com", aliases: ["yunnan sourcing", "yunnansourcing", "yunnan-sourcing"] },
  { host: "ysofine.com", aliases: ["yso", "yunnan sourcing us"] },
  { host: "crimsonlotustea.com", aliases: ["crimson lotus", "crimsonlotustea"] },
  { host: "farmerleaf.com", aliases: ["farmer leaf", "farmerleaf"] },
  { host: "teavivre.com", aliases: ["teavivre", "tea vivre"] },
  { host: "essenceoftea.com", aliases: ["essence of tea", "essenceoftea"] },
  { host: "chawangshop.com", aliases: ["chawang", "chawangshop", "cha wang"] },
  { host: "teasenz.com", aliases: ["teasenz"] },
  { host: "nannuoshan.org", aliases: ["nannuoshan", "nannuo shan"] },
  { host: "sparrowtailteas.com", aliases: ["sparrowtail", "sparrow tail", "sparrowtail teas", "sparrow tail teas"] },
  { host: "iteaworld.com", aliases: ["iteaworld", "i tea world", "itea world", "itea"] },
  { host: "liquidproust.com", aliases: ["liquid proust", "liquidproust"] },
  { host: "bitterleafteas.com", aliases: ["bitterleaf", "bitter leaf", "bitter leaf teas"] },
  { host: "teahabitat.com", aliases: ["tea habitat", "teahabitat"] },
  { host: "floatingleaves.com", aliases: ["floating leaves", "floatingleaves"] },
  { host: "onerivertea.com", aliases: ["one river tea", "oneriver", "one river"] },
  { host: "what-cha.com", aliases: ["what-cha", "whatcha", "what cha"] },
  { host: "redblossomtea.com", aliases: ["red blossom", "redblossom"] },
  { host: "puerh.sk", aliases: ["puerh.sk"] },
  { host: "teasource.com", aliases: ["tea source"] },
];

export function normalizeHost(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  let host = trimmed;
  try {
    if (trimmed.includes("://") || trimmed.startsWith("//")) {
      host = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed).hostname;
    } else {
      host = trimmed.split("/")[0] ?? "";
    }
  } catch {
    host = trimmed.split("/")[0] ?? "";
  }
  host = host.replace(/^www\./, "").replace(/\.+$/, "");
  if (!host || host.includes(" ") || host.includes("@")) return null;
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(host)) return null;
  return host;
}

export function looksLikePageUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^www\./i.test(t) && t.includes("/")) return true;
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\/.+/i.test(t);
}

export function toListingUrl(raw: string): string {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/\//, "")}`;
}

export function parseSourceList(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/[\n,;]+/)) {
    const host = normalizeHost(line);
    if (host && !out.includes(host)) out.push(host);
  }
  return out.slice(0, 40);
}

export function formatSourceList(hosts: string[]): string {
  return hosts.join("\n");
}

export function isWikiHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "wikipedia.org" || h.endsWith(".wikipedia.org") || h === "wikimedia.org" || h.endsWith(".wikimedia.org");
}

export function shopHosts(sources: string[]): string[] {
  return sources.map((s) => normalizeHost(s)).filter((h): h is string => h != null && !isWikiHost(h));
}

export function sourcesUseWiki(sources: string[]): boolean {
  return sources.some((s) => {
    const h = normalizeHost(s);
    return h != null && isWikiHost(h);
  });
}

export function compactName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function detectShop(query: string): { host: string; remainder: string } | null {
  const q = query.toLowerCase();
  const compact = compactName(query);
  let best: { host: string; remainder: string; score: number } | null = null;
  for (const shop of KNOWN_SHOPS) {
    const keys = [shop.host.replace(/\.(com|org|net|co|life)$/i, "").replace(/\./g, ""), ...shop.aliases];
    for (const alias of keys) {
      if (!alias || alias.length < 3) continue;
      const a = compactName(alias);
      if (a.length < 4) continue;
      if (q.includes(alias) || (compact.includes(a) && a.length >= 5) || (a.includes(compact) && compact.length >= 5)) {
        const remainder = q.replace(alias, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
        const score = a === compact ? 80 : compact.includes(a) ? a.length : compact.length;
        if (!best || score > best.score) {
          best = { host: shop.host, remainder: remainder || query.trim(), score };
        }
      }
    }
  }
  if (best) return { host: best.host, remainder: best.remainder };
  const hostInQuery = query.match(/\b([a-z0-9-]+\.(?:com|org|net|co|life|shop))\b/i);
  if (hostInQuery?.[1]) {
    const host = normalizeHost(hostInQuery[1]);
    if (host) {
      const remainder = query.replace(hostInQuery[1], " ").replace(/\s+/g, " ").trim();
      return { host, remainder: remainder || query.trim() };
    }
  }
  return null;
}

export function fuzzyShops(query: string): { host: string; title: string }[] {
  const compact = compactName(query);
  if (compact.length < 3) return [];
  const hits: { host: string; title: string; score: number }[] = [];
  for (const shop of KNOWN_SHOPS) {
    const labels = [shop.host, ...shop.aliases];
    let score = 0;
    for (const label of labels) {
      const a = compactName(label);
      if (!a) continue;
      if (a === compact) score = Math.max(score, 100);
      else if (a.startsWith(compact) || compact.startsWith(a)) score = Math.max(score, 70 + Math.min(a.length, compact.length));
      else if (a.includes(compact) || compact.includes(a)) score = Math.max(score, 40 + Math.min(a.length, 20));
    }
    if (score >= 40) hits.push({ host: shop.host, title: shop.aliases[0] || shop.host, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 3).map(({ host, title }) => ({ host, title }));
}
