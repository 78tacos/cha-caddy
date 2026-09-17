import { stockLabel, TEA_FORM_LABEL, typeLabel, type Tea } from "./types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function teasToCsv(teas: Tea[]): string {
  const header = [
    "name",
    "name_zh",
    "pinyin",
    "type",
    "subtype",
    "recipe",
    "year",
    "form",
    "vendor",
    "listing_url",
    "storage",
    "last_steeped",
    "last_drinker",
    "sessions",
    "notes",
  ];
  const rows = teas.map((t) =>
    [
      t.name,
      t.nameZh,
      t.pinyin,
      typeLabel(t.type),
      t.subtype,
      t.recipe,
      t.year,
      TEA_FORM_LABEL[t.form],
      t.vendor,
      t.listingUrl,
      t.storage,
      t.lastSteepedAt ?? "",
      t.lastDrinkerName,
      String(t.sessions.length),
      t.description.replace(/\s+/g, " ").slice(0, 400),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function cellarToJson(teas: Tea[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      teas: teas.map((t) => ({
        ...t,
        stock: stockLabel(t),
      })),
    },
    null,
    2,
  );
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
