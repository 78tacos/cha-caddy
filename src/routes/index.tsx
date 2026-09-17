import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { TeaCard } from "@/components/tea-card";
import { Input } from "@/components/ui/input";
import { householdWeek } from "@/lib/teas/profile";
import { selectDue, selectUnopened } from "@/lib/teas/store";
import { useCellar } from "@/lib/teas/use-cellar";
import { typeLabel } from "@/lib/teas/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: CellarPage });

function CellarPage() {
  const { teas, cellar, settings, isLoading, isError, fromCache } = useCellar();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | "all">("all");
  const due = selectDue(teas).length;
  const unopened = selectUnopened(teas).length;
  const week = useMemo(() => householdWeek(teas), [teas]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teas.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (!needle) return true;
      const hay = [
        t.name,
        t.nameZh,
        t.pinyin,
        t.origin,
        t.vendor,
        t.year,
        t.cultivar,
        t.subtype,
        t.recipe,
        t.region,
        t.form,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [teas, q, type]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 animate-pulse rounded-md bg-secondary" />
        <div className="h-10 w-56 animate-pulse rounded-md bg-secondary" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-photo animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-card px-5 py-12 text-center shadow-[var(--shadow-border)]">
        <p className="font-display text-2xl">Could not open the cellar</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The shelf did not load. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs tracking-widest text-celadon uppercase">Cellar</p>
        <h1 className="font-display text-4xl leading-none font-medium tracking-tight">
          {teas.length} tea{teas.length === 1 ? "" : "s"}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A shared shelf — what is in the caddy, who last poured, and what has been waiting.
        </p>
      </header>

      {fromCache ? (
        <p className="rounded-xl bg-card px-4 py-3 text-sm text-paper shadow-[var(--shadow-border)]">
          Showing a saved shelf — waiting for the network.
        </p>
      ) : null}

      {cellar ? (
        <Link
          to="/share"
          className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{cellar.name}</span>
            <span className="text-xs text-muted-foreground">
              {cellar.members.length === 1
                ? "Just you — share a code to open this shelf"
                : `${cellar.members.map((m) => m.displayName.split(" ")[0]).slice(0, 3).join(", ")} · ${cellar.members.length} people`}
            </span>
          </span>
          <span className="shrink-0 text-xs text-celadon">Share</span>
        </Link>
      ) : null}

      {due + unopened > 0 ? (
        <Link
          to="/resting"
          className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
        >
          <span className="text-sm">
            <span className="text-warn tabular-nums">{due}</span> past rest
            {unopened ? (
              <>
                {" "}
                · <span className="text-paper tabular-nums">{unopened}</span> unopened
              </>
            ) : null}
          </span>
          <span className="text-xs text-celadon">See resting</span>
        </Link>
      ) : null}

      {week.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-medium">This week</h2>
          <ul className="space-y-2">
            {week.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link
                  to="/tea/$id"
                  params={{ id: s.tea.id }}
                  className="flex items-baseline justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-paper">{s.authorName}</span>
                    {" · "}
                    {s.tea.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {format(new Date(s.steepedAt), "EEE")}
                    {s.rating ? ` · ${s.rating}/5` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, cultivar, vendor, year"
        aria-label="Search teas"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <TypeChip active={type === "all"} onClick={() => setType("all")}>
          All
        </TypeChip>
        {settings.categories.map((c) =>
          teas.some((tea) => tea.type === c.id) ? (
            <TypeChip key={c.id} active={type === c.id} onClick={() => setType(c.id)}>
              {c.label}
            </TypeChip>
          ) : null,
        )}
        {[...new Set(teas.map((t) => t.type))]
          .filter((id) => !settings.categories.some((c) => c.id === id))
          .map((id) => (
            <TypeChip key={id} active={type === id} onClick={() => setType(id)}>
              {typeLabel(id, settings.categories)}
            </TypeChip>
          ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-12 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-2xl">Empty shelf</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a tea from the next order, or an unknown cake you want identified.
          </p>
          <Link to="/new" className="mt-4 inline-block text-sm text-celadon">
            Add a tea
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tea) => (
            <TeaCard key={tea.id} tea={tea} />
          ))}
        </div>
      )}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3 text-xs tracking-wide",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
