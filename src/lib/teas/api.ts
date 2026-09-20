import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { dbSource, getPglite, getSql, type Sql } from "@/lib/db";
import { logSteepSchema, teaCategorySchema, teaDraftSchema, teaPatchSchema } from "./schema";
import { SEED_TEAS } from "./seed";
import { BACKUP_KIND, BACKUP_VERSION, parseBackupJson, teasFromBackup } from "./backup";
import type {
  BrewParams,
  CellarMember,
  CellarSettings,
  SharedCellar,
  SteepSession,
  StoragePlace,
  Tea,
  TeaComment,
  TeaDraft,
  TeaForm,
  TeaIntent,
} from "./types";
import { STORAGE_PLACES, TEA_FORMS, TEA_INTENTS, normalizeTeaType, parseCategories } from "./types";
import { DEFAULT_LOOKUP_SOURCES, normalizeHost } from "./sources";
import { normalizeJoinCode } from "./codes";
import { parsePhotos, syncPhotoFields } from "./photos";
import { isWorkspacePreview } from "@/lib/env.server";

type TeaRow = {
  id: string;
  cellar_id: string | null;
  name: string;
  name_zh: string;
  pinyin: string;
  type: string;
  subtype?: string;
  origin: string;
  region: string;
  cultivar: string;
  vendor: string;
  year: string;
  quantity: string;
  processing: string;
  description: string;
  tasting_notes: unknown;
  liquor: string;
  brew: unknown;
  aging: string;
  rest_days: number;
  photo_url: string;
  acquired_at: string;
  created_at: unknown;
  last_steeped_at: unknown;
  sources: unknown;
  unknown: boolean;
  prompt: string;
  form?: string;
  original_grams?: unknown;
  remaining_grams?: unknown;
  factory?: string;
  recipe?: string;
  listing_url?: string;
  storage?: string;
  intent?: string;
  locked?: boolean;
  wrapper_photo_url?: string;
  photos?: unknown;
  last_drinker_name?: string;
  last_steep_times?: unknown;
  last_vessel?: string;
};

type SessionRow = {
  id: string;
  tea_id: string;
  user_id: string;
  author_name: string;
  steeped_at: unknown;
  note: string;
  rating: number | null;
  vessel?: string;
  leaf_grams?: unknown;
  water_ml?: unknown;
  water_temp?: number | null;
  infusion_count?: number | null;
  liquor_photo_url?: string;
  wet_leaf_photo_url?: string;
  steep_times?: unknown;
  taste_tags?: unknown;
};

type CommentRow = {
  id: string;
  tea_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: unknown;
};

type SettingsRow = {
  notify: boolean;
  last_notified_on: string | null;
  seeded: boolean;
  active_cellar_id: string | null;
  pull_photos?: boolean;
  confirm_photos?: boolean;
  lookup_sources?: unknown;
  categories?: unknown;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function iso(value: unknown, fallback = new Date().toISOString()): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) return value;
  return fallback;
}

function isoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapSettings(row: SettingsRow | undefined): CellarSettings {
  let lookupSources: string[];
  if (row?.lookup_sources == null) {
    lookupSources = [...DEFAULT_LOOKUP_SOURCES];
  } else {
    lookupSources = asStringArray(row.lookup_sources)
      .map((s) => normalizeHost(s))
      .filter((h): h is string => Boolean(h));
  }
  return {
    notify: Boolean(row?.notify),
    lastNotifiedOn: row?.last_notified_on ?? null,
    pullPhotos: row?.pull_photos !== false,
    confirmPhotos: row?.confirm_photos !== false,
    lookupSources,
    categories: parseCategories(row?.categories),
  };
}

function asNumArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter((n) => Number.isFinite(n));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asTempC(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 50 || n > 100) return undefined;
  return Math.round(n * 10) / 10;
}

function asBrew(value: unknown): BrewParams | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Record<string, unknown>;
  const tempC = asTempC(b.tempC) ?? 95;
  const tempLowC = asTempC(b.tempLowC);
  const tempHighC = asTempC(b.tempHighC);
  return {
    vessel: String(b.vessel ?? "Gaiwan 100ml"),
    grams: String(b.grams ?? "6g"),
    tempC,
    ...(tempLowC != null ? { tempLowC } : {}),
    ...(tempHighC != null ? { tempHighC } : {}),
    rinse: String(b.rinse ?? "5s rinse"),
    time: String(b.time ?? "10s, +5s"),
    infusions: String(b.infusions ?? "8+"),
  };
}

function asForm(value: unknown): TeaForm {
  const s = String(value ?? "cake");
  return (TEA_FORMS as readonly string[]).includes(s) ? (s as TeaForm) : "cake";
}

function asStorage(value: unknown): StoragePlace {
  const s = String(value ?? "cabinet");
  return (STORAGE_PLACES as readonly string[]).includes(s) ? (s as StoragePlace) : "cabinet";
}

function asIntent(value: unknown): TeaIntent {
  const s = String(value ?? "drink");
  return (TEA_INTENTS as readonly string[]).includes(s) ? (s as TeaIntent) : "drink";
}

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export { formatJoinCode, normalizeJoinCode } from "./codes";

async function uniqueCode(sql: Sql): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = makeCode();
    const rows = await sql.query<{ id: string }>(`select id from cellars where join_code = $1`, [code]);
    if (!rows[0]) return code;
  }
  return makeCode() + makeCode().slice(0, 2);
}

async function actorName(sql: Sql, userId: string): Promise<string> {
  const rows = await sql.query<{ name: string; email: string }>(
    `select name, email from "user" where id = $1`,
    [userId],
  );
  const name = rows[0]?.name?.trim();
  if (name) return name;
  const email = rows[0]?.email?.trim();
  if (email) return email.split("@")[0] || "Someone";
  return "Someone";
}

function mapSession(row: SessionRow): SteepSession {
  return {
    id: row.id,
    steepedAt: iso(row.steeped_at),
    note: row.note ?? "",
    rating: row.rating == null ? null : Number(row.rating),
    userId: row.user_id,
    authorName: row.author_name || "Someone",
    vessel: row.vessel ?? "",
    leafGrams: numOrNull(row.leaf_grams),
    waterMl: numOrNull(row.water_ml),
    waterTemp: row.water_temp == null ? null : Number(row.water_temp),
    infusionCount: row.infusion_count == null ? null : Number(row.infusion_count),
    liquorPhotoUrl: row.liquor_photo_url ?? "",
    wetLeafPhotoUrl: row.wet_leaf_photo_url ?? "",
    steepTimes: asNumArray(row.steep_times),
    tasteTags: asStringArray(row.taste_tags),
  };
}

function mapTea(row: TeaRow, sessions: SteepSession[], comments: TeaComment[]): Tea {
  const norm = normalizeTeaType(row.type, row.subtype ?? "");
  const synced = syncPhotoFields(parsePhotos(row.photos, row.photo_url ?? "", row.wrapper_photo_url ?? ""));
  return {
    id: row.id,
    name: row.name,
    nameZh: row.name_zh,
    pinyin: row.pinyin,
    type: norm.type,
    subtype: norm.subtype,
    origin: row.origin,
    region: row.region,
    cultivar: row.cultivar,
    vendor: row.vendor,
    year: row.year,
    quantity: row.quantity,
    processing: row.processing,
    description: row.description,
    tastingNotes: asStringArray(row.tasting_notes),
    liquor: row.liquor,
    brew: asBrew(row.brew),
    aging: row.aging,
    restDays: Number(row.rest_days) || 14,
    photoUrl: synced.photoUrl,
    photos: synced.photos,
    acquiredAt: row.acquired_at ?? "",
    createdAt: iso(row.created_at),
    lastSteepedAt: isoOrNull(row.last_steeped_at),
    sessions,
    comments,
    sources: asStringArray(row.sources),
    unknown: Boolean(row.unknown),
    prompt: row.prompt ?? "",
    form: asForm(row.form),
    originalGrams: numOrNull(row.original_grams),
    remainingGrams: numOrNull(row.remaining_grams),
    factory: row.factory ?? "",
    recipe: row.recipe ?? "",
    listingUrl: row.listing_url ?? "",
    storage: asStorage(row.storage),
    intent: asIntent(row.intent),
    locked: Boolean(row.locked),
    wrapperPhotoUrl: synced.wrapperPhotoUrl,
    lastDrinkerName: row.last_drinker_name ?? "",
    lastSteepTimes: asNumArray(row.last_steep_times),
    lastVessel: row.last_vessel ?? "",
  };
}

async function insertTeaRow(sql: Sql, userId: string, cellarId: string, tea: Tea): Promise<void> {
  const synced = syncPhotoFields(parsePhotos(tea.photos, tea.photoUrl, tea.wrapperPhotoUrl));
  await sql.query(
    `insert into teas (
      id, user_id, cellar_id, name, name_zh, pinyin, type, subtype, origin, region, cultivar, vendor,
      year, quantity, processing, description, tasting_notes, liquor, brew, aging,
      rest_days, photo_url, acquired_at, created_at, last_steeped_at, sources, unknown, prompt,
      form, original_grams, remaining_grams, factory, recipe, listing_url, storage, intent,
      locked, wrapper_photo_url, last_drinker_name, last_steep_times, last_vessel, photos
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17::jsonb,$18,$19::jsonb,$20,
      $21,$22,$23,$24,$25,$26::jsonb,$27,$28,
      $29,$30,$31,$32,$33,$34,$35,$36,
      $37,$38,$39,$40::jsonb,$41,$42::jsonb
    )`,
    [
      tea.id,
      userId,
      cellarId,
      tea.name,
      tea.nameZh,
      tea.pinyin,
      tea.type,
      tea.subtype ?? "",
      tea.origin,
      tea.region,
      tea.cultivar,
      tea.vendor,
      tea.year,
      tea.quantity,
      tea.processing,
      tea.description,
      JSON.stringify(tea.tastingNotes),
      tea.liquor,
      tea.brew ? JSON.stringify(tea.brew) : null,
      tea.aging,
      tea.restDays,
      synced.photoUrl,
      tea.acquiredAt,
      tea.createdAt,
      tea.lastSteepedAt,
      JSON.stringify(tea.sources),
      tea.unknown,
      tea.prompt,
      tea.form,
      tea.originalGrams,
      tea.remainingGrams,
      tea.factory,
      tea.recipe,
      tea.listingUrl,
      tea.storage,
      tea.intent,
      tea.locked,
      synced.wrapperPhotoUrl,
      tea.lastDrinkerName,
      JSON.stringify(tea.lastSteepTimes),
      tea.lastVessel,
      JSON.stringify(synced.photos),
    ],
  );
  for (const session of tea.sessions) {
    await sql.query(
      `insert into steep_sessions (
        id, tea_id, user_id, author_name, steeped_at, note, rating,
        vessel, leaf_grams, water_ml, water_temp, infusion_count,
        liquor_photo_url, wet_leaf_photo_url, steep_times, taste_tags
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)`,
      [
        session.id,
        tea.id,
        session.userId || userId,
        session.authorName || "Archive",
        session.steepedAt,
        session.note,
        session.rating,
        session.vessel,
        session.leafGrams,
        session.waterMl,
        session.waterTemp,
        session.infusionCount,
        session.liquorPhotoUrl,
        session.wetLeafPhotoUrl,
        JSON.stringify(session.steepTimes),
        JSON.stringify(session.tasteTags),
      ],
    );
  }
  for (const comment of tea.comments ?? []) {
    await sql.query(
      `insert into tea_comments (id, tea_id, cellar_id, user_id, author_name, body, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do nothing`,
      [
        comment.id || crypto.randomUUID(),
        tea.id,
        cellarId,
        comment.userId || userId,
        comment.authorName || "Someone",
        comment.body,
        comment.createdAt || new Date().toISOString(),
      ],
    );
  }
}

async function loadMembers(sql: Sql, cellarId: string): Promise<CellarMember[]> {
  const rows = await sql.query<{
    user_id: string;
    role: string;
    display_name: string;
    joined_at: unknown;
  }>(
    `select user_id, role, display_name, joined_at from cellar_members where cellar_id = $1 order by joined_at asc`,
    [cellarId],
  );
  return rows.map((r) => ({
    userId: r.user_id,
    role: r.role === "owner" ? "owner" : "member",
    displayName: r.display_name || "Someone",
    joinedAt: iso(r.joined_at),
  }));
}

async function createHomeCellar(sql: Sql, userId: string, cellarName: string, displayName: string): Promise<string> {
  const id = crypto.randomUUID();
  const code = await uniqueCode(sql);
  await sql.query(`insert into cellars (id, name, join_code, created_by) values ($1,$2,$3,$4)`, [
    id,
    cellarName,
    code,
    userId,
  ]);
  await sql.query(
    `insert into cellar_members (cellar_id, user_id, role, display_name)
     values ($1,$2,'owner',$3)
     on conflict (cellar_id, user_id) do nothing`,
    [id, userId, displayName],
  );
  return id;
}

async function ensureCellar(sql: Sql, userId: string): Promise<string> {
  const settingsRows = await sql.query<SettingsRow>(
    `select notify, last_notified_on, seeded, active_cellar_id from cellar_settings where user_id = $1`,
    [userId],
  );
  const settings = settingsRows[0];
  const name = await actorName(sql, userId);

  if (settings?.active_cellar_id) {
    const member = await sql.query<{ user_id: string }>(
      `select user_id from cellar_members where cellar_id = $1 and user_id = $2`,
      [settings.active_cellar_id, userId],
    );
    if (member[0]) return settings.active_cellar_id;
  }

  const memberships = await sql.query<{ cellar_id: string }>(
    `select cellar_id from cellar_members where user_id = $1 order by joined_at asc`,
    [userId],
  );
  if (memberships[0]) {
    await sql.query(
      `insert into cellar_settings (user_id, seeded, active_cellar_id)
       values ($1, true, $2)
       on conflict (user_id) do update set active_cellar_id = excluded.active_cellar_id`,
      [userId, memberships[0].cellar_id],
    );
    return memberships[0].cellar_id;
  }

  const cellarId = await createHomeCellar(sql, userId, `${name}'s cellar`, name);
  await sql.query(`update teas set cellar_id = $1 where user_id = $2 and cellar_id is null`, [
    cellarId,
    userId,
  ]);

  const teaCount = await sql.query<{ n: number }>(
    `select count(*)::int as n from teas where cellar_id = $1`,
    [cellarId],
  );
  const alreadySeeded = Boolean(settings?.seeded);
  if (!alreadySeeded && Number(teaCount[0]?.n ?? 0) === 0) {
    for (const seed of SEED_TEAS) {
      await insertTeaRow(sql, userId, cellarId, {
        ...seed,
        id: crypto.randomUUID(),
        sessions: seed.sessions.map((s) => ({ ...s, id: crypto.randomUUID() })),
        comments: [],
        unknown: false,
        prompt: "",
      });
    }
  }

  await sql.query(
    `insert into cellar_settings (user_id, notify, last_notified_on, seeded, active_cellar_id)
     values ($1, false, null, true, $2)
     on conflict (user_id) do update set seeded = true, active_cellar_id = excluded.active_cellar_id`,
    [userId, cellarId],
  );
  return cellarId;
}

async function assertMember(
  sql: Sql,
  userId: string,
  cellarId: string,
): Promise<{ role: "owner" | "member" }> {
  const rows = await sql.query<{ role: string }>(
    `select role from cellar_members where cellar_id = $1 and user_id = $2`,
    [cellarId, userId],
  );
  if (!rows[0]) throw new Error("Not in this cellar");
  return { role: rows[0].role === "owner" ? "owner" : "member" };
}

async function loadCellarPayload(sql: Sql, userId: string) {
  const cellarId = await ensureCellar(sql, userId);
  const cellarRows = await sql.query<{
    id: string;
    name: string;
    join_code: string;
    created_by: string;
  }>(`select id, name, join_code, created_by from cellars where id = $1`, [cellarId]);
  const cellarRow = cellarRows[0];
  const members = await loadMembers(sql, cellarId);
  const me = members.find((m) => m.userId === userId);
  const home = await sql.query<{ cellar_id: string }>(
    `select cellar_id from cellar_members where user_id = $1 and role = 'owner' order by joined_at asc`,
    [userId],
  );

  const teaRows = await sql.query<TeaRow>(
    `select * from teas where cellar_id = $1 order by created_at desc`,
    [cellarId],
  );
  const sessionRows = await sql.query<SessionRow>(
    `select s.*
     from steep_sessions s
     join teas t on t.id = s.tea_id
     where t.cellar_id = $1
     order by s.steeped_at desc`,
    [cellarId],
  );
  const commentRows = await sql.query<CommentRow>(
    `select id, tea_id, user_id, author_name, body, created_at
     from tea_comments where cellar_id = $1
     order by created_at asc`,
    [cellarId],
  );

  const sessionsByTea = new Map<string, SteepSession[]>();
  for (const row of sessionRows) {
    const list = sessionsByTea.get(row.tea_id) ?? [];
    list.push(mapSession(row));
    sessionsByTea.set(row.tea_id, list);
  }
  const commentsByTea = new Map<string, TeaComment[]>();
  for (const row of commentRows) {
    const list = commentsByTea.get(row.tea_id) ?? [];
    list.push({
      id: row.id,
      teaId: row.tea_id,
      userId: row.user_id,
      authorName: row.author_name || "Someone",
      body: row.body,
      createdAt: iso(row.created_at),
    });
    commentsByTea.set(row.tea_id, list);
  }

  const teas = teaRows.map((row) =>
    mapTea(row, sessionsByTea.get(row.id) ?? [], commentsByTea.get(row.id) ?? []),
  );

  const settingsRows = await sql.query<SettingsRow>(
    `select notify, last_notified_on, seeded, active_cellar_id, pull_photos, confirm_photos, lookup_sources, categories from cellar_settings where user_id = $1`,
    [userId],
  );
  const settings: CellarSettings = mapSettings(settingsRows[0]);

  const membershipRows = await sql.query<{ id: string; name: string; role: string }>(
    `select c.id, c.name, m.role
     from cellar_members m
     join cellars c on c.id = m.cellar_id
     where m.user_id = $1
     order by case when m.role = 'owner' then 0 else 1 end, c.name asc`,
    [userId],
  );

  const cellar: SharedCellar = {
    id: cellarId,
    name: cellarRow?.name ?? "The cellar",
    joinCode: cellarRow?.join_code ?? "",
    role: me?.role ?? "member",
    homeId: home[0]?.cellar_id ?? null,
    members,
    memberships: membershipRows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role === "owner" ? "owner" : "member",
    })),
  };

  return { teas, settings, cellar, meId: userId };
}

function draftToTea(draft: TeaDraft, id: string, createdAt: string): Tea {
  const synced = syncPhotoFields(parsePhotos(draft.photos, draft.photoUrl, draft.wrapperPhotoUrl));
  return {
    ...draft,
    ...synced,
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

export const listCellar = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return loadCellarPayload(sql, context.userId);
  });

export const createTea = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => teaDraftSchema.parse(input))
  .handler(async ({ context, data }): Promise<Tea> => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const tea = draftToTea(data, crypto.randomUUID(), new Date().toISOString());
    await insertTeaRow(sql, context.userId, cellarId, tea);
    return tea;
  });

export const updateTea = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().min(1).max(80),
      patch: teaPatchSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const { role } = await assertMember(sql, context.userId, cellarId);
    const existing = await sql.query<TeaRow>(
      `select * from teas where id = $1 and cellar_id = $2`,
      [data.id, cellarId],
    );
    const row = existing[0];
    if (!row) throw new Error("Tea not found");
    const current = mapTea(row, [], []);
    if (data.patch.locked === false && current.locked && role !== "owner") {
      throw new Error("Only the owner can unlock this cake.");
    }
    if (data.patch.locked === true && role !== "owner") {
      throw new Error("Only the owner can lock a cake.");
    }
    const merged: Tea = {
      ...current,
      ...data.patch,
      id: current.id,
      createdAt: current.createdAt,
      sessions: current.sessions,
      comments: current.comments,
      tastingNotes: (data.patch.tastingNotes ?? current.tastingNotes).filter(Boolean),
    };
    const synced = syncPhotoFields(parsePhotos(merged.photos, merged.photoUrl, merged.wrapperPhotoUrl));
    merged.photos = synced.photos;
    merged.photoUrl = synced.photoUrl;
    merged.wrapperPhotoUrl = synced.wrapperPhotoUrl;
    await sql.query(
      `update teas set
        name = $3, name_zh = $4, pinyin = $5, type = $6, subtype = $7, origin = $8, region = $9,
        cultivar = $10, vendor = $11, year = $12, quantity = $13, processing = $14,
        description = $15, tasting_notes = $16::jsonb, liquor = $17, brew = $18::jsonb,
        aging = $19, rest_days = $20, photo_url = $21, acquired_at = $22,
        last_steeped_at = $23, sources = $24::jsonb, unknown = $25, prompt = $26,
        form = $27, original_grams = $28, remaining_grams = $29, factory = $30, recipe = $31,
        listing_url = $32, storage = $33, intent = $34, locked = $35, wrapper_photo_url = $36,
        last_steep_times = $37::jsonb, photos = $38::jsonb
       where id = $1 and cellar_id = $2`,
      [
        data.id,
        cellarId,
        merged.name,
        merged.nameZh,
        merged.pinyin,
        merged.type,
        merged.subtype ?? "",
        merged.origin,
        merged.region,
        merged.cultivar,
        merged.vendor,
        merged.year,
        merged.quantity,
        merged.processing,
        merged.description,
        JSON.stringify(merged.tastingNotes),
        merged.liquor,
        merged.brew ? JSON.stringify(merged.brew) : null,
        merged.aging,
        merged.restDays,
        merged.photoUrl,
        merged.acquiredAt,
        merged.lastSteepedAt,
        JSON.stringify(merged.sources),
        merged.unknown,
        merged.prompt,
        merged.form,
        merged.originalGrams,
        merged.remainingGrams,
        merged.factory,
        merged.recipe,
        merged.listingUrl,
        merged.storage,
        merged.intent,
        merged.locked,
        merged.wrapperPhotoUrl,
        JSON.stringify(merged.lastSteepTimes ?? []),
        JSON.stringify(merged.photos),
      ],
    );
    return merged;
  });

export const removeTea = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    await sql.query(`delete from teas where id = $1 and cellar_id = $2`, [data.id, cellarId]);
  });

export const logSteep = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => logSteepSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const { role } = await assertMember(sql, context.userId, cellarId);
    const owned = await sql.query<TeaRow>(
      `select * from teas where id = $1 and cellar_id = $2`,
      [data.id, cellarId],
    );
    const row = owned[0];
    if (!row) throw new Error("Tea not found");
    const tea = mapTea(row, [], []);
    if (tea.locked && role !== "owner") {
      throw new Error("This cake is locked. Ask the owner to unlock it before a session.");
    }
    const authorName = await actorName(sql, context.userId);
    const session: SteepSession = {
      id: crypto.randomUUID(),
      steepedAt: data.steepedAt && !Number.isNaN(new Date(data.steepedAt).getTime())
        ? new Date(data.steepedAt).toISOString()
        : new Date().toISOString(),
      note: data.note.trim(),
      rating: data.rating,
      userId: context.userId,
      authorName,
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
    await sql.query(
      `insert into steep_sessions (
        id, tea_id, user_id, author_name, steeped_at, note, rating,
        vessel, leaf_grams, water_ml, water_temp, infusion_count,
        liquor_photo_url, wet_leaf_photo_url, steep_times, taste_tags
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)`,
      [
        session.id,
        data.id,
        context.userId,
        authorName,
        session.steepedAt,
        session.note,
        session.rating,
        session.vessel,
        session.leafGrams,
        session.waterMl,
        session.waterTemp,
        session.infusionCount,
        session.liquorPhotoUrl,
        session.wetLeafPhotoUrl,
        JSON.stringify(session.steepTimes),
        JSON.stringify(session.tasteTags),
      ],
    );

    let remaining = tea.remainingGrams;
    if (remaining != null && session.leafGrams != null) {
      remaining = Math.max(0, Math.round((remaining - session.leafGrams) * 10) / 10);
    }

    await sql.query(
      `update teas set
        last_steeped_at = $3,
        last_drinker_name = $4,
        last_steep_times = $5::jsonb,
        last_vessel = $6,
        remaining_grams = $7
       where id = $1 and cellar_id = $2`,
      [
        data.id,
        cellarId,
        session.steepedAt,
        authorName,
        JSON.stringify(session.steepTimes),
        session.vessel,
        remaining,
      ],
    );
    return session;
  });

export const setNotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ notify: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into cellar_settings (user_id, notify, seeded)
       values ($1, $2, true)
       on conflict (user_id) do update set notify = excluded.notify`,
      [context.userId, data.notify],
    );
  });

export const setLookupPrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      pullPhotos: z.boolean(),
      confirmPhotos: z.boolean(),
      lookupSources: z.array(z.string().max(200)).max(40),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const hosts = data.lookupSources
      .map((s) => normalizeHost(s))
      .filter((h): h is string => Boolean(h));
    await sql.query(
      `insert into cellar_settings (user_id, seeded, pull_photos, confirm_photos, lookup_sources)
       values ($1, true, $2, $3, $4::jsonb)
       on conflict (user_id) do update set
         pull_photos = excluded.pull_photos,
         confirm_photos = excluded.confirm_photos,
         lookup_sources = excluded.lookup_sources`,
      [context.userId, data.pullPhotos, data.confirmPhotos, JSON.stringify(hosts)],
    );
    return { pullPhotos: data.pullPhotos, confirmPhotos: data.confirmPhotos, lookupSources: hosts };
  });

export const setCategories = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ categories: z.array(teaCategorySchema).min(1).max(16) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const categories = parseCategories(data.categories);
    await sql.query(
      `insert into cellar_settings (user_id, seeded, categories)
       values ($1, true, $2::jsonb)
       on conflict (user_id) do update set categories = excluded.categories`,
      [context.userId, JSON.stringify(categories)],
    );
    return { categories };
  });

export const markNotifiedToday = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ day: z.string().min(8).max(12) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into cellar_settings (user_id, last_notified_on, seeded)
       values ($1, $2, true)
       on conflict (user_id) do update set last_notified_on = excluded.last_notified_on`,
      [context.userId, data.day],
    );
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      teaId: z.string().min(1).max(80),
      body: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const tea = await sql.query<{ id: string }>(
      `select id from teas where id = $1 and cellar_id = $2`,
      [data.teaId, cellarId],
    );
    if (!tea[0]) throw new Error("Tea not found");
    const authorName = await actorName(sql, context.userId);
    const comment: TeaComment = {
      id: crypto.randomUUID(),
      teaId: data.teaId,
      userId: context.userId,
      authorName,
      body: data.body,
      createdAt: new Date().toISOString(),
    };
    await sql.query(
      `insert into tea_comments (id, tea_id, cellar_id, user_id, author_name, body, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [comment.id, comment.teaId, cellarId, context.userId, authorName, comment.body, comment.createdAt],
    );
    await sql.query(
      `update cellar_members set display_name = $3 where cellar_id = $1 and user_id = $2`,
      [cellarId, context.userId, authorName],
    );
    return comment;
  });

export const removeComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const { role } = await assertMember(sql, context.userId, cellarId);
    if (role === "owner") {
      await sql.query(`delete from tea_comments where id = $1 and cellar_id = $2`, [
        data.id,
        cellarId,
      ]);
      return;
    }
    await sql.query(
      `delete from tea_comments where id = $1 and cellar_id = $2 and user_id = $3`,
      [data.id, cellarId, context.userId],
    );
  });

export const renameCellar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string().trim().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const { role } = await assertMember(sql, context.userId, cellarId);
    if (role !== "owner") throw new Error("Only the owner can rename the cellar.");
    await sql.query(`update cellars set name = $2 where id = $1`, [cellarId, data.name]);
  });

export const joinCellar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ code: z.string().trim().min(4).max(20) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCellar(sql, context.userId);
    const code = normalizeJoinCode(data.code);
    if (code.length < 4) throw new Error("That code does not match a cellar.");
    const found = await sql.query<{ id: string; name: string }>(
      `select id, name from cellars where join_code = $1`,
      [code],
    );
    const cellar = found[0];
    if (!cellar) throw new Error("That code does not match a cellar.");
    const name = await actorName(sql, context.userId);
    await sql.query(
      `insert into cellar_members (cellar_id, user_id, role, display_name)
       values ($1,$2,'member',$3)
       on conflict (cellar_id, user_id) do update set display_name = excluded.display_name`,
      [cellar.id, context.userId, name],
    );
    await sql.query(
      `insert into cellar_settings (user_id, seeded, active_cellar_id)
       values ($1, true, $2)
       on conflict (user_id) do update set active_cellar_id = excluded.active_cellar_id`,
      [context.userId, cellar.id],
    );
    return { id: cellar.id, name: cellar.name };
  });

export const switchCellar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ cellarId: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertMember(sql, context.userId, data.cellarId);
    await sql.query(
      `insert into cellar_settings (user_id, seeded, active_cellar_id)
       values ($1, true, $2)
       on conflict (user_id) do update set active_cellar_id = excluded.active_cellar_id`,
      [context.userId, data.cellarId],
    );
  });

export const leaveCellar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const { role } = await assertMember(sql, context.userId, cellarId);
    if (role === "owner") {
      throw new Error("You keep the cellar you started. Switch shelves instead.");
    }
    await sql.query(`delete from cellar_members where cellar_id = $1 and user_id = $2`, [
      cellarId,
      context.userId,
    ]);
    const home = await sql.query<{ cellar_id: string }>(
      `select cellar_id from cellar_members where user_id = $1 and role = 'owner' order by joined_at asc`,
      [context.userId],
    );
    let next = home[0]?.cellar_id ?? null;
    if (!next) {
      const name = await actorName(sql, context.userId);
      next = await createHomeCellar(sql, context.userId, `${name}'s cellar`, name);
    }
    await sql.query(`update cellar_settings set active_cellar_id = $2 where user_id = $1`, [
      context.userId,
      next,
    ]);
  });

export const dumpCellarBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({}).optional())
  .handler(async ({ context }) => {
    const sql = await getSql();
    const dumpAll = isWorkspacePreview() || dbSource === "pglite";
    const memberships = dumpAll
      ? await sql.query<{
          id: string;
          name: string;
          join_code: string;
          role: string;
        }>(
          `select c.id, c.name, c.join_code, coalesce(m.role, 'member') as role
           from cellars c
           left join cellar_members m on m.cellar_id = c.id and m.user_id = $1
           order by c.created_at asc`,
          [context.userId],
        )
      : await sql.query<{
          id: string;
          name: string;
          join_code: string;
          role: string;
        }>(
          `select c.id, c.name, c.join_code, m.role
           from cellar_members m
           join cellars c on c.id = m.cellar_id
           where m.user_id = $1
           order by case when m.role = 'owner' then 0 else 1 end, c.name asc`,
          [context.userId],
        );

    const settingsRows = await sql.query<SettingsRow>(
      `select notify, last_notified_on, seeded, active_cellar_id, pull_photos, confirm_photos, lookup_sources, categories
       from cellar_settings where user_id = $1`,
      [context.userId],
    );

    const cellars = [];
    const seenTea = new Set<string>();
    for (const cellar of memberships) {
      const members = await loadMembers(sql, cellar.id);
      const teaRows = await sql.query<TeaRow>(
        `select * from teas where cellar_id = $1 order by created_at desc`,
        [cellar.id],
      );
      const sessionRows = await sql.query<SessionRow>(
        `select s.*
         from steep_sessions s
         join teas t on t.id = s.tea_id
         where t.cellar_id = $1
         order by s.steeped_at desc`,
        [cellar.id],
      );
      const commentRows = await sql.query<CommentRow>(
        `select id, tea_id, user_id, author_name, body, created_at
         from tea_comments where cellar_id = $1
         order by created_at asc`,
        [cellar.id],
      );
      const sessionsByTea = new Map<string, SteepSession[]>();
      for (const row of sessionRows) {
        const list = sessionsByTea.get(row.tea_id) ?? [];
        list.push(mapSession(row));
        sessionsByTea.set(row.tea_id, list);
      }
      const commentsByTea = new Map<string, TeaComment[]>();
      for (const row of commentRows) {
        const list = commentsByTea.get(row.tea_id) ?? [];
        list.push({
          id: row.id,
          teaId: row.tea_id,
          userId: row.user_id,
          authorName: row.author_name || "Someone",
          body: row.body,
          createdAt: iso(row.created_at),
        });
        commentsByTea.set(row.tea_id, list);
      }
      const teas = teaRows.map((row) => {
        seenTea.add(row.id);
        return mapTea(row, sessionsByTea.get(row.id) ?? [], commentsByTea.get(row.id) ?? []);
      });
      cellars.push({
        id: cellar.id,
        name: cellar.name,
        joinCode: cellar.join_code,
        role: cellar.role === "owner" ? "owner" : "member",
        members,
        teas,
      });
    }

    let extraTeas: Tea[] = [];
    const extraRows = await sql.query<TeaRow>(
      dumpAll
        ? `select * from teas order by created_at desc`
        : `select t.* from teas t
           join cellar_members m on m.cellar_id = t.cellar_id
           where m.user_id = $1
           order by t.created_at desc`,
      dumpAll ? [] : [context.userId],
    );
    const leftover = extraRows.filter((r) => !seenTea.has(r.id));
    if (leftover.length) {
      const leftoverIds = leftover.map((r) => r.id);
      const placeholders = leftoverIds.map((_, i) => `$${i + 1}`).join(",");
      const sessionRows = await sql.query<SessionRow>(
        `select * from steep_sessions where tea_id in (${placeholders}) order by steeped_at desc`,
        leftoverIds,
      );
      const commentRows = await sql.query<CommentRow>(
        `select id, tea_id, user_id, author_name, body, created_at from tea_comments where tea_id in (${placeholders}) order by created_at asc`,
        leftoverIds,
      );
      const sessionsByTea = new Map<string, SteepSession[]>();
      for (const row of sessionRows) {
        const list = sessionsByTea.get(row.tea_id) ?? [];
        list.push(mapSession(row));
        sessionsByTea.set(row.tea_id, list);
      }
      const commentsByTea = new Map<string, TeaComment[]>();
      for (const row of commentRows) {
        const list = commentsByTea.get(row.tea_id) ?? [];
        list.push({
          id: row.id,
          teaId: row.tea_id,
          userId: row.user_id,
          authorName: row.author_name || "Someone",
          body: row.body,
          createdAt: iso(row.created_at),
        });
        commentsByTea.set(row.tea_id, list);
      }
      extraTeas = leftover.map((row) =>
        mapTea(row, sessionsByTea.get(row.id) ?? [], commentsByTea.get(row.id) ?? []),
      );
    }

    const payload = {
      kind: BACKUP_KIND,
      app: "cha-caddy" as const,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      meId: context.userId,
      settings: mapSettings(settingsRows[0]),
      cellars,
      extraTeas,
    };
    const json = JSON.stringify(payload, null, 2);
    const teaCount = cellars.reduce((n, c) => n + c.teas.length, 0) + extraTeas.length;
    let wroteArtifact = false;
    let artifactPath = "";
    if (isWorkspacePreview() || dbSource === "pglite") {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const dataDir = path.join(process.cwd(), "data");
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(path.join(dataDir, "cha-caddy-backup.json"), json, "utf8");
        if (isWorkspacePreview()) {
          await fs.mkdir("/workspace/artifacts", { recursive: true });
          artifactPath = "/workspace/artifacts/cha-caddy-backup.json";
          await fs.writeFile(artifactPath, json, "utf8");
          wroteArtifact = true;
        }
        if (dbSource === "pglite") {
          const pg = await getPglite();
          const blob = await pg.dumpDataDir("none");
          const buf = Buffer.from(await blob.arrayBuffer());
          await fs.writeFile(path.join(dataDir, "cha-caddy.dump.tar"), buf);
          if (isWorkspacePreview()) {
            await fs.writeFile("/workspace/artifacts/cha-caddy-pglite.tar", buf);
          }
        }
      } catch {
        wroteArtifact = Boolean(artifactPath);
      }
    }
    return {
      ok: true as const,
      json,
      teaCount,
      cellarCount: cellars.length,
      wroteArtifact,
      artifactPath,
    };
  });

export const restoreCellarBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      json: z.string().min(20).max(40_000_000),
      mode: z.enum(["merge", "replace"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const backup = parseBackupJson(data.json);
    const teas = teasFromBackup(backup);
    if (!teas.length) throw new Error("That backup has no teas in it.");
    const sql = await getSql();
    const cellarId = await ensureCellar(sql, context.userId);
    const { role } = await assertMember(sql, context.userId, cellarId);
    if (role !== "owner") throw new Error("Only the owner can restore a backup into this cellar.");

    if (data.mode === "replace") {
      await sql.query(`delete from teas where cellar_id = $1`, [cellarId]);
    }

    const existing = await sql.query<{ id: string }>(`select id from teas where cellar_id = $1`, [cellarId]);
    const taken = new Set(existing.map((r) => r.id));
    let imported = 0;
    let skipped = 0;
    for (const tea of teas) {
      let id = tea.id;
      if (taken.has(id)) {
        if (data.mode === "merge") {
          skipped += 1;
          continue;
        }
        id = crypto.randomUUID();
      }
      taken.add(id);
      const sessions = tea.sessions.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        userId: s.userId || context.userId,
      }));
      const comments = tea.comments.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        teaId: id,
        userId: c.userId || context.userId,
      }));
      await insertTeaRow(sql, context.userId, cellarId, { ...tea, id, sessions, comments });
      imported += 1;
    }

    const ownerShelf = backup.cellars.find((c) => c.role === "owner") ?? backup.cellars[0];
    if (ownerShelf?.name) {
      await sql.query(`update cellars set name = $2 where id = $1`, [cellarId, ownerShelf.name.slice(0, 80)]);
    }

    const s = backup.settings;
    await sql.query(
      `insert into cellar_settings (user_id, seeded, notify, last_notified_on, pull_photos, confirm_photos, lookup_sources, categories, active_cellar_id)
       values ($1, true, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       on conflict (user_id) do update set
         seeded = true,
         notify = excluded.notify,
         last_notified_on = excluded.last_notified_on,
         pull_photos = excluded.pull_photos,
         confirm_photos = excluded.confirm_photos,
         lookup_sources = excluded.lookup_sources,
         categories = excluded.categories,
         active_cellar_id = excluded.active_cellar_id`,
      [
        context.userId,
        s.notify,
        s.lastNotifiedOn,
        s.pullPhotos,
        s.confirmPhotos,
        JSON.stringify(s.lookupSources),
        JSON.stringify(s.categories),
        cellarId,
      ],
    );

    return { ok: true as const, imported, skipped, teaCount: teas.length };
  });
