import { parseCategories, STORAGE_PLACES, TEA_FORMS, TEA_INTENTS, defaultCellarSettings, type CellarMember, type CellarSettings, type SteepSession, type Tea, type TeaComment } from "./types";
import { parsePhotos, syncPhotoFields } from "./photos";

export const BACKUP_KIND = "cha-caddy-full";
export const BACKUP_VERSION = "1.8";

export type CellarBackupShelf = {
  id: string;
  name: string;
  joinCode: string;
  role: string;
  members: CellarMember[];
  teas: Tea[];
};

export type CellarBackup = {
  kind: typeof BACKUP_KIND;
  app: "cha-caddy";
  version: string;
  exportedAt: string;
  meId: string;
  settings: CellarSettings;
  cellars: CellarBackupShelf[];
  extraTeas: Tea[];
};

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function asNumArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter((n) => Number.isFinite(n));
  return [];
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  return [];
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asSession(raw: unknown): SteepSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return {
    id: asString(s.id) || crypto.randomUUID(),
    steepedAt: asString(s.steepedAt) || new Date().toISOString(),
    note: asString(s.note),
    rating: s.rating == null ? null : Number(s.rating),
    userId: asString(s.userId),
    authorName: asString(s.authorName) || "Someone",
    vessel: asString(s.vessel),
    leafGrams: numOrNull(s.leafGrams),
    waterMl: numOrNull(s.waterMl),
    waterTemp: s.waterTemp == null ? null : Number(s.waterTemp),
    infusionCount: s.infusionCount == null ? null : Number(s.infusionCount),
    liquorPhotoUrl: asString(s.liquorPhotoUrl),
    wetLeafPhotoUrl: asString(s.wetLeafPhotoUrl),
    steepTimes: asNumArray(s.steepTimes),
    tasteTags: asStringArray(s.tasteTags),
  };
}

function asComment(raw: unknown, teaId: string): TeaComment | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const body = asString(c.body).trim();
  if (!body) return null;
  return {
    id: asString(c.id) || crypto.randomUUID(),
    teaId: asString(c.teaId) || teaId,
    userId: asString(c.userId),
    authorName: asString(c.authorName) || "Someone",
    body,
    createdAt: asString(c.createdAt) || new Date().toISOString(),
  };
}

export function asBackupTea(raw: unknown): Tea | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const name = asString(t.name).trim();
  if (!name) return null;
  const id = asString(t.id) || crypto.randomUUID();
  const form = asString(t.form);
  const storage = asString(t.storage);
  const intent = asString(t.intent);
  const synced = syncPhotoFields(parsePhotos(t.photos, asString(t.photoUrl), asString(t.wrapperPhotoUrl)));
  const sessions = Array.isArray(t.sessions)
    ? t.sessions.map(asSession).filter((s): s is SteepSession => Boolean(s))
    : [];
  const comments = Array.isArray(t.comments)
    ? t.comments.map((c) => asComment(c, id)).filter((c): c is TeaComment => Boolean(c))
    : [];
  return {
    id,
    name,
    nameZh: asString(t.nameZh),
    pinyin: asString(t.pinyin),
    type: asString(t.type) || "oolong",
    subtype: asString(t.subtype),
    origin: asString(t.origin),
    region: asString(t.region),
    cultivar: asString(t.cultivar),
    vendor: asString(t.vendor),
    year: asString(t.year),
    quantity: asString(t.quantity),
    processing: asString(t.processing),
    description: asString(t.description),
    tastingNotes: asStringArray(t.tastingNotes),
    liquor: asString(t.liquor),
    brew: t.brew && typeof t.brew === "object" ? (t.brew as Tea["brew"]) : null,
    aging: asString(t.aging),
    restDays: Number(t.restDays) || 14,
    photoUrl: synced.photoUrl,
    photos: synced.photos,
    acquiredAt: asString(t.acquiredAt),
    createdAt: asString(t.createdAt) || new Date().toISOString(),
    lastSteepedAt: t.lastSteepedAt == null || t.lastSteepedAt === "" ? null : asString(t.lastSteepedAt),
    sessions,
    comments,
    sources: asStringArray(t.sources),
    unknown: Boolean(t.unknown),
    prompt: asString(t.prompt),
    form: (TEA_FORMS as readonly string[]).includes(form) ? (form as Tea["form"]) : "loose",
    originalGrams: numOrNull(t.originalGrams),
    remainingGrams: numOrNull(t.remainingGrams),
    factory: asString(t.factory),
    recipe: asString(t.recipe),
    listingUrl: asString(t.listingUrl),
    storage: (STORAGE_PLACES as readonly string[]).includes(storage) ? (storage as Tea["storage"]) : "cabinet",
    intent: (TEA_INTENTS as readonly string[]).includes(intent) ? (intent as Tea["intent"]) : "drink",
    locked: Boolean(t.locked),
    wrapperPhotoUrl: synced.wrapperPhotoUrl,
    lastDrinkerName: asString(t.lastDrinkerName),
    lastSteepTimes: asNumArray(t.lastSteepTimes),
    lastVessel: asString(t.lastVessel),
  };
}

export function parseBackupJson(text: string): CellarBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!raw || typeof raw !== "object") throw new Error("That backup is empty.");
  const obj = raw as Record<string, unknown>;
  const looksLike =
    obj.app === "cha-caddy" ||
    obj.kind === BACKUP_KIND ||
    Array.isArray(obj.cellars) ||
    Array.isArray(obj.teas);
  if (!looksLike) throw new Error("That file is not a Cha Caddy backup.");

  const cellars: CellarBackupShelf[] = [];
  if (Array.isArray(obj.cellars)) {
    for (const row of obj.cellars) {
      if (!row || typeof row !== "object") continue;
      const c = row as Record<string, unknown>;
      const teas = Array.isArray(c.teas)
        ? c.teas.map(asBackupTea).filter((t): t is Tea => Boolean(t))
        : [];
      const members: CellarMember[] = Array.isArray(c.members)
        ? c.members
            .map((m) => {
              if (!m || typeof m !== "object") return null;
              const mem = m as Record<string, unknown>;
              return {
                userId: asString(mem.userId),
                role: mem.role === "owner" ? ("owner" as const) : ("member" as const),
                displayName: asString(mem.displayName) || "Someone",
                joinedAt: asString(mem.joinedAt) || new Date().toISOString(),
              };
            })
            .filter((m): m is CellarMember => Boolean(m))
        : [];
      cellars.push({
        id: asString(c.id),
        name: asString(c.name) || "The cellar",
        joinCode: asString(c.joinCode),
        role: asString(c.role) || "owner",
        members,
        teas,
      });
    }
  }

  const extraTeas = Array.isArray(obj.extraTeas)
    ? obj.extraTeas.map(asBackupTea).filter((t): t is Tea => Boolean(t))
    : [];
  const flatTeas = Array.isArray(obj.teas)
    ? obj.teas.map(asBackupTea).filter((t): t is Tea => Boolean(t))
    : [];
  if (!cellars.length && flatTeas.length) {
    cellars.push({
      id: "",
      name: "Restored cellar",
      joinCode: "",
      role: "owner",
      members: [],
      teas: flatTeas,
    });
  }

  const settingsRaw = obj.settings && typeof obj.settings === "object" ? (obj.settings as Record<string, unknown>) : {};
  const settings: CellarSettings = {
    ...defaultCellarSettings(),
    notify: Boolean(settingsRaw.notify),
    lastNotifiedOn: settingsRaw.lastNotifiedOn == null ? null : asString(settingsRaw.lastNotifiedOn),
    pullPhotos: settingsRaw.pullPhotos !== false,
    confirmPhotos: settingsRaw.confirmPhotos !== false,
    lookupSources: asStringArray(settingsRaw.lookupSources),
    categories: parseCategories(settingsRaw.categories),
  };

  return {
    kind: BACKUP_KIND,
    app: "cha-caddy",
    version: asString(obj.version) || BACKUP_VERSION,
    exportedAt: asString(obj.exportedAt) || new Date().toISOString(),
    meId: asString(obj.meId),
    settings,
    cellars,
    extraTeas,
  };
}

export function teasFromBackup(backup: CellarBackup): Tea[] {
  const out: Tea[] = [];
  const seen = new Set<string>();
  for (const cellar of backup.cellars) {
    for (const tea of cellar.teas) {
      if (seen.has(tea.id)) continue;
      seen.add(tea.id);
      out.push(tea);
    }
  }
  for (const tea of backup.extraTeas) {
    if (seen.has(tea.id)) continue;
    seen.add(tea.id);
    out.push(tea);
  }
  return out;
}
