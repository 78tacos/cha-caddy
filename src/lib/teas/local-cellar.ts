import { PAGES_USER_ID } from "@/lib/static-pages";
import { teaDraftSchema, teaPatchSchema, logSteepSchema } from "./schema";
import { SEED_TEAS } from "./seed";
import type {
  CellarSettings,
  LogSteepInput,
  SharedCellar,
  SteepSession,
  Tea,
  TeaCategory,
  TeaDraft,
} from "./types";
import { defaultCellarSettings } from "./types";

const STORAGE_KEY = "cha-caddy.pages.v1";

export type LocalCellarPayload = {
  teas: Tea[];
  settings: CellarSettings;
  cellar: SharedCellar;
  meId: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function localCellarMeta(): SharedCellar {
  return {
    id: "local-cellar",
    name: "This browser",
    joinCode: "",
    role: "owner",
    homeId: "local-cellar",
    members: [
      {
        userId: PAGES_USER_ID,
        role: "owner",
        displayName: "This device",
        joinedAt: nowIso(),
      },
    ],
    memberships: [{ id: "local-cellar", name: "This browser", role: "owner" }],
  };
}

function seedPayload(): LocalCellarPayload {
  return {
    teas: SEED_TEAS.map((t) => ({
      ...t,
      comments: [],
      sessions: t.sessions.map((s) => ({ ...s })),
    })),
    settings: defaultCellarSettings(),
    cellar: localCellarMeta(),
    meId: PAGES_USER_ID,
  };
}

function readStore(): LocalCellarPayload {
  if (typeof window === "undefined") {
    return {
      teas: [],
      settings: defaultCellarSettings(),
      cellar: localCellarMeta(),
      meId: PAGES_USER_ID,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedPayload();
      writeStore(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<LocalCellarPayload>;
    return {
      teas: Array.isArray(parsed.teas) ? parsed.teas : seedPayload().teas,
      settings: { ...defaultCellarSettings(), ...(parsed.settings ?? {}) },
      cellar: parsed.cellar ?? localCellarMeta(),
      meId: parsed.meId || PAGES_USER_ID,
    };
  } catch {
    return seedPayload();
  }
}

function writeStore(payload: LocalCellarPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

function draftToTea(draft: TeaDraft, id: string, createdAt: string): Tea {
  return {
    ...draft,
    id,
    createdAt,
    lastSteepedAt: draft.lastSteepedAt ?? null,
    sessions: [],
    comments: [],
    tastingNotes: draft.tastingNotes.filter(Boolean),
    unknown: Boolean(draft.unknown),
    prompt: draft.prompt ?? "",
    lastDrinkerName: "",
    lastSteepTimes: [],
    lastVessel: "",
  };
}

export async function listCellar(): Promise<LocalCellarPayload> {
  return readStore();
}

export async function createTea(input: { data: TeaDraft }): Promise<Tea> {
  const data = teaDraftSchema.parse(input.data);
  const store = readStore();
  const tea = draftToTea(data, crypto.randomUUID(), nowIso());
  store.teas = [tea, ...store.teas];
  writeStore(store);
  return tea;
}

export async function updateTea(input: { data: { id: string; patch: Partial<Tea> } }): Promise<Tea> {
  const data = {
    id: input.data.id,
    patch: teaPatchSchema.parse(input.data.patch),
  };
  const store = readStore();
  const idx = store.teas.findIndex((t) => t.id === data.id);
  if (idx < 0) throw new Error("Tea not found");
  const current = store.teas[idx];
  const merged: Tea = {
    ...current,
    ...data.patch,
    id: current.id,
    createdAt: current.createdAt,
    sessions: current.sessions,
    comments: current.comments,
    tastingNotes: (data.patch.tastingNotes ?? current.tastingNotes).filter(Boolean),
  };
  store.teas = store.teas.map((t, i) => (i === idx ? merged : t));
  writeStore(store);
  return merged;
}

export async function removeTea(input: { data: { id: string } }): Promise<void> {
  const store = readStore();
  store.teas = store.teas.filter((t) => t.id !== input.data.id);
  writeStore(store);
}

export async function logSteep(input: { data: LogSteepInput }): Promise<SteepSession> {
  const data = logSteepSchema.parse(input.data);
  const store = readStore();
  const tea = store.teas.find((t) => t.id === data.id);
  if (!tea) throw new Error("Tea not found");
  const session: SteepSession = {
    id: crypto.randomUUID(),
    steepedAt:
      data.steepedAt && !Number.isNaN(new Date(data.steepedAt).getTime())
        ? new Date(data.steepedAt).toISOString()
        : nowIso(),
    note: data.note.trim(),
    rating: data.rating,
    userId: PAGES_USER_ID,
    authorName: "This device",
    vessel: data.vessel,
    leafGrams: data.leafGrams,
    waterMl: data.waterMl,
    waterTemp: data.waterTemp,
    infusionCount: data.infusionCount,
    liquorPhotoUrl: data.liquorPhotoUrl,
    wetLeafPhotoUrl: data.wetLeafPhotoUrl,
    steepTimes: data.steepTimes,
    tasteTags: data.tasteTags,
  };
  let remaining = tea.remainingGrams;
  if (remaining != null && session.leafGrams != null) {
    remaining = Math.max(0, Math.round((remaining - session.leafGrams) * 10) / 10);
  }
  store.teas = store.teas.map((t) =>
    t.id !== data.id
      ? t
      : {
          ...t,
          sessions: [session, ...t.sessions],
          lastSteepedAt: session.steepedAt,
          lastDrinkerName: session.authorName,
          lastSteepTimes: session.steepTimes,
          lastVessel: session.vessel,
          remainingGrams: remaining,
        },
  );
  writeStore(store);
  return session;
}

export async function setNotify(input: { data: { notify: boolean } }): Promise<void> {
  const store = readStore();
  store.settings = { ...store.settings, notify: input.data.notify };
  writeStore(store);
}

export async function setLookupPrefs(input: {
  data: { pullPhotos: boolean; confirmPhotos: boolean; lookupSources: string[] };
}): Promise<void> {
  const store = readStore();
  store.settings = { ...store.settings, ...input.data };
  writeStore(store);
}

export async function setCategories(input: { data: { categories: TeaCategory[] } }): Promise<void> {
  const store = readStore();
  store.settings = { ...store.settings, categories: input.data.categories };
  writeStore(store);
}

export async function markNotifiedToday(input: { data: { day: string } }): Promise<void> {
  const store = readStore();
  store.settings = { ...store.settings, lastNotifiedOn: input.data.day };
  writeStore(store);
}

export async function addComment(input: { data: { teaId: string; body: string } }): Promise<void> {
  const body = input.data.body.trim();
  if (!body) return;
  const store = readStore();
  store.teas = store.teas.map((t) =>
    t.id !== input.data.teaId
      ? t
      : {
          ...t,
          comments: [
            ...t.comments,
            {
              id: crypto.randomUUID(),
              teaId: t.id,
              userId: PAGES_USER_ID,
              authorName: "This device",
              body,
              createdAt: nowIso(),
            },
          ],
        },
  );
  writeStore(store);
}

export async function removeComment(input: { data: { id: string } }): Promise<void> {
  const store = readStore();
  store.teas = store.teas.map((t) => ({
    ...t,
    comments: t.comments.filter((c) => c.id !== input.data.id),
  }));
  writeStore(store);
}

export async function renameCellar(input: { data: { name: string } }): Promise<void> {
  const name = input.data.name.trim() || "This browser";
  const store = readStore();
  store.cellar = {
    ...store.cellar,
    name,
    memberships: store.cellar.memberships.map((m) =>
      m.id === store.cellar.id ? { ...m, name } : m,
    ),
  };
  writeStore(store);
}

export async function joinCellar(_input: { data: { code: string } }): Promise<never> {
  throw new Error(
    "Household sharing needs the hosted app. This GitHub Pages copy stays on this device.",
  );
}

export async function leaveCellar(): Promise<never> {
  throw new Error(
    "Household sharing needs the hosted app. This GitHub Pages copy stays on this device.",
  );
}

export async function switchCellar(_input: { data: { cellarId: string } }): Promise<void> {
  /* single local shelf */
}
