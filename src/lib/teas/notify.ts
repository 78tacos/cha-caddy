import { selectReminderTeas } from "./store";
import type { Tea } from "./types";
import { daysSince, todayKey } from "./dates";

export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function daysBetween(isoDay: string, today: string): number {
  const a = new Date(`${isoDay}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 99;
  return Math.round((b - a) / 86400000);
}

export function maybeNotifyDue(
  teas: Tea[],
  lastNotifiedOn: string | null,
  enabled: boolean,
  mark: (day: string) => void,
): void {
  if (!enabled) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const day = todayKey();
  if (lastNotifiedOn && daysBetween(lastNotifiedOn, day) < 7) return;
  const due = selectReminderTeas(teas, 5);
  if (due.length === 0) return;

  const oldest = due[0];
  const oldestDays = oldest ? daysSince(oldest.lastSteepedAt) : null;
  const names = due.map((t) => t.name).join(", ");
  const bits = `${due.length === 1 ? due[0].name : `${due.length} longest rests`}${
    oldest && oldestDays != null ? ` — ${oldest.name}, ${oldestDays} days` : ""
  }. ${due.length > 1 ? names : ""}`;

  try {
    new Notification("Cha Caddy — teas waiting", {
      body: bits,
      tag: "cha-caddy-weekly",
    });
    mark(day);
  } catch {
    // Preview / unsupported
  }
}
