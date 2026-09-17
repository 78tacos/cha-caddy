import type { SharedCellar, Tea, CellarSettings, LogSteepInput } from "./types";

const PREFIX = "cha-caddy.offline.";

export type CellarCache = {
  teas: Tea[];
  settings: CellarSettings;
  cellar: SharedCellar | null;
  meId: string;
  savedAt: string;
};

export type QueuedSteep = LogSteepInput & { queuedAt: string };

function key(userId: string) {
  return PREFIX + userId;
}
function qkey(userId: string) {
  return PREFIX + "q." + userId;
}

export function readCache(userId: string | undefined): CellarCache | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    return JSON.parse(raw) as CellarCache;
  } catch {
    return null;
  }
}

export function writeCache(userId: string, payload: Omit<CellarCache, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const body: CellarCache = { ...payload, savedAt: new Date().toISOString() };
    window.localStorage.setItem(key(userId), JSON.stringify(body));
  } catch {
    /* quota */
  }
}

export function readQueue(userId: string | undefined): QueuedSteep[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(qkey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedSteep[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(userId: string, queue: QueuedSteep[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(qkey(userId), JSON.stringify(queue));
  } catch {
    /* quota */
  }
}

export function enqueueSteep(userId: string, input: LogSteepInput): void {
  const queue = readQueue(userId);
  queue.push({ ...input, queuedAt: new Date().toISOString() });
  writeQueue(userId, queue);
}
