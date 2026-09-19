import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Download, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatJoinCode } from "@/lib/teas/codes";
import { cellarToJson, downloadText, teasToCsv } from "@/lib/teas/export";
import { dumpCellarBackup } from "@/lib/teas/api";
import { personalTasteNote, tagCounts } from "@/lib/teas/profile";
import {
  DEFAULT_LOOKUP_SOURCES,
  formatSourceList,
  parseSourceList,
  shopHosts,
} from "@/lib/teas/sources";
import {
  cloneCategories,
  DEFAULT_CATEGORIES,
  slugCategory,
  type TeaCategory,
} from "@/lib/teas/types";
import { useCellar } from "@/lib/teas/use-cellar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/share")({ component: SharePage });

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

function SharePage() {
  const {
    teas,
    cellar,
    meId,
    isLoading,
    joinCellar,
    leaveCellar,
    renameCellar,
    switchCellar,
    joining,
    settings,
    setLookupPrefs,
    setCategories,
  } = useCellar();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [savingSources, setSavingSources] = useState(false);
  const [cats, setCats] = useState<TeaCategory[]>(() => cloneCategories(settings.categories));
  const [savingCats, setSavingCats] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const dumpBackup = useServerFn(dumpCellarBackup);

  useEffect(() => {
    if (cellar) setName(cellar.name);
  }, [cellar]);

  useEffect(() => {
    setSourceText(formatSourceList(settings.lookupSources));
  }, [settings.lookupSources]);

  useEffect(() => {
    setCats(cloneCategories(settings.categories));
  }, [settings.categories]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="h-8 w-28 animate-pulse rounded-md bg-secondary" />
        <div className="h-10 w-56 animate-pulse rounded-md bg-secondary" />
        <div className="h-40 animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  if (!cellar) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="font-display text-2xl">Cellar is not open</p>
        <Link to="/" className="text-sm text-celadon">
          Back to cellar
        </Link>
      </div>
    );
  }

  const formatted = formatJoinCode(cellar.joinCode);
  const visiting = Boolean(cellar.homeId && cellar.homeId !== cellar.id);
  const guest = cellar.role === "member";
  const cellarName = cellar.name;
  const homeId = cellar.homeId;
  const taste = personalTasteNote(teas, meId);
  const tags = tagCounts(teas, meId);
  const owner = cellar.role === "owner";
  const shops = shopHosts(settings.lookupSources);

  async function saveSources(e: FormEvent) {
    e.preventDefault();
    const hosts = parseSourceList(sourceText);
    setSavingSources(true);
    try {
      await setLookupPrefs({
        pullPhotos: settings.pullPhotos,
        confirmPhotos: settings.confirmPhotos,
        lookupSources: hosts,
      });
      toast.success("Lookup sources saved.");
    } catch (err) {
      toast.error(errMsg(err, "Could not save sources."));
    } finally {
      setSavingSources(false);
    }
  }

  async function resetSources() {
    setSourceText(formatSourceList([...DEFAULT_LOOKUP_SOURCES]));
    setSavingSources(true);
    try {
      await setLookupPrefs({
        pullPhotos: settings.pullPhotos,
        confirmPhotos: settings.confirmPhotos,
        lookupSources: [...DEFAULT_LOOKUP_SOURCES],
      });
      toast.success("Back to the default shop list.");
    } catch (err) {
      toast.error(errMsg(err, "Could not reset sources."));
    } finally {
      setSavingSources(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formatted);
      toast.success("Join code copied.");
    } catch {
      toast.error("Could not copy. Write it down instead.");
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    const raw = code.trim();
    if (!raw) return;
    try {
      const result = await joinCellar(raw);
      toast.success(`${result.name} is on your shelf list. Yours stays put.`);
      setCode("");
    } catch (err) {
      toast.error(errMsg(err, "Could not join that cellar."));
    }
  }

  async function onRename(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === cellarName) return;
    setRenaming(true);
    try {
      await renameCellar(next);
      toast.success("Cellar renamed.");
    } catch (err) {
      toast.error(errMsg(err, "Could not rename the cellar."));
    } finally {
      setRenaming(false);
    }
  }

  async function onLeave() {
    setLeaving(true);
    try {
      await leaveCellar();
      toast.success("Left that cellar.");
    } catch (err) {
      toast.error(errMsg(err, "Could not leave."));
    } finally {
      setLeaving(false);
    }
  }

  async function onHome() {
    if (!homeId) return;
    setSwitching(true);
    try {
      await switchCellar(homeId);
      toast.success("Back at your shelf.");
    } catch (err) {
      toast.error(errMsg(err, "Could not switch cellars."));
    } finally {
      setSwitching(false);
    }
  }

  function exportCsv() {
    downloadText("cha-caddy.csv", teasToCsv(teas), "text/csv;charset=utf-8");
    toast.success("CSV downloaded.");
  }

  function exportJson() {
    downloadText("cha-caddy.json", cellarToJson(teas), "application/json");
    toast.success("JSON downloaded.");
  }

  async function onFullBackup() {
    setBackingUp(true);
    try {
      const result = await dumpBackup({ data: {} });
      downloadText("cha-caddy-backup.json", result.json, "application/json");
      toast.success(
        result.wroteArtifact
          ? `Full backup of ${result.teaCount} teas in ${result.cellarCount} cellar${result.cellarCount === 1 ? "" : "s"}.`
          : `Full backup of ${result.teaCount} teas.`,
      );
    } catch (err) {
      toast.error(errMsg(err, "Could not write a full backup."));
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Cellar
        </Link>
        <p className="mt-4 text-xs tracking-widest text-celadon uppercase">Household</p>
        <h1 className="mt-1 font-display text-4xl leading-none font-medium tracking-tight">
          Shared cellar
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Join codes are permanent. Your own cellar stays on the list — you never leave it to open
          someone else’s. Everyone in a joined cellar has full shelf access.
        </p>
      </div>

      <section className="space-y-4 rounded-xl bg-card px-5 py-5 shadow-[var(--shadow-border)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">This shelf</p>
            <h2 className="mt-1 truncate font-display text-2xl font-medium">{cellar.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You are {cellar.role === "owner" ? "the owner" : "a member with full access"}
            </p>
          </div>
          <Users className="size-6 shrink-0 text-celadon" strokeWidth={1.5} />
        </div>

        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Join code</p>
          <div className="mt-2 flex items-center gap-2">
            <p id="join-code-value" className="font-display text-3xl tracking-widest text-paper">
              {formatted}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void copyCode()}
              aria-label="Copy join code"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
          Anyone with this code gets a permanent seat on this shelf — their own cellar stays too.
        </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-medium">People</h2>
        <ul className="space-y-2">
          {cellar.members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]"
            >
              <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-medium text-paper">
                {initials(m.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {m.role === "owner" ? "Owner" : "Member"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(cellar.memberships ?? []).length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-medium">Your shelves</h2>
          <p className="text-sm text-muted-foreground">
            Joined cellars stay on this list. Open one without leaving the others.
          </p>
          <ul className="space-y-2">
            {(cellar.memberships ?? []).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.id === cellar.id) return;
                    setSwitching(true);
                    void switchCellar(s.id)
                      .then(() => toast.success(`Opened ${s.name}.`))
                      .catch((err) => toast.error(errMsg(err, "Could not switch shelves.")))
                      .finally(() => setSwitching(false));
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-lg bg-card px-4 text-left text-sm shadow-[var(--shadow-border)]",
                    s.id === cellar.id ? "ring-1 ring-celadon" : "",
                  )}
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.id === cellar.id ? "Open" : s.role === "owner" ? "Yours" : "Joined"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {taste || tags.length > 0 ? (
        <section className="space-y-3 rounded-xl bg-card px-5 py-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl font-medium">Your palate</h2>
          {taste ? <p className="text-sm">{taste}</p> : null}
          {tags.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Tags you use: {tags.slice(0, 5).map((t) => `${t.tag} (${t.n})`).join(", ")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Rate a few sessions and a simple note will show here — nothing public.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-xl bg-card px-5 py-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl font-medium">Your palate</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            After a handful of rated sessions, a quiet note appears here — for example that you rate
            oolong higher than raw puerh. No scores, no feed.
          </p>
        </section>
      )}

      <section id="categories" className="space-y-4 rounded-xl bg-card px-5 py-5 shadow-[var(--shadow-border)]">
        <div>
          <h2 className="font-display text-2xl font-medium">Shelf categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Top-level bins on the cellar. Keep the traditional types, or rename them — White to
            Fruity, Heicha to Dark, or add Smoky. Style stays a second level under each.
          </p>
        </div>
        <ul className="space-y-2">
          {cats.map((c, i) => (
            <li key={c.id} className="rounded-lg bg-secondary px-3 py-2">
              <div className="flex items-center gap-2">
                <Input
                  value={c.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setCats((list) =>
                      list.map((row, idx) => (idx === i ? { ...row, label } : row)),
                    );
                  }}
                  className="h-11"
                  maxLength={40}
                  aria-label={`Category ${i + 1} name`}
                />
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
                  onClick={() => setOpenCat((id) => (id === c.id ? null : c.id))}
                  aria-label={openCat === c.id ? "Hide styles" : "Edit styles"}
                >
                  {c.subtypes.length || "·"}
                </button>
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
                  onClick={() => setCats((list) => list.filter((_, idx) => idx !== i))}
                  disabled={cats.length <= 1}
                  aria-label={`Remove ${c.label}`}
                >
                  <X className="size-4" />
                </button>
              </div>
              {openCat === c.id ? (
                <Input
                  className="mt-2 h-11 text-sm"
                  value={c.subtypes.join(", ")}
                  onChange={(e) => {
                    const subtypes = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setCats((list) =>
                      list.map((row, idx) => (idx === i ? { ...row, subtypes } : row)),
                    );
                  }}
                  placeholder="Styles, comma separated"
                />
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Add a bin — Fruity, Smoky…"
            maxLength={40}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add category"
            onClick={() => {
              const label = newCat.trim();
              if (!label) return;
              let id = slugCategory(label);
              const used = new Set(cats.map((c) => c.id));
              if (used.has(id)) id = `${id}-${cats.length + 1}`;
              setCats((list) => [...list, { id, label, subtypes: [] }]);
              setNewCat("");
              setOpenCat(id);
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={savingCats || cats.length === 0}
            onClick={() => {
              void (async () => {
                const next = cats
                  .map((c) => ({
                    id: c.id || slugCategory(c.label),
                    label: c.label.trim(),
                    subtypes: c.subtypes.map((s) => s.trim()).filter(Boolean),
                  }))
                  .filter((c) => c.label);
                if (!next.length) {
                  toast.error("Keep at least one category.");
                  return;
                }
                setSavingCats(true);
                try {
                  await setCategories(next);
                  toast.success("Categories saved.");
                } catch (err) {
                  toast.error(errMsg(err, "Could not save categories."));
                } finally {
                  setSavingCats(false);
                }
              })();
            }}
          >
            {savingCats ? "Saving…" : "Save categories"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={savingCats}
            onClick={() => {
              const next = cloneCategories(DEFAULT_CATEGORIES);
              setCats(next);
              void (async () => {
                setSavingCats(true);
                try {
                  await setCategories(next);
                  toast.success("Back to the traditional types.");
                } catch (err) {
                  toast.error(errMsg(err, "Could not reset categories."));
                } finally {
                  setSavingCats(false);
                }
              })();
            }}
          >
            Reset defaults
          </Button>
        </div>
      </section>

      <section id="lookup-sources" className="space-y-4 rounded-xl bg-card px-5 py-5 shadow-[var(--shadow-border)]">
        <div>
          <h2 className="font-display text-2xl font-medium">Lookup sources</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name search looks across the open web. The list below is only a ranking boost when a
            vendor is named — clear it if you want a purely open search. Wikipedia, if listed, is
            for notes, never pictures. You always pick the page and the photo.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Pull listing photos</span>
          <button
            type="button"
            onClick={() =>
              void setLookupPrefs({
                pullPhotos: !settings.pullPhotos,
                confirmPhotos: settings.confirmPhotos,
                lookupSources: settings.lookupSources,
              })
            }
            className={cn(
              "h-11 min-w-11 rounded-full px-3 text-xs",
              settings.pullPhotos ? "bg-celadon text-celadon-fg" : "bg-secondary text-muted-foreground",
            )}
          >
            {settings.pullPhotos ? "On" : "Off"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Confirm before using a photo</span>
          <button
            type="button"
            disabled={!settings.pullPhotos}
            onClick={() =>
              void setLookupPrefs({
                pullPhotos: settings.pullPhotos,
                confirmPhotos: !settings.confirmPhotos,
                lookupSources: settings.lookupSources,
              })
            }
            className={cn(
              "h-11 min-w-11 rounded-full px-3 text-xs disabled:opacity-40",
              settings.confirmPhotos ? "bg-celadon text-celadon-fg" : "bg-secondary text-muted-foreground",
            )}
          >
            {settings.confirmPhotos ? "On" : "Off"}
          </button>
        </div>
        <form onSubmit={(e) => void saveSources(e)} className="space-y-2">
          <Label htmlFor="source-list">Shops and references — one host per line</Label>
          <Textarea
            id="source-list"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={8}
            spellCheck={false}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Ranked first when they appear in open-web results: {shops.slice(0, 6).join(", ") || "none — open web only"}.
            Clear the box and save to search the web with no shop boost.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" variant="outline" disabled={savingSources}>
              {savingSources ? "Saving…" : "Save list"}
            </Button>
            <Button type="button" variant="ghost" disabled={savingSources} onClick={() => void resetSources()}>
              Reset defaults
            </Button>
          </div>
        </form>
      </section>

      {owner ? (
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-medium">Export</h2>
          <p className="text-sm text-muted-foreground">
            Teas, stock, sessions, and notes. Yours to keep if the preview goes away.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={exportJson}>
              <Download className="size-4" /> JSON
            </Button>
            <Button type="button" variant="outline" onClick={exportCsv}>
              <Download className="size-4" /> CSV
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-2xl font-medium">Full backup</h2>
        <p className="text-sm text-muted-foreground">
          The live cellar database — every tea you can see, including ones added by hand, with
          photos, sessions, and household notes. Use this when the preview download fails.
        </p>
        <Button type="button" variant="celadon" className="w-full" onClick={() => void onFullBackup()} disabled={backingUp}>
          <Download className="size-4" />
          {backingUp ? "Writing backup…" : "Full backup"}
        </Button>
      </section>

      {cellar.role === "owner" ? (
        <form onSubmit={onRename} className="space-y-2">
          <Label htmlFor="cellar-name">Rename this cellar</Label>
          <Input
            id="cellar-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
          <Button type="submit" variant="outline" className="w-full" disabled={renaming || !name.trim()}>
            {renaming ? "Saving…" : "Save name"}
          </Button>
        </form>
      ) : null}

      <form onSubmit={onJoin} className="space-y-2">
        <Label htmlFor="join-code">Join another cellar</Label>
        <Input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC-DEF"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Button type="submit" className="w-full" disabled={joining || !code.trim()}>
          {joining ? "Joining…" : "Join with code"}
        </Button>
      </form>

      <div className="space-y-2">
        {visiting ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={switching}
            onClick={() => void onHome()}
          >
            {switching ? "Switching…" : "Back to my cellar"}
          </Button>
        ) : null}
        {guest ? (
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={leaving}
            onClick={() => void onLeave()}
          >
            {leaving ? "Leaving…" : "Leave this cellar"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Owners keep their own cellar. Guests can leave anytime; you can still switch shelves with a
            code.
          </p>
        )}
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
