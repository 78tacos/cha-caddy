import type { BrewParams } from "./types";

export const TYPE_BREW: Record<string, { tempC: number; maxF: number; first: number; step: number }> = {
  white: { tempC: 85, maxF: 195, first: 20, step: 5 },
  green: { tempC: 80, maxF: 185, first: 15, step: 5 },
  yellow: { tempC: 80, maxF: 190, first: 15, step: 5 },
  oolong: { tempC: 95, maxF: 212, first: 10, step: 5 },
  black: { tempC: 93, maxF: 208, first: 10, step: 5 },
  sheng: { tempC: 99, maxF: 212, first: 10, step: 5 },
  heicha: { tempC: 100, maxF: 212, first: 15, step: 5 },
  shou: { tempC: 100, maxF: 212, first: 15, step: 5 },
  herbal: { tempC: 96, maxF: 212, first: 20, step: 8 },
};

export function parseBrewSchedule(time: string | undefined | null): { first: number; step: number } {
  const nums = [...String(time ?? "").matchAll(/(\d+(?:\.\d+)?)\s*s/gi)].map((m) => Number(m[1]));
  const first = nums[0] && nums[0] > 0 ? nums[0] : 10;
  const step = nums[1] && nums[1] > 0 ? nums[1] : 5;
  return { first, step };
}

export function gramsFromBrew(brew: BrewParams | null | undefined): number {
  const n = Number(String(brew?.grams ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 6;
}

export function infusionTarget(brew: BrewParams | null | undefined, index: number, type = ""): number {
  const fallback = TYPE_BREW[type] ?? TYPE_BREW.oolong;
  const parsed = parseBrewSchedule(brew?.time);
  const first = brew?.time ? parsed.first : fallback.first;
  const step = brew?.time ? parsed.step : fallback.step;
  return Math.round((first + index * step) * 10) / 10;
}

export function infusionTempC(baseC: number, index: number, type = ""): number {
  const maxF = TYPE_BREW[type]?.maxF ?? 212;
  const maxC = Math.round(((maxF - 32) * 5) / 9);
  const start = Number.isFinite(baseC) && baseC >= 50 ? baseC : (TYPE_BREW[type]?.tempC ?? 95);
  return Math.min(maxC, start + index);
}

export function extractTempRange(text: string): { tempC: number; tempLowC: number; tempHighC: number } | null {
  const toCfromF = (n: number) => Math.round((((n - 32) * 5) / 9) * 10) / 10;
  const pack = (a: number, b: number) => {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    if (low < 50 || high > 100) return null;
    return { tempC: Math.round((low + high) / 2), tempLowC: low, tempHighC: high };
  };

  const fRange = text.match(
    /\b(1[6-9]\d|20\d|21[0-2])\s*°?\s*F(?:ahrenheit)?\s*(?:–|-|to|~)\s*(1[6-9]\d|20\d|21[0-2])\s*°?\s*F/i,
  );
  if (fRange?.[1] && fRange[2]) {
    const ranged = pack(toCfromF(Number(fRange[1])), toCfromF(Number(fRange[2])));
    if (ranged) return ranged;
  }
  const bareF = text.match(/\b(1[6-9]\d|20\d|21[0-2])\s*(?:–|-|to|~)\s*(1[6-9]\d|20\d|21[0-2])\b/);
  if (bareF?.[1] && bareF[2]) {
    const ranged = pack(toCfromF(Number(bareF[1])), toCfromF(Number(bareF[2])));
    if (ranged) return ranged;
  }
  const cRange = text.match(
    /\b(7\d|8\d|9\d|100)\s*°?\s*C(?:elsius)?\s*(?:–|-|to|~)\s*(7\d|8\d|9\d|100)\s*°?\s*C/i,
  );
  if (cRange?.[1] && cRange[2]) {
    const ranged = pack(Number(cRange[1]), Number(cRange[2]));
    if (ranged) return ranged;
  }
  const single = extractTempC(text);
  if (single != null) return { tempC: single, tempLowC: single, tempHighC: single };
  return null;
}

export function extractTempC(text: string): number | null {
  const range = text.match(
    /\b(7\d|8\d|9\d|100)\s*°?\s*C(?:elsius)?\s*(?:–|-|to|~)\s*(7\d|8\d|9\d|100)\s*°?\s*C/i,
  );
  if (range?.[1]) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (a >= 70 && a <= 100) return Math.round((a + (Number.isFinite(b) ? b : a)) / 2);
  }
  const c = text.match(/\b(7\d|8\d|9\d|100)\s*°?\s*C(?:elsius)?\b/i);
  if (c?.[1]) return Number(c[1]);
  const f = text.match(/\b(1[6-9]\d|20\d|21[0-2])\s*°?\s*F(?:ahrenheit)?\b/i);
  if (f?.[1]) {
    const n = Math.round(((Number(f[1]) - 32) * 5) / 9);
    if (n >= 70 && n <= 100) return n;
  }
  return null;
}

export function extractSteepTime(text: string): string {
  const plus = text.match(/(\d+)\s*s(?:ec(?:onds)?)?\s*,?\s*\+\s*(\d+)\s*s/i);
  if (plus) return `${plus[1]}s, +${plus[2]}s`;
  const seq = [...text.matchAll(/(\d+)\s*(?:second|sec|s)\b/gi)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 90);
  if (seq.length >= 2 && seq[1] >= seq[0]) {
    return `${seq[0]}s, +${Math.max(3, seq[1] - seq[0])}s`;
  }
  const gongfu = text.match(
    /(\d+)\s*(?:-|–)?\s*(\d+)?\s*(?:second|sec|s)\w*[\s\S]{0,48}(?:steep|infusion|pour)/i,
  );
  if (gongfu?.[1] && Number(gongfu[1]) <= 60) {
    const n = Number(gongfu[1]);
    return `${n}s, +5s`;
  }
  if (/gongfu|flash steep|short repeated|quick rinse/i.test(text)) return "10s, +5s";
  return "";
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}:${String(r).padStart(2, "0")}`;
}
