import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { typeLabel } from "./types";

type ChatOk = { ok: true; text: string };
type ChatFail = { ok: false; error: string };

async function grokText(system: string, user: string): Promise<ChatOk | ChatFail> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Grok is unavailable in this environment." };
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1200,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return { ok: false, error: `Could not write notes (${res.status}). Try again.` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "Grok returned an empty description." };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "Could not reach Grok. Try again in a moment." };
  }
}

function asDataUrl(b64: string, mime = "image/png"): string {
  const raw = b64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  return `data:${mime};base64,${raw}`;
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 40 || buf.byteLength > 1_400_000) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

type ImagineBody = {
  data?: Array<{ url?: string; b64_json?: string; base64?: string }>;
};

async function imagine(payload: Record<string, unknown>): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  const endpoint = payload.image
    ? "https://api.x.ai/v1/images/edits"
    : "https://api.x.ai/v1/images/generations";
  const models = ["grok-imagine-image-quality", "grok-imagine-image-2.0", "grok-imagine-image"];
  for (const model of models) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ ...payload, model }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as ImagineBody;
      const first = body.data?.[0];
      const b64 = first?.b64_json || first?.base64;
      if (b64) return asDataUrl(b64);
      if (first?.url) {
        const data = await urlToDataUrl(first.url);
        if (data) return data;
      }
    } catch {
      /* try next model */
    }
  }
  return null;
}

export const polishDescription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().max(200).default(""),
      type: z.string().max(40).default(""),
      subtype: z.string().max(120).default(""),
      notes: z.string().max(2000).default(""),
      draft: z.string().max(8000).default(""),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const bits = [
      data.name ? `Name: ${data.name}` : null,
      data.type ? `Category: ${typeLabel(data.type)}${data.subtype ? ` · ${data.subtype}` : ""}` : null,
      data.notes ? `Tasting words the owner typed: ${data.notes}` : null,
      data.draft ? `Current notes to polish:\n${data.draft}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    if (!bits.trim()) {
      return { ok: false, error: "Type a few words in the notes first — malty, cocoa, deep…" };
    }
    const result = await grokText(
      "You write tea-cellar notes. Turn the owner's fragments into a cohesive 4–8 sentence note. Keep every flavor they named. Do not cut the note short or stop mid-sentence. No marketing, no invented origin stories, no brewing steps. Direct, readable, present tense.",
      bits,
    );
    if (!result.ok) return result;
    return { ok: true, text: result.text.replace(/^["']|["']$/g, "").trim() };
  });

export const generateTeaImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      prompt: z.string().trim().max(800).default(""),
      name: z.string().max(200).default(""),
      type: z.string().max(40).default(""),
      image: z.string().max(1_500_000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Image generation is unavailable in this environment." };

    const subject = [data.name, typeLabel(data.type), data.prompt].filter(Boolean).join(", ");
    if (!subject && !data.image) {
      return { ok: false, error: "Describe the leaf, or attach a photo to polish." };
    }

    const polish =
      "Polished, clean, high-quality editorial product photograph of tea. Dry leaf, cake, or tuo on a dark lacquer tea tray. Soft natural side light, shallow depth of field, quiet still life. No text, no watermark, no hands, no animals.";

    try {
      let url: string | null = null;
      if (data.image && data.image.startsWith("data:image/")) {
        url = await imagine({
          model: "grok-imagine-image-quality",
          prompt: `${polish} Keep the actual tea in the photo. ${subject}`.trim(),
          image: { url: data.image, type: "image_url" },
          aspect_ratio: "4:3",
          resolution: "1k",
          response_format: "b64_json",
        });
      } else {
        url = await imagine({
          model: "grok-imagine-image-quality",
          prompt: `${polish} Subject: ${subject || "loose Chinese tea leaves"}.`,
          aspect_ratio: "4:3",
          resolution: "1k",
          response_format: "b64_json",
        });
      }
      if (!url) return { ok: false, error: "Could not generate that portrait. Try a shorter description." };
      if (url.length > 1_450_000) {
        return { ok: false, error: "The generated photo was too large to save. Try again." };
      }
      return { ok: true, url };
    } catch {
      return { ok: false, error: "Image generation failed. Try again in a moment." };
    }
  });
