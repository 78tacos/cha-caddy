import { createFileRoute, Link } from "@tanstack/react-router";
import { NotifyToggle } from "@/components/reminders";
import { TeaCard } from "@/components/tea-card";
import { daysSince, lastSteepExact } from "@/lib/teas/dates";
import {
  selectAging,
  selectDrinkSoon,
  selectLowStock,
  selectOldest,
  selectReminderTeas,
  selectUnopened,
} from "@/lib/teas/store";
import { typeLabel, stockLabel } from "@/lib/teas/types";
import { useCellar } from "@/lib/teas/use-cellar";

export const Route = createFileRoute("/resting")({ component: RestingPage });

function RestingPage() {
  const { teas, isLoading, settings } = useCellar();
  const due = selectReminderTeas(teas, 5);
  const unopened = selectUnopened(teas);
  const aging = selectAging(teas);
  const soon = selectDrinkSoon(teas);
  const low = selectLowStock(teas);
  const oldest = selectOldest(teas).slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-md bg-secondary" />
        <div className="h-40 animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs tracking-widest text-celadon uppercase">Resting</p>
          <h1 className="font-display text-4xl leading-none font-medium tracking-tight">
            Oldest first
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Forgotten cakes first — reminders only ping these five longest rests.
          </p>
        </div>
        <NotifyToggle />
      </header>

      {due.length === 0 && unopened.length === 0 && low.length === 0 && soon.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-10 shadow-[var(--shadow-border)]">
          <p className="font-display text-2xl">The cellar is current</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing is past its rest. The oldest cups:
          </p>
          <ol className="mt-6 space-y-3">
            {oldest.map((tea, i) => (
              <li key={tea.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <span className="mr-3 font-display text-lg tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {tea.name}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {lastSteepExact(tea.lastSteepedAt)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {due.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-medium">Longest rest</h2>
          <p className="text-sm text-muted-foreground">The five teas waiting longest. Reminders use this list only.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {due.map((tea, i) => (
              <div key={tea.id} className="space-y-2">
                <p className="text-xs text-warn tabular-nums">
                  {typeLabel(tea.type, settings.categories)} · {stockLabel(tea)} · {daysSince(tea.lastSteepedAt)} days
                  · rest {tea.restDays}d
                </p>
                <TeaCard tea={tea} rank={i + 1} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {soon.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-medium">Drink soon</h2>
          <p className="text-sm text-muted-foreground">
            Greens, yellow, herbal — they fade on the shelf.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {soon.map((tea) => (
              <div key={tea.id} className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {typeLabel(tea.type, settings.categories)} · {stockLabel(tea)}
                </p>
                <TeaCard tea={tea} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {aging.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-medium">Aging</h2>
          <p className="text-sm text-muted-foreground">
            Do not break — intentional rest. Owner can lock a cake so guests cannot log a session.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {aging.map((tea) => (
              <div key={tea.id} className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {typeLabel(tea.type, settings.categories)} · {stockLabel(tea)}
                  {tea.locked ? " · locked" : ""}
                </p>
                <TeaCard tea={tea} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {unopened.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-medium">Unopened</h2>
          <p className="text-sm text-muted-foreground">
            Still waiting for a first steep from this caddy.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {unopened.map((tea) => (
              <TeaCard key={tea.id} tea={tea} />
            ))}
          </div>
        </section>
      ) : null}

      {low.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-medium">Reorder</h2>
          <p className="text-sm text-muted-foreground">Under 20g. Last vendor if we have one.</p>
          <ul className="space-y-3">
            {low.map((tea) => (
              <li key={tea.id} className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
                <Link to="/tea/$id" params={{ id: tea.id }} className="block">
                  <p className="font-medium">{tea.name}</p>
                  <p className="text-xs text-warn tabular-nums">{stockLabel(tea)} · almost gone</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tea.vendor || "No vendor on file"}
                  </p>
                </Link>
                {tea.listingUrl ? (
                  <a
                    href={tea.listingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-celadon"
                  >
                    Open listing
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
