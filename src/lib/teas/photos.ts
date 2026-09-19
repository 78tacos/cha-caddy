import type { PhotoKind, Tea, TeaPhoto } from "./types";

export function newPhotoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parsePhotos(raw: unknown, photoUrl = "", wrapperPhotoUrl = ""): TeaPhoto[] {
  const out: TeaPhoto[] = [];
  const seen = new Set<string>();
  const push = (url: string, kind: PhotoKind, id?: string) => {
    const u = String(url ?? "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    const k: PhotoKind = kind === "tea" || kind === "packaging" ? kind : "";
    out.push({ id: id && id.length > 0 ? id : newPhotoId(), url: u, kind: k });
  };
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, 12)) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const kind: PhotoKind = row.kind === "tea" || row.kind === "packaging" ? row.kind : "";
      push(String(row.url ?? ""), kind, String(row.id ?? ""));
    }
  }
  if (out.length === 0) {
    push(photoUrl, "tea", "legacy-tea");
    push(wrapperPhotoUrl, "packaging", "legacy-packaging");
  }
  return out;
}

export function syncPhotoFields(photos: TeaPhoto[]): {
  photos: TeaPhoto[];
  photoUrl: string;
  wrapperPhotoUrl: string;
} {
  const list = photos.filter((p) => p.url).slice(0, 12);
  const tea = list.find((p) => p.kind === "tea") ?? list.find((p) => p.kind === "") ?? list[0];
  const pack = list.find((p) => p.kind === "packaging");
  return {
    photos: list,
    photoUrl: tea?.url ?? "",
    wrapperPhotoUrl: pack?.url ?? "",
  };
}

export function upsertPhoto(photos: TeaPhoto[], url: string, kind: PhotoKind): TeaPhoto[] {
  const u = url.trim();
  if (!u) return photos;
  const existing = photos.find((p) => p.url === u);
  if (existing) return photos.map((p) => (p.url === u ? { ...p, kind } : p));
  return [...photos, { id: newPhotoId(), url: u, kind }].slice(0, 12);
}

export function setPhotoKind(photos: TeaPhoto[], id: string, kind: PhotoKind): TeaPhoto[] {
  return photos.map((p) => (p.id === id ? { ...p, kind } : p));
}

export function removePhoto(photos: TeaPhoto[], id: string): TeaPhoto[] {
  return photos.filter((p) => p.id !== id);
}

export function photosOf(tea: Pick<Tea, "photos" | "photoUrl" | "wrapperPhotoUrl">): TeaPhoto[] {
  return parsePhotos(tea.photos, tea.photoUrl, tea.wrapperPhotoUrl);
}

export function compressImageFile(
  file: File,
  maxW = 900,
  quality = 0.72,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(drawJpeg(img, maxW, quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    img.src = url;
  });
}

export function compressDataUrl(dataUrl: string, maxW = 900, quality = 0.72): Promise<string> {
  if (!dataUrl.startsWith("data:image/") && !/^https?:/i.test(dataUrl)) {
    return Promise.resolve(dataUrl);
  }
  if (dataUrl.startsWith("data:image/") && dataUrl.length < 180_000) {
    return Promise.resolve(dataUrl);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(drawJpeg(img, maxW, quality));
    img.onerror = () => reject(new Error("Could not read that photo."));
    img.src = dataUrl;
  });
}

function drawJpeg(img: HTMLImageElement, maxW: number, quality: number): string {
  const scale = Math.min(1, maxW / Math.max(img.width, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
