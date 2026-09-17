import { typeLabel, type SteepSession, type Tea } from "./types";

export type TasteNote = {
  text: string;
};

export function householdWeek(teas: Tea[], now = new Date()): Array<SteepSession & { tea: Tea }> {
  const weekAgo = now.getTime() - 7 * 86400000;
  return teas
    .flatMap((tea) => tea.sessions.map((s) => ({ ...s, tea })))
    .filter((s) => new Date(s.steepedAt).getTime() >= weekAgo)
    .sort((a, b) => new Date(b.steepedAt).getTime() - new Date(a.steepedAt).getTime());
}

export function personalTasteNote(teas: Tea[], meId: string): string | null {
  const mine = teas.flatMap((t) =>
    t.sessions
      .filter((s) => s.userId === meId && s.rating != null)
      .map((s) => ({ type: t.type, rating: s.rating as number })),
  );
  if (mine.length < 4) return null;

  const byType = new Map<string, { sum: number; n: number }>();
  for (const row of mine) {
    const cur = byType.get(row.type) ?? { sum: 0, n: 0 };
    cur.sum += row.rating;
    cur.n += 1;
    byType.set(row.type, cur);
  }
  const avgs = [...byType.entries()]
    .filter(([, v]) => v.n >= 2)
    .map(([type, v]) => ({ type, avg: v.sum / v.n, n: v.n }))
    .sort((a, b) => b.avg - a.avg);
  if (avgs.length < 2) return null;
  const top = avgs[0];
  const bottom = avgs[avgs.length - 1];
  if (top.avg - bottom.avg < 0.4) return null;
  return `You rate ${typeLabel(top.type)} higher than ${typeLabel(bottom.type)}.`;
}

export function tagCounts(teas: Tea[], meId: string): Array<{ tag: string; n: number }> {
  const counts = new Map<string, number>();
  for (const tea of teas) {
    for (const s of tea.sessions) {
      if (s.userId !== meId) continue;
      for (const tag of s.tasteTags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n);
}
