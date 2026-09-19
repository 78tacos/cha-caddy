import { z } from "zod";
import { STORAGE_PLACES, TEA_FORMS, TEA_INTENTS } from "./types";

export const brewSchema = z.object({
  vessel: z.string().max(80),
  grams: z.string().max(40),
  tempC: z.number().min(50).max(100),
  tempLowC: z.number().min(50).max(100).optional(),
  tempHighC: z.number().min(50).max(100).optional(),
  rinse: z.string().max(80),
  time: z.string().max(80),
  infusions: z.string().max(40),
});

export const teaPhotoSchema = z.object({
  id: z.string().max(80),
  url: z.string().max(1_500_000),
  kind: z.enum(["tea", "packaging", ""]),
});

export const teaDraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  nameZh: z.string().max(200),
  pinyin: z.string().max(200),
  type: z.string().trim().min(1).max(40),
  subtype: z.string().max(120).default(""),
  origin: z.string().max(240),
  region: z.string().max(240),
  cultivar: z.string().max(240),
  vendor: z.string().max(200),
  year: z.string().max(80),
  quantity: z.string().max(120),
  processing: z.string().max(4000),
  description: z.string().max(8000),
  tastingNotes: z.array(z.string().max(80)).max(16),
  liquor: z.string().max(240),
  brew: brewSchema.nullable(),
  aging: z.string().max(2000),
  restDays: z.number().int().min(1).max(365),
  photoUrl: z.string().max(1_500_000),
  photos: z.array(teaPhotoSchema).max(12).default([]),
  acquiredAt: z.string().max(40),
  sources: z.array(z.string().max(400)).max(12),
  lastSteepedAt: z.string().nullable().optional(),
  unknown: z.boolean(),
  prompt: z.string().max(8000),
  form: z.enum(TEA_FORMS),
  originalGrams: z.number().min(0).max(20000).nullable(),
  remainingGrams: z.number().min(0).max(20000).nullable(),
  factory: z.string().max(200),
  recipe: z.string().max(80),
  listingUrl: z.string().max(500),
  storage: z.enum(STORAGE_PLACES),
  intent: z.enum(TEA_INTENTS),
  locked: z.boolean(),
  wrapperPhotoUrl: z.string().max(1_500_000),
});

export const teaPatchSchema = teaDraftSchema.partial().extend({
  lastSteepTimes: z.array(z.number().min(0).max(1800)).max(40).optional(),
});

export const teaCategorySchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  subtypes: z.array(z.string().trim().min(1).max(60)).max(16).default([]),
});

export const logSteepSchema = z.object({
  id: z.string().min(1).max(80),
  note: z.string().max(2000).default(""),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  vessel: z.string().max(80).default(""),
  leafGrams: z.number().min(0).max(80).nullable().default(null),
  waterMl: z.number().min(0).max(2000).nullable().default(null),
  waterTemp: z.number().int().min(50).max(100).nullable().default(null),
  infusionCount: z.number().int().min(0).max(40).nullable().default(null),
  liquorPhotoUrl: z.string().max(1_500_000).default(""),
  wetLeafPhotoUrl: z.string().max(1_500_000).default(""),
  steepTimes: z.array(z.number().min(0).max(1800)).max(40).default([]),
  tasteTags: z.array(z.string().max(40)).max(12).default([]),
  steepedAt: z.string().max(40).optional(),
});