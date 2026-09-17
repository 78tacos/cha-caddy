import { daysSince, isDue } from "./dates";
import { DRINK_SOON_TYPES, isLowStock, type SteepSession, type Tea } from "./types";

export function selectDue(teas: Tea[]): Tea[] {
  return teas
    .filter((t) => isDue(t) && t.intent !== "age" && t.intent !== "guest")
    .sort((a, b) => {
      const da = daysSince(a.lastSteepedAt) ?? 0;
      const db = daysSince(b.lastSteepedAt) ?? 0;
      return db - da;
    });
}

export function selectReminderTeas(teas: Tea[], n = 5): Tea[] {
  return selectDue(teas).slice(0, n);
}

export function selectUnopened(teas: Tea[]): Tea[] {
  return teas.filter((t) => !t.lastSteepedAt && t.intent !== "age");
}

export function selectAging(teas: Tea[]): Tea[] {
  return teas.filter((t) => t.intent === "age");
}

export function selectDrinkSoon(teas: Tea[]): Tea[] {
  return teas
    .filter((t) => DRINK_SOON_TYPES.includes(t.type) && t.intent !== "age")
    .sort((a, b) => {
      const aa = a.lastSteepedAt ? new Date(a.lastSteepedAt).getTime() : 0;
      const bb = b.lastSteepedAt ? new Date(b.lastSteepedAt).getTime() : 0;
      return aa - bb;
    });
}

export function selectLowStock(teas: Tea[]): Tea[] {
  return teas
    .filter((t) => isLowStock(t))
    .sort((a, b) => (a.remainingGrams ?? 0) - (b.remainingGrams ?? 0));
}

export function selectOldest(teas: Tea[]): Tea[] {
  return [...teas].sort((a, b) => {
    if (!a.lastSteepedAt && !b.lastSteepedAt) return 0;
    if (!a.lastSteepedAt) return -1;
    if (!b.lastSteepedAt) return 1;
    return new Date(a.lastSteepedAt).getTime() - new Date(b.lastSteepedAt).getTime();
  });
}

export function allSessions(teas: Tea[]): Array<SteepSession & { tea: Tea }> {
  return teas
    .flatMap((tea) => tea.sessions.map((s) => ({ ...s, tea })))
    .sort((a, b) => new Date(b.steepedAt).getTime() - new Date(a.steepedAt).getTime());
}
