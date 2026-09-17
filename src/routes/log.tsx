import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { allSessions } from "@/lib/teas/store";
import { useCellar } from "@/lib/teas/use-cellar";

export const Route = createFileRoute("/log")({ component: LogPage });

function LogPage() {
  const { teas, isLoading } = useCellar();
  const sessions = allSessions(teas);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-md bg-secondary" />
        <div className="h-20 animate-pulse rounded-xl bg-card" />
        <div className="h-20 animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs tracking-widest text-celadon uppercase">Log</p>
        <h1 className="font-display text-4xl leading-none font-medium tracking-tight">
          Cups poured
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Every steep recorded in this cellar, newest first — named so you can tell who poured.
        </p>
      </header>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet. Open a tea and log a steep.</p>
      ) : (
        <ol className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                to="/tea/$id"
                params={{ id: s.tea.id }}
                className="flex gap-3 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]"
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                  {s.tea.photoUrl ? (
                    <img src={s.tea.photoUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.tea.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {format(new Date(s.steepedAt), "d MMM yyyy · HH:mm")}
                    {s.authorName ? ` · ${s.authorName}` : ""}
                    {s.rating ? ` · ${s.rating}/5` : ""}
                    {s.vessel ? ` · ${s.vessel}` : ""}
                    {s.leafGrams != null ? ` · ${s.leafGrams}g` : ""}
                  </p>
                  {s.tasteTags.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {s.tasteTags.map((tag) => (
                        <li key={tag}>
                          <Badge>{tag}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {s.note ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.note}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
