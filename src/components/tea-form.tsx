import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ChevronDown, HelpCircle, Loader2, ScanLine, Search, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateTeaImage, polishDescription } from "@/lib/teas/generate";
import {
  lookupTea,
  promptUnknownTea,
  readWrapper,
  searchShops,
  searchTeaPages,
  guessTeaInfo,
  type TeaGuess,
  type TeaLookup,
} from "@/lib/teas/lookup";
import { compressDataUrl, compressImageFile } from "@/lib/teas/photos";
import { isStaticPages, PAGES_LOOKUP_MESSAGE } from "@/lib/static-pages";
import { displayTempField, parseTempField, readTempUnit, formatTempRange, useTempUnit } from "@/lib/teas/temp";
import { looksLikePageUrl, toListingUrl, type PageHit, type PhotoCandidate } from "@/lib/teas/sources";
import { useCellar } from "@/lib/teas/use-cellar";
import {
  emptyBrew,
  restDaysFor,
  STORAGE_LABEL,
  STORAGE_PLACES,
  TEA_FORM_LABEL,
  TEA_FORMS,
  subtypesFor,
  tempFor,
  tempRangeFor,
  typeLabel,
  type StoragePlace,
  type TeaCategory,
  type TeaDraft,
  type TeaForm as TeaFormKind,
  type BrewParams,
} from "@/lib/teas/types";
import { cn } from "@/lib/utils";

function rejectPagesAi(): boolean {
  if (!isStaticPages) return false;
  toast.error(PAGES_LOOKUP_MESSAGE);
  return true;
}

export function TeaForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: TeaDraft;
  submitLabel: string;
  onSubmit: (draft: TeaDraft) => void | Promise<void>;
}) {
  const lookup = useServerFn(lookupTea);
  const searchPages = useServerFn(searchTeaPages);
  const findShops = useServerFn(searchShops);
  const promptUnknown = useServerFn(promptUnknownTea);
  const ocrWrapper = useServerFn(readWrapper);
  const polishNotes = useServerFn(polishDescription);
  const makeImage = useServerFn(generateTeaImage);
  const findInfo = useServerFn(guessTeaInfo);
  const { settings, setLookupPrefs } = useCellar();
  const { unit, toggle } = useTempUnit();
  const [draft, setDraft] = useState<TeaDraft>(initial);
  const [query, setQuery] = useState(initial.name);
  const [url, setUrl] = useState(initial.listingUrl);
  const [looking, setLooking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reading, setReading] = useState(false);
  const [mode, setMode] = useState<"known" | "unknown">(initial.unknown ? "unknown" : "known");
  const [clues, setClues] = useState("");
  const [appearance, setAppearance] = useState("");
  const [dryAroma, setDryAroma] = useState("");
  const [acquiredFrom, setAcquiredFrom] = useState(initial.vendor);
  const [guesses, setGuesses] = useState<TeaGuess[]>([]);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<PhotoCandidate[]>([]);
  const [pages, setPages] = useState<PageHit[]>([]);
  const [picked, setPicked] = useState<PageHit | null>(null);
  const [focusHost, setFocusHost] = useState<string | null>(null);
  const [shopHits, setShopHits] = useState<{ host: string; title: string; url: string }[]>([]);
  const [findingShops, setFindingShops] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [genRef, setGenRef] = useState("");
  const [generating, setGenerating] = useState(false);
  const [tempText, setTempText] = useState(() => displayTempField(initial.brew, readTempUnit()));
  const [findingInfo, setFindingInfo] = useState(false);
  const [infoHits, setInfoHits] = useState<TeaLookup[]>([]);
  const [infoIndex, setInfoIndex] = useState(0);
  const [triedInfo, setTriedInfo] = useState(false);
  const infoSeed = useRef("");
  const notesText = draft.tastingNotes.join(", ");
  const searchGen = useRef(0);
  const shopGen = useRef(0);
  const skipSearch = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const categories = settings.categories;
  const subtypeOptions = subtypeChoices(draft.type, draft.subtype, categories);

  function patch(partial: Partial<TeaDraft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function withTemps(brew: BrewParams | null | undefined, temps: { tempC: number; tempLowC?: number; tempHighC?: number }): BrewParams {
    return {
      vessel: brew?.vessel || "",
      grams: brew?.grams || "",
      tempC: temps.tempC,
      ...(temps.tempLowC != null ? { tempLowC: temps.tempLowC } : {}),
      ...(temps.tempHighC != null ? { tempHighC: temps.tempHighC } : {}),
      rinse: brew?.rinse || "",
      time: brew?.time || "",
      infusions: brew?.infusions || "",
    };
  }

  function applyLookup(t: TeaLookup, fallbackName: string, extra: Partial<TeaDraft> = {}) {
    const brew = {
      vessel: "",
      grams: "",
      tempC: t.brew.tempC || tempFor(t.type, t.subtype),
      ...(t.brew.tempLowC != null ? { tempLowC: t.brew.tempLowC } : {}),
      ...(t.brew.tempHighC != null ? { tempHighC: t.brew.tempHighC } : {}),
      rinse: t.brew.rinse || "",
      time: t.brew.time || "",
      infusions: t.brew.infusions || "",
    };
    setDraft((d) => {
      return {
        ...d,
        ...extra,
        name: t.name || extra.name || d.name || fallbackName,
        nameZh: t.nameZh || d.nameZh,
        pinyin: t.pinyin || d.pinyin,
        type: t.type,
        subtype: t.subtype || d.subtype,
        origin: t.origin || d.origin,
        region: t.region || d.region,
        cultivar: t.cultivar || d.cultivar,
        vendor: extra.vendor || t.vendorGuess || d.vendor || "",
        year: extra.year || t.yearTypical || d.year || "",
        processing: t.processing || d.processing,
        description: t.description || d.description,
        tastingNotes: t.tastingNotes.length ? t.tastingNotes : d.tastingNotes,
        liquor: t.liquor || d.liquor,
        brew,
        aging: t.aging || d.aging,
        restDays: t.restDays || restDaysFor(t.type),
        sources: t.sources.length ? t.sources : d.sources,
        photoUrl: extra.photoUrl !== undefined ? extra.photoUrl : d.photoUrl,
        recipe: extra.recipe || t.recipe || d.recipe,
        listingUrl: extra.listingUrl || t.listingUrl || d.listingUrl,
        form: extra.form || t.form || d.form,
      };
    });
    setTempText(displayTempField(brew, unit));
    setQuery(t.name || fallbackName);
    skipSearch.current = true;
  }

  async function onFindInfo() {
    if (rejectPagesAi()) return;
    const name = draft.name.trim() || query.trim();
    const seed = name.toLowerCase();
    if (!draft.name.trim() && name) patch({ name });
    if (infoHits.length > 1 && infoSeed.current === seed) {
      const next = (infoIndex + 1) % infoHits.length;
      setInfoIndex(next);
      applyLookup(infoHits[next], name);
      toast.success(`Trying match ${next + 1} of ${infoHits.length}.`);
      return;
    }
    if (!name && !draft.subtype) {
      toast.error("Type a name — even a grocery nickname — then find info.");
      return;
    }
    setFindingInfo(true);
    try {
      const result = await findInfo({
        data: {
          name,
          type: draft.subtype ? draft.type : undefined,
          subtype: draft.subtype,
          origin: draft.origin,
          vendor: draft.vendor || acquiredFrom,
          notes: draft.description.slice(0, 800),
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      infoSeed.current = seed;
      setInfoHits(result.teas);
      setInfoIndex(0);
      setTriedInfo(true);
      applyLookup(result.teas[0], name);
      toast.success(
        result.teas.length > 1
          ? `Filled with the best match. Try again for ${result.teas.length - 1} more.`
          : "Filled with generic notes. Check them.",
      );
    } catch {
      toast.error("Could not find notes for that tea.");
    } finally {
      setFindingInfo(false);
    }
  }

  async function savePrefs(partial: { pullPhotos?: boolean; confirmPhotos?: boolean }) {
    const next = {
      pullPhotos: partial.pullPhotos ?? settings.pullPhotos,
      confirmPhotos: partial.confirmPhotos ?? settings.confirmPhotos,
      lookupSources: settings.lookupSources,
    };
    try {
      await setLookupPrefs(next);
    } catch {
      toast.error("Could not save lookup settings.");
    }
  }

  async function runPageSearch(q: string) {
    if (isStaticPages) {
      setSearching(false);
      return;
    }
    const gen = ++searchGen.current;
    setSearching(true);
    try {
      const result = await searchPages({
        data: { query: q, sources: settings.lookupSources, focusHost: focusHost || undefined },
      });
      if (gen !== searchGen.current) return;
      if (!result.ok) {
        setPages([]);
        return;
      }
      setPages(result.pages);
      setPicked((prev) => {
        if (!prev) return null;
        return result.pages.find((p) => p.url === prev.url) ?? null;
      });
    } catch {
      if (gen === searchGen.current) setPages([]);
    } finally {
      if (gen === searchGen.current) setSearching(false);
    }
  }

  useEffect(() => {
    const q = query.trim();
    if (mode !== "known") return;
    if (looksLikePageUrl(url) || looksLikePageUrl(q)) {
      return;
    }
    if (q.length < 2) {
      setPages([]);
      setPicked(null);
      return;
    }
    const handle = window.setTimeout(() => {
      if (skipSearch.current) {
        skipSearch.current = false;
        return;
      }
      void runPageSearch(q);
    }, 450);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode, focusHost]);

  useEffect(() => {
    setTempText(displayTempField(draft.brew, unit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  useEffect(() => {
    if (mode !== "known") return;
    const raw = url.trim();
    if (!raw || looksLikePageUrl(raw) || raw.length < 3) {
      if (!raw || looksLikePageUrl(raw)) setShopHits([]);
      return;
    }
    const handle = window.setTimeout(() => void runShopSearch(raw), 400);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, mode]);

  function commitTemp(raw: string) {
    const parsed = parseTempField(raw, unit);
    if (!parsed) {
      setTempText(displayTempField(draft.brew, unit));
      return;
    }
    setDraft((d) => ({ ...d, brew: withTemps(d.brew, parsed) }));
    setTempText(displayTempField(parsed, unit));
  }

  async function runShopSearch(q: string) {
    if (isStaticPages) {
      setFindingShops(false);
      return;
    }
    const gen = ++shopGen.current;
    setFindingShops(true);
    try {
      const result = await findShops({ data: { query: q } });
      if (gen !== shopGen.current) return;
      setShopHits(result.ok ? result.shops : []);
    } catch {
      if (gen === shopGen.current) setShopHits([]);
    } finally {
      if (gen === shopGen.current) setFindingShops(false);
    }
  }

  function pickShop(host: string) {
    setFocusHost(host);
    setShopHits([]);
    setUrl("");
    skipSearch.current = false;
    requestAnimationFrame(() => {
      document.getElementById("lookup-name")?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameRef.current?.focus();
    });
    toast.success(`Searching ${host} first.`);
    const q = query.trim();
    if (q.length >= 2 && !looksLikePageUrl(q)) void runPageSearch(q);
  }

  async function onLookup() {
    if (rejectPagesAi()) return;
    const q = query.trim() || draft.name.trim();
    const listing = (picked?.url || (looksLikePageUrl(url) ? toListingUrl(url) : looksLikePageUrl(q) ? toListingUrl(q) : "")).trim();
    if (!listing) {
      toast.error("Pick a listing, paste a page URL, or choose a shop first.");
      return;
    }
    setLooking(true);
    try {
      const result = await lookup({
        data: {
          query: q,
          url: listing,
          sources: settings.lookupSources,
          pullPhotos: settings.pullPhotos,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const photos = result.photos ?? [];
      setCandidates(photos);
      const nextPhoto = !settings.pullPhotos
        ? undefined
        : settings.confirmPhotos
          ? undefined
          : (photos[0]?.url ?? "");
      applyLookup(result.tea, q, {
        unknown: false,
        listingUrl: listing || result.tea.listingUrl,
        ...(nextPhoto !== undefined ? { photoUrl: nextPhoto } : {}),
      });
      setUrl(listing || result.tea.listingUrl);
      if (settings.pullPhotos && settings.confirmPhotos && photos.length > 0) {
        toast.success("Notes filled from that page. Confirm the photo below.");
        requestAnimationFrame(() => {
          document.getElementById("photo-candidates")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      } else if (result.tea.descriptionSource === "general") {
        toast.success("The listing had little text — filled with a general note. Check it.");
      } else {
        toast.success("Notes filled from the listing you picked.");
      }
    } catch {
      toast.error("Lookup failed. Try another listing.");
    } finally {
      setLooking(false);
    }
  }

  async function onUnknownPrompt() {
    if (rejectPagesAi()) return;
    const hasAnything = clues.trim() || appearance.trim() || dryAroma.trim() || acquiredFrom.trim();
    if (!hasAnything) {
      toast.error("Give Grok one clue — wrapper text, leaf, or where it came from.");
      return;
    }
    setLooking(true);
    try {
      const result = await promptUnknown({
        data: {
          clues: clues.trim(),
          appearance: appearance.trim(),
          dryAroma: dryAroma.trim(),
          acquiredFrom: acquiredFrom.trim(),
          suspectedType: draft.type,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const t = result.tea;
      applyLookup(t, t.name || "Unknown tea", {
        unknown: true,
        prompt: t.prompt,
        vendor: acquiredFrom.trim() || t.vendorGuess,
      });
      setGuesses(t.guesses);
      toast.success("Tasting prompt is ready — review the notes, then add it.");
    } catch {
      toast.error("Could not write a tasting prompt. Try a few more clues.");
    } finally {
      setLooking(false);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      patch({ photoUrl: dataUrl });
    } catch {
      toast.error("Could not read that photo.");
    }
  }

  async function onWrapper(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 1100, 0.78);
      setDraft((d) => ({
        ...d,
        wrapperPhotoUrl: dataUrl,
        photoUrl: d.photoUrl || dataUrl,
      }));
      if (rejectPagesAi()) return;
      setReading(true);
      const result = await ocrWrapper({ data: { image: dataUrl } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft((d) => ({
        ...d,
        recipe: result.recipe || d.recipe,
        year: result.year || d.year,
        name: d.name || result.name,
        nameZh: result.nameZh || d.nameZh,
        pinyin: result.pinyin || d.pinyin,
        vendor: result.vendor || d.vendor,
        type: result.type || d.type,
      }));
      toast.success("Wrapper read — check name and year.");
    } catch {
      toast.error("Could not read that wrapper.");
    } finally {
      setReading(false);
    }
  }

  async function onPolish() {
    if (rejectPagesAi()) return;
    const draftText = draft.description.trim();
    const notes = notesText.trim();
    if (!draftText && !notes && !draft.name.trim()) {
      toast.error("Type a few words first — malty, cocoa, deep…");
      return;
    }
    setPolishing(true);
    try {
      const result = await polishNotes({
        data: {
          name: draft.name || query,
          type: draft.type,
          subtype: draft.subtype,
          notes,
          draft: draftText,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      patch({ description: result.text });
      toast.success("Notes polished.");
    } catch {
      toast.error("Could not polish those notes.");
    } finally {
      setPolishing(false);
    }
  }

  async function onGenerateImage() {
    if (rejectPagesAi()) return;
    if (!imagePrompt.trim() && !genRef && !draft.photoUrl) {
      toast.error("Describe the leaf, or attach a photo to polish.");
      return;
    }
    setGenerating(true);
    try {
      const result = await makeImage({
        data: {
          prompt: imagePrompt.trim(),
          name: draft.name || query,
          type: draft.type,
          image: genRef || undefined,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      let url = result.url;
      try {
        url = await compressDataUrl(result.url);
      } catch {
        /* keep original */
      }
      patch({ photoUrl: url });
      toast.success("Portrait ready — keep it or generate again.");
    } catch {
      toast.error("Could not generate that photo.");
    } finally {
      setGenerating(false);
    }
  }

  async function onGenRef(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setGenRef(dataUrl);
      setShowGen(true);
    } catch {
      toast.error("Could not read that photo.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      toast.error("A tea needs a name — even “Unknown ripe tuo”.");
      return;
    }
    setSaving(true);
    try {
      const temps = parseTempField(tempText, unit);
      await onSubmit({
        ...draft,
        name: draft.name.trim(),
        listingUrl: draft.listingUrl || url.trim() || picked?.url || "",
        tastingNotes: notesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        unknown: mode === "unknown" ? true : draft.unknown,
        brew: temps ? withTemps(draft.brew, temps) : draft.brew,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          <ModeTab active={mode === "known"} onClick={() => setMode("known")} icon={<Search className="size-3.5" />}>
            I know the tea
          </ModeTab>
          <ModeTab
            active={mode === "unknown"}
            onClick={() => {
              setMode("unknown");
              patch({ unknown: true });
            }}
            icon={<HelpCircle className="size-3.5" />}
          >
            It’s unknown
          </ModeTab>
        </div>

        {mode === "known" ? (
          <>
            <div>
              <h2 className="font-display text-xl font-medium">Look it up</h2>
              <p className="text-sm text-muted-foreground">
                Type a name or cultivar, or paste a listing URL with nothing else filled in. Search
                looks across the open web — preferred shops only rank results, they don’t limit them.
                Pick a shop below to search that site first.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lookup-name" className="text-xs font-medium tracking-wide text-muted-foreground">
                Name or cultivar
              </label>
              <Input
                id="lookup-name"
                ref={nameRef}
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  if (looksLikePageUrl(v)) {
                    const listing = toListingUrl(v);
                    setUrl(listing);
                    setQuery("");
                    setPicked(null);
                    setPages([]);
                    setShopHits([]);
                    patch({ listingUrl: listing });
                    return;
                  }
                  setQuery(v);
                  if (!draft.name) patch({ name: v });
                }}
                placeholder="Ya Shi Xiang, milan dancong…"
                autoComplete="off"
              />
              {focusHost ? (
                <p className="text-xs text-celadon">
                  Searching {focusHost} first.{" "}
                  <button type="button" className="underline" onClick={() => setFocusHost(null)}>
                    Clear
                  </button>
                </p>
              ) : null}
            </div>

            {query.trim().length >= 2 && !looksLikePageUrl(query) ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">
                    {searching ? "Finding listings…" : pages.length ? "Pick the right page" : "No listings yet"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void runPageSearch(query.trim())}
                    className="flex min-h-11 items-center text-xs text-celadon"
                    disabled={searching}
                  >
                    {searching ? "Searching…" : "Find listings"}
                  </button>
                </div>
                {pages.length > 0 ? (
                  <ul className="space-y-2">
                    {pages.map((p) => {
                      const on = picked?.url === p.url;
                      return (
                        <li key={p.url}>
                          <button
                            type="button"
                            onClick={() => {
                              setPicked(p);
                              setUrl(p.url);
                            }}
                            className={cn(
                              "flex min-h-11 w-full gap-3 overflow-hidden rounded-lg bg-secondary p-2 text-left shadow-[var(--shadow-border)]",
                              on ? "ring-2 ring-celadon" : "",
                            )}
                          >
                            {p.thumbnail ? (
                              <img
                                src={p.thumbnail}
                                alt=""
                                className="size-16 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <span className="grid size-16 shrink-0 place-items-center rounded-md bg-card text-[10px] tracking-wide text-muted-foreground uppercase">
                                {p.host.replace(/\.(com|org|net)$/i, "").slice(0, 8)}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 py-0.5">
                              <span className="block truncate text-sm font-medium">{p.title}</span>
                              <span className="block truncate text-xs text-celadon">{p.host}</span>
                              {p.snippet ? (
                                <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {p.snippet}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : searching ? (
                  <p className="text-xs text-muted-foreground">Looking across shops and the web…</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No close listings. Keep typing, or paste a page URL below.
                  </p>
                )}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="lookup-url" className="text-xs font-medium tracking-wide text-muted-foreground">
                Shop name or listing URL
              </label>
              <Input
                id="lookup-url"
                value={url}
                onChange={(e) => {
                  const v = e.target.value;
                  setUrl(v);
                  if (looksLikePageUrl(v)) {
                    const listing = toListingUrl(v);
                    patch({ listingUrl: listing });
                    setPicked(null);
                    setShopHits([]);
                  }
                }}
                placeholder="sparrowtail teas, iteaworld, or https://…"
                autoComplete="off"
              />
              {looksLikePageUrl(url) ? (
                <p className="text-xs text-celadon">Ready to read this page — no name needed.</p>
              ) : findingShops ? (
                <p className="text-xs text-muted-foreground">Finding shops…</p>
              ) : shopHits.length > 0 ? (
                <ul className="space-y-1.5">
                  {shopHits.map((s) => (
                    <li key={s.host}>
                      <button
                        type="button"
                        onClick={() => pickShop(s.host)}
                        className="flex min-h-11 w-full items-center justify-between rounded-lg bg-secondary px-3 text-left text-sm"
                      >
                        <span>{s.title}</span>
                        <span className="text-xs text-celadon">{s.host}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Button
              type="button"
              variant="celadon"
              onClick={() => void onLookup()}
              disabled={looking || (!picked && !looksLikePageUrl(url))}
              className="w-full"
            >
              {looking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {looking
                ? "Reading the listing…"
                : picked
                  ? `Pull details from ${picked.host}`
                  : "Pull details from this page"}
            </Button>
            <div className="space-y-3 rounded-lg bg-secondary px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">Pull listing photos</p>
                  <p className="text-xs text-muted-foreground">Off = notes only, no pictures from the page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void savePrefs({ pullPhotos: !settings.pullPhotos })}
                  className={cn(
                    "h-11 min-w-11 shrink-0 rounded-full px-3 text-xs",
                    settings.pullPhotos ? "bg-celadon text-celadon-fg" : "bg-card text-muted-foreground",
                  )}
                >
                  {settings.pullPhotos ? "On" : "Off"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">Confirm before using a photo</p>
                  <p className="text-xs text-muted-foreground">
                    Several shots from the page you picked — you choose.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!settings.pullPhotos}
                  onClick={() => void savePrefs({ confirmPhotos: !settings.confirmPhotos })}
                  className={cn(
                    "h-11 min-w-11 shrink-0 rounded-full px-3 text-xs disabled:opacity-40",
                    settings.confirmPhotos ? "bg-celadon text-celadon-fg" : "bg-card text-muted-foreground",
                  )}
                >
                  {settings.confirmPhotos ? "On" : "Off"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Search looks across the web. The preferred list only ranks results — empty it for a
                purely open search.{" "}
                <Link to="/share" className="text-celadon">
                  Edit list
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="font-display text-xl font-medium">Unknown leaf</h2>
              <p className="text-sm text-muted-foreground">
                Wrapper you can’t read, a gift with no name, a tuo from a trip. Give Grok whatever
                you have — it writes a tasting prompt so the first session can identify it.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="unknown-clues" className="text-xs font-medium tracking-wide text-muted-foreground">
                What you know
              </label>
              <Textarea
                id="unknown-clues"
                value={clues}
                onChange={(e) => setClues(e.target.value)}
                rows={3}
                placeholder="Characters on the wrapper, factory code, compressed cake vs loose, dark leaf, gift from…"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="unknown-look" className="text-xs font-medium tracking-wide text-muted-foreground">
                  Leaf / wrapper
                </label>
                <Input
                  id="unknown-look"
                  value={appearance}
                  onChange={(e) => setAppearance(e.target.value)}
                  placeholder="Tight tuo, gold tips, bamboo wrap"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="unknown-nose" className="text-xs font-medium tracking-wide text-muted-foreground">
                  Dry aroma
                </label>
                <Input
                  id="unknown-nose"
                  value={dryAroma}
                  onChange={(e) => setDryAroma(e.target.value)}
                  placeholder="Damp wood, smoke, none yet"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="unknown-from" className="text-xs font-medium tracking-wide text-muted-foreground">
                Where it came from
              </label>
              <Input
                id="unknown-from"
                value={acquiredFrom}
                onChange={(e) => {
                  setAcquiredFrom(e.target.value);
                  patch({ vendor: e.target.value });
                }}
                placeholder="Market stall, friend, unlabeled sample"
              />
            </div>
            <Button
              type="button"
              variant="celadon"
              onClick={() => void onUnknownPrompt()}
              disabled={looking}
              className="w-full"
            >
              {looking ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {looking ? "Writing the prompt…" : "Generate tasting prompt"}
            </Button>
          </>
        )}
      </section>

      {draft.prompt ? (
        <section className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-celadon" />
            <h2 className="font-display text-xl font-medium">Tasting prompt</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Saved on the tea. Follow it the first time you brew — then log what you actually tasted.
          </p>
          {guesses.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {guesses.map((g) => (
                <li key={g.name}>
                  <span className="text-paper">{g.name}</span>
                  {g.why ? <span className="text-muted-foreground"> — {g.why}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {draft.prompt}
          </pre>
        </section>
      ) : null}

      {candidates.length > 0 ? (
        <section id="photo-candidates" className="space-y-2 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="font-display text-xl font-medium">Confirm a listing photo</p>
          <p className="text-xs text-muted-foreground">
            Shots from the page you picked — portrait of the leaf, or wrapper / nei fei. Skip if none match what you have.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((p) => {
              const asPortrait = draft.photoUrl === p.url;
              const asWrapper = draft.wrapperPhotoUrl === p.url;
              return (
                <div
                  key={p.url}
                  className={cn(
                    "overflow-hidden rounded-lg bg-secondary text-left shadow-[var(--shadow-border)]",
                    asPortrait || asWrapper ? "ring-2 ring-celadon" : "",
                  )}
                >
                  <img src={p.url} alt="" className="aspect-photo w-full object-cover" />
                  <span className="block px-2 pt-2 text-xs leading-snug text-muted-foreground">{p.label}</span>
                  <div className="flex gap-1 px-2 pb-2 pt-1">
                    <button
                      type="button"
                      onClick={() => patch({ photoUrl: p.url })}
                      className={cn(
                        "h-9 flex-1 rounded-md text-[11px]",
                        asPortrait ? "bg-celadon text-celadon-fg" : "bg-card text-muted-foreground",
                      )}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ wrapperPhotoUrl: p.url })}
                      className={cn(
                        "h-9 flex-1 rounded-md text-[11px]",
                        asWrapper ? "bg-celadon text-celadon-fg" : "bg-card text-muted-foreground",
                      )}
                    >
                      Wrapper
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => patch({ photoUrl: "", wrapperPhotoUrl: draft.wrapperPhotoUrl })}
            className="flex min-h-11 items-center text-xs text-muted-foreground"
          >
            No portrait — I’ll add my own
          </button>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-medium">In the caddy</h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => void onFindInfo()}
          disabled={findingInfo}
          className="w-full"
        >
          {findingInfo ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {findingInfo
            ? "Finding notes…"
            : infoHits.length || triedInfo
              ? "Try again"
              : "Find tea info"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Uses the name, type, and style you filled. Fills generic notes from chinesetea.life and the web — for grocery or travel teas with no listing. Try again cycles the next match.
        </p>
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => {
              patch({ name: e.target.value });
              if (infoHits.length || triedInfo) {
                setInfoHits([]);
                setTriedInfo(false);
                infoSeed.current = "";
              }
            }}
            required
            placeholder={mode === "unknown" ? "Unknown ripe tuo, unlabeled bing…" : undefined}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chinese">
            <Input value={draft.nameZh} onChange={(e) => patch({ nameZh: e.target.value })} />
          </Field>
          <Field label="Pinyin">
            <Input value={draft.pinyin} onChange={(e) => patch({ pinyin: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={draft.type}
              onValueChange={(v) => {
                const type = v;
                patch({
                  type,
                  subtype: "",
                  restDays:
                    draft.restDays === restDaysFor(draft.type)
                      ? restDaysFor(type)
                      : draft.restDays,
                  brew: {
                    ...emptyBrew(),
                    tempC: tempFor(type, ""),
                    time: draft.brew?.time || "",
                  },
                });
                setTempText(displayTempField({ tempC: tempFor(type, "") }, unit));
                infoSeed.current = "";
                setInfoHits([]);
                setTriedInfo(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
                {categories.some((c) => c.id === draft.type) ? null : (
                  <SelectItem value={draft.type}>{typeLabel(draft.type, categories)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Style">
            <Select
              value={draft.subtype || "none"}
              onValueChange={(v) => {
                const subtype = v === "none" ? "" : v;
                patch({
                  subtype,
                  brew: {
                    ...emptyBrew(),
                    tempC: tempFor(draft.type, subtype),
                    time: draft.brew?.time || "",
                  },
                });
                setTempText(displayTempField({ tempC: tempFor(draft.type, subtype) }, unit));
                infoSeed.current = "";
                setInfoHits([]);
                setTriedInfo(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {subtypeOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Type first, then style.{" "}
          <Link to="/share" hash="categories" className="text-celadon">
            Rename or add bins
          </Link>
        </p>
        <button
          type="button"
          onClick={() => document.getElementById("tea-photo")?.click()}
          className="relative block w-full overflow-hidden rounded-xl bg-secondary"
        >
          {draft.photoUrl ? (
            <img src={draft.photoUrl} alt="" className="aspect-photo w-full object-cover" />
          ) : (
            <div className="flex aspect-photo flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Upload className="size-5" />
              Photo of the wrapper, cake, or dry leaf
            </div>
          )}
        </button>
        <input
          id="tea-photo"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
        <div>
          <button
            type="button"
            onClick={() => setShowGen((v) => !v)}
            className="flex min-h-11 items-center gap-1.5 text-xs text-celadon"
            aria-expanded={showGen}
          >
            <Sparkles className="size-3.5" />
            Generate a photo
            <ChevronDown className={cn("size-3.5 transition-transform", showGen ? "rotate-180" : "")} />
          </button>
          {showGen ? (
            <div className="mt-2 space-y-2 rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">
                Describe the leaf, or snap what you have — Grok turns it into a clean portrait.
              </p>
              <Textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                rows={2}
                placeholder="tight dark Assam, gold tips, malty…"
              />
              {genRef ? (
                <div className="flex items-center gap-2">
                  <img src={genRef} alt="" className="size-12 rounded-md object-cover" />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground"
                    onClick={() => setGenRef("")}
                  >
                    Remove reference
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("tea-gen-ref")?.click()}
                >
                  <Camera className="size-4" />
                  {genRef ? "Change photo" : "Use a photo"}
                </Button>
                <Button
                  type="button"
                  variant="celadon"
                  onClick={() => void onGenerateImage()}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {generating ? "Making…" : "Generate"}
                </Button>
              </div>
              <input
                id="tea-gen-ref"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => void onGenRef(e.target.files?.[0])}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">Wrapper / ticket</p>
          <button
            type="button"
            onClick={() => document.getElementById("tea-wrapper")?.click()}
            className="flex w-full items-center gap-3 overflow-hidden rounded-lg bg-secondary"
          >
            {draft.wrapperPhotoUrl ? (
              <img src={draft.wrapperPhotoUrl} alt="" className="size-16 object-cover" />
            ) : (
              <span className="grid size-16 place-items-center text-muted-foreground">
                <ScanLine className="size-5" />
              </span>
            )}
            <span className="py-3 pr-3 text-left text-sm">
              {reading ? "Reading characters…" : "Snap the nei fei, wrapper, or a shop screenshot"}
            </span>
          </button>
          <input
            id="tea-wrapper"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => void onWrapper(e.target.files?.[0])}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Year / vintage">
            <Input value={draft.year} onChange={(e) => patch({ year: e.target.value })} />
          </Field>
          <Field label="Form">
            <Select value={draft.form} onValueChange={(v) => patch({ form: v as TeaFormKind })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEA_FORMS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {TEA_FORM_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Origin">
          <Input value={draft.origin} onChange={(e) => patch({ origin: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Region">
            <Input value={draft.region} onChange={(e) => patch({ region: e.target.value })} />
          </Field>
          <Field label="Cultivar">
            <Input value={draft.cultivar} onChange={(e) => patch({ cultivar: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor">
            <Input value={draft.vendor} onChange={(e) => patch({ vendor: e.target.value })} />
          </Field>
          <Field label="Recipe">
            <Input
              value={draft.recipe}
              onChange={(e) => patch({ recipe: e.target.value })}
              placeholder="7542, V93…"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="What’s in the caddy">
            <Input
              value={draft.quantity}
              onChange={(e) => patch({ quantity: e.target.value })}
              placeholder="50g pouch, a cake…"
            />
          </Field>
          <Field label="Storage">
            <Select value={draft.storage} onValueChange={(v) => patch({ storage: v as StoragePlace })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_PLACES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STORAGE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Listing URL">
          <Input
            value={draft.listingUrl}
            onChange={(e) => patch({ listingUrl: e.target.value })}
            placeholder="https://…"
            inputMode="url"
          />
        </Field>
        <Field label="Description">
          <div className="relative">
            <Textarea
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={10}
              placeholder="malty, deep, chocolatey — or a full note"
              className="min-h-48 max-h-[70vh] resize-y overflow-y-auto pr-20"
            />
            <button
              type="button"
              onClick={() => void onPolish()}
              disabled={polishing}
              className="absolute top-2 right-2 flex h-9 items-center gap-1 rounded-md px-2 text-xs text-celadon"
              aria-label="Polish notes with Grok"
            >
              {polishing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {polishing ? "Writing…" : "Polish"}
            </button>
          </div>
        </Field>
        <Field label="Tasting notes">
          <Input
            value={notesText}
            onChange={(e) =>
              patch({
                tastingNotes: e.target.value.split(",").map((s) => s.trim()),
              })
            }
            placeholder="camphor, dried apricot, huigan"
          />
        </Field>
        <Field label="Processing">
          <Textarea
            value={draft.processing}
            onChange={(e) => patch({ processing: e.target.value })}
            rows={3}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rest days">
            <Input
              type="number"
              min={1}
              max={365}
              value={draft.restDays}
              onChange={(e) => patch({ restDays: Number(e.target.value) || 14 })}
            />
          </Field>
          <Field label="Acquired">
            <Input
              type="date"
              value={draft.acquiredAt.slice(0, 10)}
              onChange={(e) => patch({ acquiredAt: e.target.value })}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Rest days drive the reminders — after this many days without a cup, the tea surfaces on
          Resting as overdue.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">Water</h2>
        <Field label="Recommended temperature">
          <div className="flex gap-2">
            <Input
              value={tempText}
              inputMode="text"
              onChange={(e) => setTempText(e.target.value)}
              onBlur={(e) => commitTemp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTemp(tempText);
                }
              }}
              placeholder={unit === "F" ? "195–205" : "90–96"}
              aria-label="Brew temperature or range"
            />
            <button
              type="button"
              onClick={toggle}
              className="h-11 shrink-0 rounded-md bg-secondary px-3 text-sm tabular-nums text-celadon"
            >
              °{unit}
            </button>
          </div>
        </Field>
        <p className="text-xs text-muted-foreground">
          {formatTempRange(tempRangeFor(draft.type), unit)} is typical for {typeLabel(draft.type, categories).toLowerCase()}
          {draft.subtype ? ` · ${draft.subtype}` : ""}. A range like {unit === "F" ? "195–205" : "90–96"} is fine. Tap °{unit} to switch.
        </p>
      </section>

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function subtypeChoices(type: string, current: string, categories: TeaCategory[]): string[] {
  const list = [...subtypesFor(type, categories)];
  if (current && !list.includes(current)) list.unshift(current);
  return list;
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-xs tracking-wide",
        active ? "bg-card text-foreground" : "text-muted-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
