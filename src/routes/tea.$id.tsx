import { useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format as formatDate } from "date-fns";
import { ArrowLeft, Lock, Pencil, Sparkles, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { GongfuTimer } from "@/components/gongfu-timer";
import { PhotoCarousel } from "@/components/photo-carousel";
import { SteepDialog } from "@/components/steep-dialog";
import { TeaComments } from "@/components/tea-comments";
import { TeaForm } from "@/components/tea-form";
import { TypeSeal, MotifWash } from "@/components/type-seal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBrewTemp, formatTempRange, useTempUnit } from "@/lib/teas/temp";
import { daysSince, lastSteepExact, lastSteepLabel, restStatus } from "@/lib/teas/dates";
import { useCellar } from "@/lib/teas/use-cellar";
import {
  STORAGE_LABEL,
  TEA_FORM_LABEL,
  identityLine,
  stockLabel,
  teaToDraft,
  tempRangeFor,
  typeLabel,
} from "@/lib/teas/types";
import { photosOf } from "@/lib/teas/photos";

export const Route = createFileRoute("/tea/$id")({ component: TeaDetailPage });

function TeaDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { teas, isLoading, updateTea, removeTea, cellar, settings } = useCellar();
  const { format: formatTemp, toggle, unit } = useTempUnit();
  const tea = teas.find((t) => t.id === id);
  const [steepOpen, setSteepOpen] = useState(false);
  const [steepTimes, setSteepTimes] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [locking, setLocking] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="aspect-photo animate-pulse rounded-xl bg-card" />
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-secondary" />
      </div>
    );
  }

  if (!tea) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="font-display text-2xl">Not in the caddy</p>
        <Link to="/" className="text-sm text-celadon">
          Back to cellar
        </Link>
      </div>
    );
  }

  const status = restStatus(tea);
  const days = daysSince(tea.lastSteepedAt);
  const identity = identityLine(tea);
  const last = tea.sessions[0];
  const owner = cellar?.role === "owner";
  const teaId = tea.id;
  const teaLocked = tea.locked;

  async function toggleLock() {
    setLocking(true);
    try {
      await updateTea(teaId, { locked: !teaLocked });
      toast.success(teaLocked ? "Cake unlocked." : "Cake locked — others cannot log a break.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the lock.");
    } finally {
      setLocking(false);
    }
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Cancel
        </button>
        <h1 className="font-display text-3xl font-medium">Edit {tea.name}</h1>
        <TeaForm
          initial={teaToDraft(tea)}
          submitLabel="Save changes"
          onSubmit={async (draft) => {
            await updateTea(tea.id, draft);
            setEditing(false);
            toast.success("Cellar notes updated.");
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute -inset-x-4 -top-6 bottom-0 min-h-[calc(100dvh-8rem)] overflow-hidden">
        <MotifWash tea={tea} tone="page" />
      </div>
    <article className="relative z-10 mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Cellar
        </Link>
        <div className="flex gap-1">
          {owner ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void toggleLock()}
              disabled={locking}
              aria-label={tea.locked ? "Unlock" : "Lock"}
            >
              {tea.locked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="Remove from cellar"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <PhotoCarousel photos={photosOf(tea)} alt={tea.name} />
        <div className="space-y-2 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <TypeSeal type={tea.type} label={typeLabel(tea.type, settings.categories)} />
            {tea.subtype ? <Badge>{tea.subtype}</Badge> : null}
            {tea.form ? <Badge>{TEA_FORM_LABEL[tea.form]}</Badge> : null}
            {tea.unknown ? <Badge variant="paper">Unknown</Badge> : null}
            {tea.locked ? <Badge variant="paper">Locked</Badge> : null}
            {status === "due" ? <Badge variant="warn">Past rest</Badge> : null}
            {status === "unopened" ? <Badge variant="paper">Unopened</Badge> : null}
          </div>
          <h1 className="font-display text-4xl leading-tight font-medium tracking-tight">
            {tea.name}
          </h1>
          {tea.nameZh ? (
            <p className="text-lg text-paper">
              {tea.nameZh}
              {tea.pinyin ? <span className="text-muted-foreground"> · {tea.pinyin}</span> : null}
            </p>
          ) : null}
          {identity ? <p className="text-sm text-paper">{identity}</p> : null}
          {tea.origin ? <p className="text-sm text-muted-foreground">{tea.origin}</p> : null}
        </div>
      </div>

      <section className="rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Stock</p>
        <p className="mt-1 font-display text-3xl leading-none">{stockLabel(tea)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {STORAGE_LABEL[tea.storage]}
        </p>
        {tea.listingUrl ? (
          <a
            href={tea.listingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-celadon"
          >
            Vendor listing
          </a>
        ) : tea.vendor ? (
          <p className="mt-2 text-sm text-muted-foreground">{tea.vendor}</p>
        ) : null}
      </section>

      <section className="rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Last session</p>
        <p className="mt-1 font-display text-3xl leading-none">
          {status === "unopened" ? "Never" : lastSteepLabel(tea.lastSteepedAt)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {lastSteepExact(tea.lastSteepedAt)}
          {tea.lastDrinkerName ? ` · ${tea.lastDrinkerName}` : ""}
          {days != null ? ` · ${days} day${days === 1 ? "" : "s"} ago` : ""}
          {" · "}rest every {tea.restDays} days
        </p>
        {last ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              last.vessel,
              last.leafGrams != null ? `${last.leafGrams}g` : null,
              last.waterMl != null ? `${last.waterMl}ml` : null,
              last.waterTemp != null ? formatTemp(last.waterTemp) : null,
              last.infusionCount != null ? `${last.infusionCount} inf.` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <Button className="mt-4 w-full" size="lg" onClick={() => setSteepOpen(true)}>
          I steeped this
        </Button>
      </section>

      <GongfuTimer
        tea={tea}
        times={steepTimes}
        onTimes={setSteepTimes}
        onPersistSchedule={(times, brewTime) => {
          void updateTea(teaId, {
            lastSteepTimes: times,
            brew: {
              vessel: tea.brew?.vessel ?? "",
              grams: tea.brew?.grams ?? "",
              tempC: tea.brew?.tempC ?? 95,
              ...(tea.brew?.tempLowC != null ? { tempLowC: tea.brew.tempLowC } : {}),
              ...(tea.brew?.tempHighC != null ? { tempHighC: tea.brew.tempHighC } : {}),
              rinse: tea.brew?.rinse ?? "",
              time: brewTime,
              infusions: tea.brew?.infusions ?? "",
            },
          });
        }}
      />

      {tea.prompt ? (
        <section className="space-y-3 rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-celadon" />
            <h2 className="font-display text-2xl font-medium">Tasting prompt</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Written for the first session — what to look at, smell, and ask of the leaf.
          </p>
          <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {tea.prompt}
          </pre>
        </section>
      ) : null}

      {tea.brew ? (
        <section className="space-y-3 rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl font-medium">Water</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Stat
              label="Recommended"
              value={
                <button type="button" onClick={toggle} className="tabular-nums">
                  {formatBrewTemp(tea.brew, unit) || formatTemp(tea.brew.tempC)}
                </button>
              }
            />
            <Stat
              label="Typical for type"
              value={
                <button type="button" onClick={toggle} className="tabular-nums">
                  {formatTempRange(tempRangeFor(tea.type), unit)}
                </button>
              }
            />
          </dl>
        </section>
      ) : null}

      {tea.description ? (
        <section className="space-y-2 rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl font-medium">Notes</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90">{tea.description}</p>
        </section>
      ) : null}

      {tea.tastingNotes.length > 0 ? (
        <section className="space-y-3 rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl font-medium">In the cup</h2>
          {tea.liquor ? <p className="text-sm text-muted-foreground">{tea.liquor}</p> : null}
          <ul className="flex flex-wrap gap-2">
            {tea.tastingNotes.map((n) => (
              <li key={n}>
                <Badge>{n}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {tea.vendor ? <Stat label="Vendor" value={tea.vendor} /> : null}
        {tea.cultivar ? <Stat label="Cultivar" value={tea.cultivar} /> : null}
        {tea.region ? <Stat label="Region" value={tea.region} /> : null}
        {tea.processing ? <Stat label="Processing" value={tea.processing} /> : null}
        {tea.aging ? <Stat label="Aging" value={tea.aging} /> : null}
      </dl>

      {tea.sessions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-medium">Sessions</h2>
          <ol className="space-y-3">
            {tea.sessions.map((s) => (
              <li key={s.id} className="rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(new Date(s.steepedAt), "d MMMM yyyy · HH:mm")}
                  {s.authorName ? ` · ${s.authorName}` : ""}
                  {s.rating ? ` · ${s.rating}/5` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    s.vessel,
                    s.leafGrams != null ? `${s.leafGrams}g` : null,
                    s.waterMl != null ? `${s.waterMl}ml` : null,
                    s.waterTemp != null ? formatTemp(s.waterTemp) : null,
                    s.infusionCount != null ? `${s.infusionCount} inf.` : null,
                    s.steepTimes.length ? s.steepTimes.map((t) => `${t}s`).join(" → ") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {s.tasteTags.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {s.tasteTags.map((tag) => (
                      <li key={tag}>
                        <Badge>{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {s.note ? <p className="mt-1 text-sm">{s.note}</p> : null}
                {s.liquorPhotoUrl || s.wetLeafPhotoUrl ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {s.liquorPhotoUrl ? (
                      <img src={s.liquorPhotoUrl} alt="Liquor" className="aspect-photo rounded-md object-cover" />
                    ) : null}
                    {s.wetLeafPhotoUrl ? (
                      <img src={s.wetLeafPhotoUrl} alt="Wet leaf" className="aspect-photo rounded-md object-cover" />
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <TeaComments tea={tea} />

      {tea.sources.length > 0 ? (
        <p className="text-xs text-muted-foreground">Sources: {tea.sources.slice(0, 4).join(" · ")}</p>
      ) : null}

      <SteepDialog
        tea={tea}
        open={steepOpen}
        onOpenChange={setSteepOpen}
        steepTimes={steepTimes}
        onLogged={() => setSteepTimes([])}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {tea.name}?</DialogTitle>
            <DialogDescription>
              The tea and its steep log leave this caddy. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={removing}
              onClick={() => {
                setRemoving(true);
                void removeTea(tea.id)
                  .then(() => {
                    toast.success("Removed from the cellar.");
                    void navigate({ to: "/" });
                  })
                  .catch(() => {
                    setRemoving(false);
                    toast.error("Could not remove that tea.");
                  });
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]">
      <dt className="text-xs tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
