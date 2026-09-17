import { useEffect, useState } from "react";

export type TempUnit = "F" | "C";

const KEY = "cha-caddy-temp-unit";

export function cToF(c: number): number {
  if (!Number.isFinite(c)) return 203;
  return Math.round((c * 9) / 5 + 32);
}

export function fToC(f: number): number {
  if (!Number.isFinite(f)) return 95;
  return ((f - 32) * 5) / 9;
}

export function formatTemp(c: number, unit: TempUnit = "F"): string {
  if (!Number.isFinite(c)) return "";
  return unit === "F" ? `${cToF(c)}°F` : `${Math.round(c)}°C`;
}

export function formatTempRange(range: string, unit: TempUnit = "F"): string {
  if (unit === "C") return range;
  return range
    .replace(
      /(\d+)\s*°?\s*C?(?:\s*[–—-]\s*)(\d+)\s*°?\s*C/gi,
      (_, a: string, b: string) => `${cToF(Number(a))}–${cToF(Number(b))}°F`,
    )
    .replace(/(\d+)\s*°?\s*C/gi, (_, n: string) => `${cToF(Number(n))}°F`)
    .replace(/°C/g, "°F");
}

export type BrewTemps = {
  tempC: number;
  tempLowC: number;
  tempHighC: number;
};

function clampC(n: number): number {
  return Math.min(100, Math.max(50, Math.round(n * 10) / 10));
}

/** Parse a typed field like "195-205", "195–205°F", "90", "80-85C". Trust the unit toggle unless the text names °C/°F. */
export function parseTempField(raw: string, unit: TempUnit): BrewTemps | null {
  const t = raw
    .trim()
    .replace(/°/g, "")
    .replace(/\b(deg(?:ree)?s?)\b/gi, "")
    .replace(/\bto\b/gi, "-")
    .replace(/[–—~]/g, "-")
    .replace(/,/g, ".");
  const nums = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  const hasF = /f(?:ahrenheit)?/i.test(t);
  const hasC = /c(?:elsius)?/i.test(t);
  const toC = (n: number) => {
    const asF = hasF || n > 120 || (!hasC && unit === "F");
    return clampC(asF ? fToC(n) : n);
  };
  const a = toC(nums[0] ?? 95);
  const b = nums[1] != null ? toC(nums[1]) : a;
  const tempLowC = Math.min(a, b);
  const tempHighC = Math.max(a, b);
  return { tempC: Math.round((tempLowC + tempHighC) / 2), tempLowC, tempHighC };
}

export function displayTempField(
  brew: { tempC?: number; tempLowC?: number; tempHighC?: number } | null | undefined,
  unit: TempUnit,
): string {
  const mid = brew?.tempC ?? 95;
  const low = brew?.tempLowC ?? mid;
  const high = brew?.tempHighC ?? mid;
  if (Math.abs(high - low) >= 1) {
    return unit === "F" ? `${cToF(low)}–${cToF(high)}` : `${Math.round(low)}–${Math.round(high)}`;
  }
  return String(unit === "F" ? cToF(mid) : Math.round(mid));
}

export function formatBrewTemp(
  brew: { tempC?: number; tempLowC?: number; tempHighC?: number } | null | undefined,
  unit: TempUnit = "F",
): string {
  const text = displayTempField(brew, unit);
  return text ? `${text}°${unit}` : "";
}

export function readTempUnit(): TempUnit {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "C" || v === "F") return v;
  } catch {
    /* ignore */
  }
  return "F";
}

export function useTempUnit() {
  const [unit, setUnit] = useState<TempUnit>("F");
  useEffect(() => {
    setUnit(readTempUnit());
  }, []);
  function toggle() {
    setUnit((u) => {
      const next: TempUnit = u === "F" ? "C" : "F";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  return {
    unit,
    toggle,
    format: (c: number) => formatTemp(c, unit),
  };
}
