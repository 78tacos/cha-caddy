import type { SteepSession, Tea, TeaForm, TeaIntent, StoragePlace } from "./types";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function session(id: string, days: number, note: string, rating: number, extra: Partial<SteepSession> = {}): SteepSession {
  return {
    id,
    steepedAt: daysAgo(days),
    note,
    rating,
    userId: "seed",
    authorName: "Archive",
    vessel: extra.vessel ?? "gaiwan",
    leafGrams: extra.leafGrams ?? 7,
    waterMl: extra.waterMl ?? 110,
    waterTemp: extra.waterTemp ?? 100,
    infusionCount: extra.infusionCount ?? 8,
    liquorPhotoUrl: "",
    wetLeafPhotoUrl: "",
    steepTimes: extra.steepTimes ?? [10, 15, 20, 25, 30],
    tasteTags: extra.tasteTags ?? [],
  };
}

type Raw = Omit<
  Tea,
  | "unknown"
  | "prompt"
  | "comments"
  | "form"
  | "originalGrams"
  | "remainingGrams"
  | "factory"
  | "recipe"
  | "listingUrl"
  | "storage"
  | "intent"
  | "locked"
  | "wrapperPhotoUrl"
  | "lastDrinkerName"
  | "lastSteepTimes"
  | "lastVessel"
  | "photos"
>;

const RAW_SEED: Raw[] = [
  {
    id: "seed-7542",
    name: "Dayi 7542",
    nameZh: "大益7542",
    pinyin: "Dàyì qī wǔ sì èr",
    type: "sheng",
    subtype: "Factory blend",
    origin: "Menghai, Xishuangbanna, Yunnan",
    region: "Menghai Tea Factory recipe, blended Menghai-area material",
    cultivar: "Assamica (Daye)",
    vendor: "Menghai Tea Factory (Dayi / Taetea)",
    year: "2012",
    quantity: "357g cake, ~220g remaining",
    processing: "Sun-dried maocha, steam-pressed into a 357g bing. The 75 recipe from 1975; 4 is leaf grade, 2 is Menghai factory.",
    description:
      "The benchmark factory sheng — the cake collectors age and daily drinkers break. Young 7542 is astringent, smoky, and bitter-sweet; a 2012 has had time to shed some of the factory smoke and show camphor, dried apricot, and a cooling finish. This is the tea that teaches you how recipe cakes change in a real cupboard.",
    tastingNotes: ["camphor", "dried apricot", "hay", "light smoke", "cooling huigan"],
    liquor: "Deep gold, clearing toward amber",
    brew: {
      vessel: "Yixing or 120ml gaiwan",
      grams: "7g",
      tempC: 100,
      rinse: "Two 5s rinses",
      time: "10s, then +5s",
      infusions: "12+",
    },
    aging: "Dry-stored cakes from this era are in their adolescence. Keep away from the kitchen and from ripe puerh.",
    restDays: 30,
    photoUrl: "/teas/cake7542.jpg",
    acquiredAt: "2018-11-02",
    createdAt: daysAgo(400),
    lastSteepedAt: daysAgo(147),
    sessions: [
      session("s7542-1", 147, "Still a little tight. Camphor on the fifth steep.", 4, {
        tasteTags: ["camphor", "smoke"],
      }),
      session("s7542-2", 280, "Broke a chunk from the edge. Needed a long rest after.", 3, {
        tasteTags: ["bitter"],
      }),
    ],
    sources: ["Menghai Tea Factory recipe notes", "Classic 75-series documentation"],
  },
  {
    id: "seed-liubao",
    name: "Wuzhou Liu Bao",
    nameZh: "梧州六堡",
    pinyin: "Wúzhōu liù bǎo",
    type: "heicha",
    subtype: "Liu Bao",
    origin: "Wuzhou, Guangxi",
    region: "Traditional Liu Bao from Wuzhou warehouses",
    cultivar: "Guangxi large-leaf",
    vendor: "Wuzhou Tea Factory",
    year: "2010",
    quantity: "500g basket, ~180g remaining",
    processing: "Pile-fermented dark tea, traditionally basket-aged. Betel-nut and clean earth when the storage is honest.",
    description:
      "A daily heicha with betel-nut, dried date, and a slick sweet liquor when the warehouse work was clean. This basket has been opened for years — it is a drinker, not a specimen. Keep it away from the sheng cakes.",
    tastingNotes: ["betel nut", "dried date", "clean earth", "brown sugar"],
    liquor: "Deep auburn, clear",
    brew: {
      vessel: "Gaiwan or clay pot",
      grams: "6g",
      tempC: 100,
      rinse: "Two 8s rinses",
      time: "15s, +8s",
      infusions: "10+",
    },
    aging: "Already aged. Drink. A sealed bag in a cabinet is enough.",
    restDays: 21,
    photoUrl: "/teas/liubao.jpg",
    acquiredAt: "2016-04-12",
    createdAt: daysAgo(900),
    lastSteepedAt: daysAgo(89),
    sessions: [
      session("sliubao-1", 89, "Binglang finally showing. Very clean.", 5, {
        tasteTags: ["sweet", "thick"],
        vessel: "yixing",
      }),
    ],
    sources: ["Wuzhou traditional Liu Bao notes"],
  },
  {
    id: "seed-yashi",
    name: "Ya Shi Xiang",
    nameZh: "鸭屎香",
    pinyin: "Yā shǐ xiāng",
    type: "oolong",
    subtype: "Phoenix dancong",
    origin: "Phoenix Mountain, Chaozhou, Guangdong",
    region: "Ya Shi Xiang cultivar, medium roast",
    cultivar: "Ya Shi Xiang",
    vendor: "Phoenix Mountain farmer",
    year: "2023",
    quantity: "50g pouch, ~22g remaining",
    processing: "Dancong oolong, medium charcoal roast, rolled strip style.",
    description:
      "Gardenia, cream, and a lingering honey that outlasts the roast. Short steeps only — this cultivar turns bitter if you get greedy. Drink it this year; dancong is not a cellar project.",
    tastingNotes: ["gardenia", "cream", "honey", "light charcoal"],
    liquor: "Bright gold",
    brew: {
      vessel: "Porcelain gaiwan 100ml",
      grams: "5g",
      tempC: 95,
      rinse: "5s rinse",
      time: "8s, +3s",
      infusions: "8+",
    },
    aging: "Drink within the year. Airtight, away from heat.",
    restDays: 10,
    photoUrl: "/teas/yashi.jpg",
    acquiredAt: "2024-02-18",
    createdAt: daysAgo(200),
    lastSteepedAt: daysAgo(41),
    sessions: [
      session("syashi-1", 41, "Gardenia through the whole session. Short steeps only.", 5, {
        tasteTags: ["floral", "sweet"],
        leafGrams: 5,
        waterTemp: 95,
      }),
    ],
    sources: ["Phoenix Mountain dancong notes"],
  },
  {
    id: "seed-dhp",
    name: "Da Hong Pao",
    nameZh: "大红袍",
    pinyin: "Dà hóng páo",
    type: "oolong",
    subtype: "Wuyi rock",
    origin: "Wuyi, Fujian",
    region: "Rock oolong, mid-roast blend",
    cultivar: "Wuyi shrub blend",
    vendor: "Wuyi rock tea house",
    year: "2022",
    quantity: "8g sample, ~3g remaining",
    processing: "Wuyi yancha, charcoal roast, traditional rocking and roasting cycles.",
    description:
      "Yan yun — that mineral rock taste — on the middle steeps, with dark chocolate and baked fruit around the roast. A sample pouch. Finish it before it fades.",
    tastingNotes: ["mineral", "dark chocolate", "baked fruit", "charcoal"],
    liquor: "Amber",
    brew: {
      vessel: "Gaiwan 100ml",
      grams: "6g",
      tempC: 100,
      rinse: "5s rinse",
      time: "10s, +5s",
      infusions: "8+",
    },
    aging: "Roast needs a few weeks after arrival. Then drink.",
    restDays: 18,
    photoUrl: "/teas/dahongpao.jpg",
    acquiredAt: "2023-11-04",
    createdAt: daysAgo(310),
    lastSteepedAt: daysAgo(19),
    sessions: [
      session("sdhp-1", 19, "Yan yun on steeps 4–7. Roast fully settled.", 5, {
        tasteTags: ["mineral", "thick"],
        leafGrams: 6,
      }),
    ],
    sources: ["Wuyi yancha tasting notes"],
  },
  {
    id: "seed-yinzhen",
    name: "Bai Hao Yin Zhen",
    nameZh: "白毫银针",
    pinyin: "Bái háo yín zhēn",
    type: "white",
    subtype: "Silver Needle",
    origin: "Fuding, Fujian",
    region: "Silver needle buds",
    cultivar: "Dabai",
    vendor: "Fuding white tea",
    year: "2023",
    quantity: "50g, ~30g remaining",
    processing: "Unoxidized buds, sun and indoor wither.",
    description:
      "Soft hay, melon skin, and a quiet sweetness. Water off a full boil. Do not rush it — this is a long session of pale liquor.",
    tastingNotes: ["hay", "melon skin", "soft sweet"],
    liquor: "Pale straw",
    brew: {
      vessel: "Gaiwan 120ml",
      grams: "5g",
      tempC: 85,
      rinse: "None",
      time: "20s, +10s",
      infusions: "6+",
    },
    aging: "Can age, but this lot is for drinking now.",
    restDays: 10,
    photoUrl: "/teas/yinzhen.jpg",
    acquiredAt: "2024-03-21",
    createdAt: daysAgo(170),
    lastSteepedAt: daysAgo(6),
    sessions: [
      session("syin-1", 6, "Soft hay. Water off boil a long minute.", 4, {
        tasteTags: ["sweet"],
        waterTemp: 85,
        leafGrams: 5,
      }),
    ],
    sources: ["Fuding white tea notes"],
  },
  {
    id: "seed-jjm",
    name: "Jin Jun Mei",
    nameZh: "金骏眉",
    pinyin: "Jīn jùn méi",
    type: "black",
    subtype: "Jin Jun Mei",
    origin: "Tongmu, Wuyi, Fujian",
    region: "Bud-heavy hong cha",
    cultivar: "Wuyi local",
    vendor: "Tongmu",
    year: "2024",
    quantity: "25g pouch, ~12g remaining",
    processing: "Fully oxidized bud hong cha. No smoky lapsang process.",
    description:
      "Longan, honey, and a cocoa finish. Do not take it to a rolling boil. A weekday cup that still feels like a treat.",
    tastingNotes: ["longan", "honey", "cocoa"],
    liquor: "Bright orange-amber",
    brew: {
      vessel: "Gaiwan or mug",
      grams: "4g",
      tempC: 90,
      rinse: "None",
      time: "15s, +5s",
      infusions: "6+",
    },
    aging: "Drink this year.",
    restDays: 14,
    photoUrl: "/teas/jinjunmei.jpg",
    acquiredAt: "2024-05-02",
    createdAt: daysAgo(130),
    lastSteepedAt: daysAgo(11),
    sessions: [
      session("sjjm-1", 11, "Longan and honey. Do not go to a full boil.", 5, {
        tasteTags: ["sweet", "thick"],
        waterTemp: 90,
        leafGrams: 4,
      }),
    ],
    sources: ["Tongmu hong cha notes"],
  },
  {
    id: "seed-tgy",
    name: "Zhengwei Tieguanyin",
    nameZh: "正味铁观音",
    pinyin: "Zhèng wèi tiěguānyīn",
    type: "oolong",
    subtype: "Tieguanyin",
    origin: "Anxi, Fujian",
    region: "Traditional roast Tieguanyin",
    cultivar: "Tieguanyin",
    vendor: "Anxi",
    year: "2024",
    quantity: "50g, ~40g remaining",
    processing: "Traditional zhengwei — more roast than the jade-green modern style.",
    description:
      "Orchid, baked sugar, and a lingering roast that stays polite. A gentle everyday oolong that does not need a ceremony.",
    tastingNotes: ["orchid", "baked sugar", "gentle roast"],
    liquor: "Gold",
    brew: {
      vessel: "Gaiwan 100ml",
      grams: "6g",
      tempC: 95,
      rinse: "5s rinse",
      time: "12s, +5s",
      infusions: "8+",
    },
    aging: "Drink. Keep sealed.",
    restDays: 18,
    photoUrl: "/teas/tieguanyin.jpg",
    acquiredAt: "2024-06-11",
    createdAt: daysAgo(90),
    lastSteepedAt: daysAgo(2),
    sessions: [
      session("stgy-1", 2, "Orchid on three. Roast is gentle.", 4, {
        tasteTags: ["floral"],
        leafGrams: 6,
        waterTemp: 95,
      }),
    ],
    sources: ["Anxi zhengwei notes"],
  },
  {
    id: "seed-v93",
    name: "Dayi V93 Tuo",
    nameZh: "大益 V93 沱茶",
    pinyin: "Dàyì V jiǔ sān",
    type: "heicha",
    subtype: "Ripe puerh",
    origin: "Menghai, Yunnan",
    region: "Ripe tuo, Menghai fermentation",
    cultivar: "Assamica",
    vendor: "Menghai Tea Factory (Dayi)",
    year: "2021",
    quantity: "100g tuo, unopened",
    processing: "Ripe puerh tuo, V93 recipe. Clean fermentation, drinkable now.",
    description:
      "A tuo still in its paper, waiting. Ripe V93 is cocoa, damp wood, red date, and a thick sweet liquor without the fishy note of sloppy fermentation. Crack it when you want a weekday shou that does not need another five years. Until then it is the unopened nest on the shelf.",
    tastingNotes: ["cocoa", "red date", "damp wood", "brown sugar", "clean earth"],
    liquor: "Deep opaque mahogany (once you brew it)",
    brew: {
      vessel: "Gaiwan or cheap yixing",
      grams: "6g",
      tempC: 100,
      rinse: "Two rinses, 10s each",
      time: "15s, +10s",
      infusions: "10+",
    },
    aging: "Ripe tuo is drinkable now. Another few years of dry storage will round the fermentation.",
    restDays: 21,
    photoUrl: "/teas/v93.jpg",
    acquiredAt: "2024-08-01",
    createdAt: daysAgo(50),
    lastSteepedAt: null,
    sessions: [],
    sources: ["Menghai V93 recipe notes"],
  },
];

function parseGrams(quantity: string): { original: number | null; remaining: number | null } {
  const remaining = quantity.match(/(\d+)\s*g remaining/i);
  const original = quantity.match(/(\d+)\s*g/);
  return {
    original: original ? Number(original[1]) : null,
    remaining: remaining ? Number(remaining[1]) : original ? Number(original[1]) : null,
  };
}

function inferForm(t: Raw): TeaForm {
  const q = `${t.name} ${t.quantity}`.toLowerCase();
  if (q.includes("sample")) return "sample";
  if (q.includes("tuo")) return "tuo";
  if (q.includes("wedge") || q.includes("broken")) return "wedge";
  if (t.type === "sheng" || t.type === "heicha" || t.type === "shou") return "cake";
  return "loose";
}

function inferFactory(t: Raw): string {
  if (t.vendor.includes("Menghai")) return "Menghai Tea Factory";
  if (t.vendor.includes("Xiaguan")) return "Xiaguan";
  if (t.vendor.includes("Wuzhou")) return "Wuzhou Tea Factory";
  return "";
}

function inferRecipe(t: Raw): string {
  if (t.name.includes("7542")) return "7542";
  if (t.name.includes("V93")) return "V93";
  return "";
}

function inferStorage(t: Raw): StoragePlace {
  if (t.type === "green") return "fridge";
  if (t.type === "sheng" || t.type === "heicha" || t.type === "shou") return "cabinet";
  return "cabinet";
}

function inferIntent(t: Raw): TeaIntent {
  if (!t.lastSteepedAt && (t.type === "sheng" || t.type === "heicha" || t.type === "shou")) return "age";
  if (t.quantity.toLowerCase().includes("sample")) return "sample";
  return "drink";
}

export const SEED_TEAS: Tea[] = RAW_SEED.map((t) => {
  const grams = parseGrams(t.quantity);
  const last = t.sessions[0];
  return {
    ...t,
    unknown: false,
    prompt: "",
    comments: [],
    form: inferForm(t),
    originalGrams: grams.original,
    remainingGrams: t.lastSteepedAt == null && t.quantity.toLowerCase().includes("unopened")
      ? grams.original
      : grams.remaining,
    factory: inferFactory(t),
    recipe: inferRecipe(t),
    listingUrl: "",
    storage: inferStorage(t),
    intent: inferIntent(t),
    locked: false,
    wrapperPhotoUrl: "",
    photos: [],
    lastDrinkerName: last?.authorName ?? "",
    lastSteepTimes: last?.steepTimes ?? [],
    lastVessel: last?.vessel ?? t.brew?.vessel ?? "",
  };
});
