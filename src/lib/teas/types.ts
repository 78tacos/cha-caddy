import { DEFAULT_LOOKUP_SOURCES } from "./sources";

export type TeaCategory = {
  id: string;
  label: string;
  subtypes: string[];
};

export const DEFAULT_CATEGORIES: TeaCategory[] = [
  {
    id: "white",
    label: "White",
    subtypes: ["Silver Needle", "White Peony", "Shou Mei", "Yue Guang Bai", "Compressed white", "Other white"],
  },
  {
    id: "green",
    label: "Green",
    subtypes: ["Longjing", "Biluochun", "Sencha", "Matcha", "Jasmine / scented", "Other green"],
  },
  {
    id: "yellow",
    label: "Yellow",
    subtypes: ["Junshan Yinzhen", "Huoshan Huangya", "Other yellow"],
  },
  {
    id: "oolong",
    label: "Oolong",
    subtypes: ["Wuyi rock", "Tieguanyin", "Phoenix dancong", "Taiwan high mountain", "Other oolong"],
  },
  {
    id: "black",
    label: "Black / red",
    subtypes: ["Dianhong", "Keemun", "Lapsang", "Bai Lin Gong Fu", "Jin Jun Mei", "Assam", "Darjeeling", "Other black"],
  },
  {
    id: "sheng",
    label: "Raw puerh",
    subtypes: ["Factory blend", "Gushu / single origin", "Other sheng"],
  },
  {
    id: "heicha",
    label: "Heicha",
    subtypes: ["Ripe puerh", "Liu Bao", "Fu brick / Anhua", "Other dark tea"],
  },
  {
    id: "herbal",
    label: "Herbal",
    subtypes: ["Tisane", "Flower", "Other herbal"],
  },
];

export const TEA_TYPES = DEFAULT_CATEGORIES.map((c) => c.id);
export type TeaType = string;

export const TEA_TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c.label])),
  shou: "Heicha",
};

export const TEA_SUBTYPES: Record<string, readonly string[]> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.subtypes]),
);

export const DEFAULT_REST_DAYS: Record<string, number> = {
  white: 10,
  green: 7,
  yellow: 10,
  oolong: 14,
  black: 14,
  sheng: 30,
  heicha: 21,
  shou: 21,
  herbal: 14,
};

export const DEFAULT_TEMP_C: Record<string, number> = {
  white: 80,
  green: 75,
  yellow: 80,
  oolong: 95,
  black: 90,
  sheng: 100,
  heicha: 100,
  shou: 100,
  herbal: 95,
};

export const DEFAULT_TEMP_RANGE: Record<string, string> = {
  white: "80–85°C",
  green: "75–80°C",
  yellow: "80–85°C",
  oolong: "95–100°C",
  black: "90–95°C",
  sheng: "95–100°C",
  heicha: "100°C",
  shou: "100°C",
  herbal: "95–100°C",
};

export function slugCategory(label: string): string {
  const s = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "custom";
}

export function cloneCategories(list: TeaCategory[] = DEFAULT_CATEGORIES): TeaCategory[] {
  return list.map((c) => ({ id: c.id, label: c.label, subtypes: [...c.subtypes] }));
}

export function parseCategories(raw: unknown): TeaCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return cloneCategories();
  const out: TeaCategory[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 16)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = String(row.label ?? "").trim().slice(0, 40);
    const id = slugCategory(String(row.id ?? label));
    if (!label || !id || seen.has(id)) continue;
    seen.add(id);
    const subtypes = Array.isArray(row.subtypes)
      ? row.subtypes.map((s) => String(s).trim()).filter(Boolean).slice(0, 16)
      : [];
    out.push({ id, label, subtypes });
  }
  return out.length ? out : cloneCategories();
}

export function typeLabel(type: string, categories: TeaCategory[] = DEFAULT_CATEGORIES): string {
  const fromUser = categories.find((c) => c.id === type);
  if (fromUser) return fromUser.label;
  if (type === "shou") {
    return categories.find((c) => c.id === "heicha")?.label ?? "Heicha";
  }
  if (TEA_TYPE_LABEL[type]) return TEA_TYPE_LABEL[type];
  return type.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || type;
}

export function subtypesFor(type: string, categories: TeaCategory[] = DEFAULT_CATEGORIES): string[] {
  return categories.find((c) => c.id === type)?.subtypes ?? [...(TEA_SUBTYPES[type] ?? [])];
}

export function restDaysFor(type: string): number {
  return DEFAULT_REST_DAYS[type] ?? 14;
}

export function tempRangeFor(type: string): string {
  return DEFAULT_TEMP_RANGE[type] ?? "90–95°C";
}

export function tempFor(type: TeaType, subtype = ""): number {
  const s = subtype.toLowerCase();
  if (s.includes("wuyi") || s.includes("rock")) return 100;
  if (s.includes("dancong") || s.includes("phoenix")) return 95;
  if (s.includes("tieguanyin") || s.includes("tgy")) return 95;
  if (s.includes("silver needle")) return 80;
  if (s.includes("jin jun mei")) return 90;
  if (s.includes("longjing") || s.includes("biluochun") || s.includes("sencha") || s.includes("matcha")) {
    return 75;
  }
  if (s.includes("assam") || s.includes("darjeeling")) return 95;
  return DEFAULT_TEMP_C[type] ?? 90;
}

export function normalizeTeaType(raw: string, subtype = ""): { type: TeaType; subtype: string } {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "shou" || s.includes("ripe puer") || s.includes("shu puer") || s.includes("ripe pu-er")) {
    const alreadyStyle = Boolean(subtype) && !/^(ripe cake|other ripe)$/i.test(subtype);
    return { type: "heicha", subtype: alreadyStyle ? subtype : "Ripe puerh" };
  }
  if (s === "heicha" || s.includes("liu bao") || s.includes("dark tea") || s.includes("fu brick") || s.includes("anhua")) {
    if (s.includes("liu bao") && !subtype) return { type: "heicha", subtype: "Liu Bao" };
    if ((s.includes("fu brick") || s.includes("anhua")) && !subtype) {
      return { type: "heicha", subtype: "Fu brick / Anhua" };
    }
    return { type: "heicha", subtype };
  }
  if (TEA_TYPES.includes(s)) {
    return { type: s, subtype };
  }
  if (s === "yancha" || s.includes("wuyi") || s.includes("rock tea")) {
    return { type: "oolong", subtype: subtype || "Wuyi rock" };
  }
  if (s === "dancong" || s.includes("dan cong") || s.includes("phoenix")) {
    return { type: "oolong", subtype: subtype || "Phoenix dancong" };
  }
  if (s === "scented" || s.includes("jasmine")) {
    return { type: "green", subtype: subtype || "Jasmine / scented" };
  }
  if (s.includes("sheng") || s.includes("raw puer")) return { type: "sheng", subtype };
  if (s.includes("white")) return { type: "white", subtype };
  if (s.includes("yellow")) return { type: "yellow", subtype };
  if (s.includes("green") || s.includes("sencha") || s.includes("matcha")) {
    return {
      type: "green",
      subtype: subtype || (s.includes("matcha") ? "Matcha" : s.includes("sencha") ? "Sencha" : ""),
    };
  }
  if (s.includes("oolong") || s.includes("wulong") || s.includes("tieguanyin")) {
    return { type: "oolong", subtype: subtype || (s.includes("tieguanyin") ? "Tieguanyin" : "") };
  }
  if (
    s.includes("black") ||
    s.includes("hong cha") ||
    s.includes("red tea") ||
    s.includes("dianhong") ||
    s.includes("assam")
  ) {
    return {
      type: "black",
      subtype: subtype || (s.includes("assam") ? "Assam" : s.includes("darjeeling") ? "Darjeeling" : ""),
    };
  }
  if (s.includes("herbal") || s.includes("tisane")) return { type: "herbal", subtype };
  if (s === "other") return { type: "herbal", subtype };
  if (/^[a-z0-9][a-z0-9-]{0,39}$/.test(s)) return { type: s, subtype };
  return { type: "oolong", subtype };
}

export const DRINK_SOON_TYPES: TeaType[] = ["green", "yellow", "herbal"];

export const TEA_FORMS = ["cake", "wedge", "tuo", "loose", "sample"] as const;
export type TeaForm = (typeof TEA_FORMS)[number];
export const TEA_FORM_LABEL: Record<TeaForm, string> = {
  cake: "Whole cake",
  wedge: "Broken wedge",
  tuo: "Tuo",
  loose: "Loose leaf",
  sample: "Sample pouch",
};

export const STORAGE_PLACES = ["cabinet", "pumidor", "fridge", "bag"] as const;
export type StoragePlace = (typeof STORAGE_PLACES)[number];
export const STORAGE_LABEL: Record<StoragePlace, string> = {
  cabinet: "Kitchen cabinet",
  pumidor: "Pumidor",
  fridge: "Fridge",
  bag: "Sealed bag",
};

export const TEA_INTENTS = ["drink", "age", "sample", "guest"] as const;
export type TeaIntent = (typeof TEA_INTENTS)[number];
export const INTENT_LABEL: Record<TeaIntent, string> = {
  drink: "Open — drink",
  age: "Aging — do not break",
  sample: "Sample only",
  guest: "Guest cake",
};

export const VESSELS = ["gaiwan", "yixing", "grandpa", "cup"] as const;
export type VesselKind = (typeof VESSELS)[number];
export const VESSEL_LABEL: Record<VesselKind, string> = {
  gaiwan: "Gaiwan",
  yixing: "Yixing",
  grandpa: "Grandpa",
  cup: "Cup",
};

export const TASTE_TAGS = [
  "smoke",
  "camphor",
  "floral",
  "bitter",
  "thick",
  "sweet",
  "mineral",
] as const;
export type TasteTag = (typeof TASTE_TAGS)[number];

export const LOW_STOCK_GRAMS = 20;

export type BrewParams = {
  vessel: string;
  grams: string;
  tempC: number;
  tempLowC?: number;
  tempHighC?: number;
  rinse: string;
  time: string;
  infusions: string;
};

export type SteepSession = {
  id: string;
  steepedAt: string;
  note: string;
  rating: number | null;
  userId: string;
  authorName: string;
  vessel: string;
  leafGrams: number | null;
  waterMl: number | null;
  waterTemp: number | null;
  infusionCount: number | null;
  liquorPhotoUrl: string;
  wetLeafPhotoUrl: string;
  steepTimes: number[];
  tasteTags: string[];
};

export type TeaComment = {
  id: string;
  teaId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type CellarMember = {
  userId: string;
  role: "owner" | "member";
  displayName: string;
  joinedAt: string;
};

export type SharedCellar = {
  id: string;
  name: string;
  joinCode: string;
  role: "owner" | "member";
  homeId: string | null;
  members: CellarMember[];
  memberships: Array<{ id: string; name: string; role: "owner" | "member" }>;
};

export type Tea = {
  id: string;
  name: string;
  nameZh: string;
  pinyin: string;
  type: TeaType;
  subtype: string;
  origin: string;
  region: string;
  cultivar: string;
  vendor: string;
  year: string;
  quantity: string;
  processing: string;
  description: string;
  tastingNotes: string[];
  liquor: string;
  brew: BrewParams | null;
  aging: string;
  restDays: number;
  photoUrl: string;
  acquiredAt: string;
  createdAt: string;
  lastSteepedAt: string | null;
  sessions: SteepSession[];
  comments: TeaComment[];
  sources: string[];
  unknown: boolean;
  prompt: string;
  form: TeaForm;
  originalGrams: number | null;
  remainingGrams: number | null;
  factory: string;
  recipe: string;
  listingUrl: string;
  storage: StoragePlace;
  intent: TeaIntent;
  locked: boolean;
  wrapperPhotoUrl: string;
  lastDrinkerName: string;
  lastSteepTimes: number[];
  lastVessel: string;
};

export type TeaDraft = Omit<
  Tea,
  "id" | "createdAt" | "sessions" | "comments" | "lastSteepedAt" | "lastDrinkerName" | "lastSteepTimes" | "lastVessel"
> & {
  lastSteepedAt?: string | null;
};

export type LogSteepInput = {
  id: string;
  note?: string;
  rating?: number | null;
  vessel?: string;
  leafGrams?: number | null;
  waterMl?: number | null;
  waterTemp?: number | null;
  infusionCount?: number | null;
  liquorPhotoUrl?: string;
  wetLeafPhotoUrl?: string;
  steepTimes?: number[];
  tasteTags?: string[];
  steepedAt?: string;
};

export type CellarSettings = {
  notify: boolean;
  lastNotifiedOn: string | null;
  pullPhotos: boolean;
  confirmPhotos: boolean;
  lookupSources: string[];
  categories: TeaCategory[];
};

export const defaultCellarSettings = (): CellarSettings => ({
  notify: false,
  lastNotifiedOn: null,
  pullPhotos: true,
  confirmPhotos: true,
  lookupSources: [...DEFAULT_LOOKUP_SOURCES],
  categories: cloneCategories(),
});

export const emptyBrew = (): BrewParams => ({
  vessel: "",
  grams: "",
  tempC: 95,
  rinse: "",
  time: "",
  infusions: "",
});

export const emptyDraft = (): TeaDraft => ({
  name: "",
  nameZh: "",
  pinyin: "",
  type: "oolong",
  subtype: "",
  origin: "",
  region: "",
  cultivar: "",
  vendor: "",
  year: "",
  quantity: "",
  processing: "",
  description: "",
  tastingNotes: [],
  liquor: "",
  brew: emptyBrew(),
  aging: "",
  restDays: 14,
  photoUrl: "",
  acquiredAt: new Date().toISOString().slice(0, 10),
  sources: [],
  unknown: false,
  prompt: "",
  form: "loose",
  originalGrams: null,
  remainingGrams: null,
  factory: "",
  recipe: "",
  listingUrl: "",
  storage: "cabinet",
  intent: "drink",
  locked: false,
  wrapperPhotoUrl: "",
});

export function isLowStock(tea: Tea): boolean {
  return tea.remainingGrams != null && tea.remainingGrams < LOW_STOCK_GRAMS;
}

export function stockLabel(tea: Tea): string {
  return tea.quantity || TEA_FORM_LABEL[tea.form];
}

export function identityLine(tea: Pick<Tea, "subtype" | "year" | "vendor">): string {
  return [tea.subtype, tea.year, tea.vendor].filter(Boolean).join(" · ");
}

export function teaToDraft(tea: Tea): TeaDraft {
  return {
    name: tea.name,
    nameZh: tea.nameZh,
    pinyin: tea.pinyin,
    type: tea.type,
    subtype: tea.subtype,
    origin: tea.origin,
    region: tea.region,
    cultivar: tea.cultivar,
    vendor: tea.vendor,
    year: tea.year,
    quantity: tea.quantity,
    processing: tea.processing,
    description: tea.description,
    tastingNotes: tea.tastingNotes,
    liquor: tea.liquor,
    brew: tea.brew,
    aging: tea.aging,
    restDays: tea.restDays,
    photoUrl: tea.photoUrl,
    acquiredAt: tea.acquiredAt,
    sources: tea.sources,
    unknown: tea.unknown,
    prompt: tea.prompt,
    form: tea.form,
    originalGrams: tea.originalGrams,
    remainingGrams: tea.remainingGrams,
    factory: tea.factory,
    recipe: tea.recipe,
    listingUrl: tea.listingUrl,
    storage: tea.storage,
    intent: tea.intent,
    locked: tea.locked,
    wrapperPhotoUrl: tea.wrapperPhotoUrl,
  };
}
