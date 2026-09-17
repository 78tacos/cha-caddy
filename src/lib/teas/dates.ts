import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import type { Tea } from "./types";

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return differenceInCalendarDays(new Date(), d);
}

export function isDue(tea: Tea, now = new Date()): boolean {
  if (!tea.lastSteepedAt) return false;
  const d = differenceInCalendarDays(now, new Date(tea.lastSteepedAt));
  return d >= tea.restDays;
}

export function lastSteepLabel(iso: string | null): string {
  if (!iso) return "Never steeped";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never steeped";
  if (isToday(d)) return "Steeped today";
  if (isYesterday(d)) return "Steeped yesterday";
  const days = differenceInCalendarDays(new Date(), d);
  if (days < 14) return `${formatDistanceToNowStrict(d)} ago`;
  if (days < 60) return `${days} days ago`;
  return format(d, "d MMM yyyy");
}

export function lastSteepExact(iso: string | null): string {
  if (!iso) return "Not yet tasted from this caddy";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not yet tasted from this caddy";
  return format(d, "d MMMM yyyy");
}

export function restStatus(tea: Tea): "unopened" | "due" | "resting" | "ready" {
  if (!tea.lastSteepedAt) return "unopened";
  const d = daysSince(tea.lastSteepedAt) ?? 0;
  if (d >= tea.restDays) return "due";
  if (d <= 1) return "resting";
  return "ready";
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
