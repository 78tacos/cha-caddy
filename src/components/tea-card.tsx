import { Link } from "@tanstack/react-router";
import { daysSince, lastSteepLabel, restStatus } from "@/lib/teas/dates";
import {
  identityLine,
  typeLabel,
  type Tea,
} from "@/lib/teas/types";
import { useCellar } from "@/lib/teas/use-cellar";
import { TypeSeal, MotifWash } from "@/components/type-seal";

export function TeaCard({ tea, rank }: { tea: Tea; rank?: number }) {
  const { settings } = useCellar();
  const status = restStatus(tea);
  const days = daysSince(tea.lastSteepedAt);
  const identity = identityLine(tea);

  return (
    <Link
      to="/tea/$id"
      params={{ id: tea.id }}
      className="group relative block overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:shadow-[var(--shadow-border-hover)]"
    >
      <MotifWash tea={tea} />
      <div className="relative p-1.5 pb-0">
        <div className="relative aspect-photo overflow-hidden rounded-lg bg-secondary/70">
          {tea.photoUrl ? (
            <img
              src={tea.photoUrl}
              alt=""
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              No portrait
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background/90 to-transparent" />
          <div className="absolute right-2.5 bottom-2.5 left-2.5">
            <p className="font-display text-lg leading-tight font-medium text-foreground">
              {tea.name}
            </p>
            {tea.nameZh ? (
              <p className="text-xs tracking-wide text-paper/90">{tea.nameZh}</p>
            ) : identity ? (
              <p className="text-xs tracking-wide text-paper/90">{identity}</p>
            ) : null}
          </div>
          {rank != null ? (
            <span className="absolute top-2 left-2 font-display text-2xl text-primary/90 tabular-nums">
              {String(rank).padStart(2, "0")}
            </span>
          ) : null}
          {tea.locked ? (
            <span className="absolute top-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-xs text-paper">
              Locked
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative space-y-1 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <TypeSeal
            type={tea.unknown ? "unknown" : tea.type}
            label={tea.unknown ? "Unknown" : typeLabel(tea.type, settings.categories)}
          />
          <p
            className={
              status === "due"
                ? "text-xs text-warn tabular-nums"
                : "text-xs text-muted-foreground tabular-nums"
            }
          >
            {status === "unopened"
              ? "Unopened"
              : status === "due" && days != null
                ? `${days} days`
                : lastSteepLabel(tea.lastSteepedAt)}
          </p>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[tea.subtype || null, tea.lastDrinkerName || null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
