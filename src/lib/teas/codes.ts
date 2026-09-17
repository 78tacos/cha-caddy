export function normalizeJoinCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function formatJoinCode(code: string): string {
  const c = normalizeJoinCode(code);
  if (c.length === 6) return `${c.slice(0, 3)}-${c.slice(3)}`;
  return c;
}
