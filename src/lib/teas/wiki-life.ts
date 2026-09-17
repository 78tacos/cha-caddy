import { extractTempC, extractTempRange } from "./brew";

export type LifeEntry = {
  name: string;
  chinese: string;
  category: string;
  description: string;
  flavor: string;
  brewing: string;
};

type Cache = { at: number; entries: LifeEntry[] };

const globalRef = globalThis as typeof globalThis & { __chaLifeCache__?: Cache };

function parseLifeJs(src: string): LifeEntry[] {
  const entries: LifeEntry[] = [];
  const blocks = src.split(/\{\s*id:\s*"/).slice(1);
  for (const block of blocks) {
    const field = (key: string) => {
      const m = block.match(new RegExp(`${key}:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"));
      return (m?.[1] ?? "").replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
    };
    const name = field("name");
    const brewing = field("brewing");
    const description = field("description");
    if (!name || (!brewing && !description)) continue;
    if (["Green Tea", "Yellow Tea", "White Tea", "Oolong Tea", "Black Tea (Red Tea)", "Dark Tea"].includes(name)) {
      continue;
    }
    entries.push({
      name,
      chinese: field("chinese"),
      category: field("category"),
      description,
      flavor: field("flavor"),
      brewing,
    });
  }
  return entries;
}

export async function loadLifeWiki(): Promise<LifeEntry[]> {
  const now = Date.now();
  const hit = globalRef.__chaLifeCache__;
  if (hit && now - hit.at < 12 * 60 * 60 * 1000 && hit.entries.length > 0) return hit.entries;
  try {
    const res = await fetch("https://www.chinesetea.life/js/data.js", {
      headers: { Accept: "text/javascript,*/*", "User-Agent": "ChaCaddy/1.4 (tea cellar)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return hit?.entries ?? [];
    const src = await res.text();
    const entries = parseLifeJs(src);
    if (entries.length) globalRef.__chaLifeCache__ = { at: now, entries };
    return entries;
  } catch {
    return hit?.entries ?? [];
  }
}

const STOP = new Set(["tea", "cha", "the", "and", "with", "from", "for"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function matchLifeEntry(query: string, entries: LifeEntry[]): LifeEntry | null {
  return matchLifeEntries(query, entries, 1)[0] ?? null;
}

export function matchLifeEntries(query: string, entries: LifeEntry[], n = 3): LifeEntry[] {
  const q = tokens(query);
  if (q.length === 0 || entries.length === 0) return [];
  const scored = entries
    .map((e) => {
      const hay = tokens(`${e.name} ${e.chinese} ${e.category} ${e.description}`).join(" ");
      let score = q.filter((w) => hay.includes(w)).length;
      if (e.name.toLowerCase() === query.trim().toLowerCase()) score += 3;
      return { e, score };
    })
    .filter((r) => r.score >= 1)
    .sort((a, b) => b.score - a.score);
  const out: LifeEntry[] = [];
  const seen = new Set<string>();
  for (const row of scored) {
    if (seen.has(row.e.name)) continue;
    seen.add(row.e.name);
    out.push(row.e);
    if (out.length >= n) break;
  }
  return out;
}

export function lifeBrewHint(entry: LifeEntry | null): {
  tempC: number | null;
  tempLowC?: number;
  tempHighC?: number;
  time: string;
} {
  if (!entry?.brewing) return { tempC: null, time: "" };
  const range = extractTempRange(entry.brewing);
  return {
    tempC: range?.tempC ?? extractTempC(entry.brewing),
    tempLowC: range?.tempLowC,
    tempHighC: range?.tempHighC,
    time: gongfuTimeFromText(entry.brewing),
  };
}

export function gongfuTimeFromText(text: string): string {
  const add = text.match(
    /(\d+)\s*(?:-|–|to)?\s*(?:second|sec|s)\w*\s*(?:first|1st|early)?[\s\S]{0,40}?(?:add|then|\+|increase)[^\d]{0,24}(\d+)/i,
  );
  if (add) return `${add[1]}s, +${add[2]}s`;
  const plus = text.match(/(\d+)\s*s(?:ec(?:onds)?)?\s*,?\s*\+\s*(\d+)/i);
  if (plus) return `${plus[1]}s, +${plus[2]}s`;
  const first = text.match(
    /(\d+)\s*(?:-|–)?\s*(\d+)?\s*(?:second|sec|s)\w*(?:\s+first|\s+early|\s+steeps?)?/i,
  );
  if (first?.[1] && Number(first[1]) <= 90) {
    const n = Number(first[1]);
    const hi = first[2] ? Number(first[2]) : n + 5;
    const step = Math.max(3, Math.min(15, Math.round((hi - n) / 2) || 5));
    return `${n}s, +${step}s`;
  }
  if (/gongfu|short steep|flash|quick rinse|repeated steep/i.test(text)) return "10s, +5s";
  return "";
}
