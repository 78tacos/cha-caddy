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
