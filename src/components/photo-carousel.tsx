import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, ScanLine, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchTeaImage, searchTeaImages, type WebPhoto } from "@/lib/teas/lookup";
import {
  compressDataUrl,
  compressImageFile,
  newPhotoId,
  removePhoto,
  setPhotoKind,
  upsertPhoto,
} from "@/lib/teas/photos";
import type { PhotoKind, TeaPhoto } from "@/lib/teas/types";
import { cn } from "@/lib/utils";

export function PhotoCarousel({
  photos,
  alt,
  index,
  onIndexChange,
  className,
}: {
  photos: TeaPhoto[];
  alt: string;
  index?: number;
  onIndexChange?: (i: number) => void;
  className?: string;
}) {
  const list = photos.filter((p) => p.url);
  const [local, setLocal] = useState(0);
  const controlled = index != null;
  const i = controlled ? Math.min(index, Math.max(0, list.length - 1)) : local;

  useEffect(() => {
    if (controlled) return;
    if (local >= list.length) setLocal(Math.max(0, list.length - 1));
  }, [controlled, list.length, local]);

  if (list.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-photo items-center justify-center bg-secondary text-sm text-muted-foreground",
          className,
        )}
      >
        No photo yet
      </div>
    );
  }

  const photo = list[i] ?? list[0];
  const go = (next: number) => {
    const n = (next + list.length) % list.length;
    if (controlled) onIndexChange?.(n);
    else setLocal(n);
  };

  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      <img src={photo.url} alt={alt} className="aspect-photo w-full object-cover" />
      {photo.kind ? (
        <span className="absolute top-2 left-2 rounded-full bg-background/80 px-2 py-0.5 text-xs text-paper">
          {photo.kind === "packaging" ? "Packaging" : "Tea"}
        </span>
      ) : null}
      {list.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(i - 1);
            }}
            className="absolute top-1/2 left-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/70 text-foreground"
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(i + 1);
            }}
            className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/70 text-foreground"
            aria-label="Next photo"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {list.map((p, j) => (
              <button
                key={p.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  go(j);
                }}
                className={cn(
                  "size-2 rounded-full",
                  j === i ? "bg-celadon" : "bg-foreground/40",
                )}
                aria-label={`Photo ${j + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

const KINDS: { id: PhotoKind; label: string }[] = [
  { id: "tea", label: "Tea" },
  { id: "packaging", label: "Packaging" },
  { id: "", label: "Unlabeled" },
];

export function PhotoEditor({
  photos,
  onChange,
  onReadWrapper,
  reading,
  searchName,
  teaType,
  subtype,
  generating,
  showGen,
  onToggleGen,
  imagePrompt,
  onImagePrompt,
  genRef,
  onGenRef,
  onClearRef,
  onGenerate,
}: {
  photos: TeaPhoto[];
  onChange: (photos: TeaPhoto[]) => void;
  onReadWrapper: (dataUrl: string) => void | Promise<void>;
  reading: boolean;
  searchName: string;
  teaType: string;
  subtype: string;
  generating: boolean;
  showGen: boolean;
  onToggleGen: () => void;
  imagePrompt: string;
  onImagePrompt: (v: string) => void;
  genRef: string;
  onGenRef: (file: File | undefined) => void;
  onClearRef: () => void;
  onGenerate: () => void;
}) {
  const findImages = useServerFn(searchTeaImages);
  const pullImage = useServerFn(fetchTeaImage);
  const [index, setIndex] = useState(0);
  const [finding, setFinding] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const [hits, setHits] = useState<WebPhoto[]>([]);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (index >= photos.length) setIndex(Math.max(0, photos.length - 1));
  }, [photos.length, index]);

  const current = photos[index];

  function commit(next: TeaPhoto[], focusId?: string) {
    onChange(next);
    if (focusId) {
      const i = next.findIndex((p) => p.id === focusId);
      if (i >= 0) setIndex(i);
    } else {
      setIndex(Math.max(0, next.length - 1));
    }
  }

  async function addFile(file: File | undefined, kind: PhotoKind) {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, kind === "packaging" ? 1100 : 900, kind === "packaging" ? 0.78 : 0.72);
      const photo: TeaPhoto = { id: newPhotoId(), url: dataUrl, kind };
      commit([...photos, photo], photo.id);
      if (kind === "packaging") await onReadWrapper(dataUrl);
    } catch {
      toast.error("Could not read that photo.");
    }
  }

  async function onFind() {
    const name = searchName.trim();
    if (!name && !subtype) {
      toast.error("Type a name first, then search photos.");
      return;
    }
    setFinding(true);
    setTried(true);
    try {
      const result = await findImages({ data: { name, type: teaType, subtype } });
      if (!result.ok) {
        setHits([]);
        toast.error(result.error);
        return;
      }
      setHits(result.photos);
    } catch {
      toast.error("Could not search photos.");
    } finally {
      setFinding(false);
    }
  }

  async function pickHit(hit: WebPhoto) {
    setPulling(hit.url);
    try {
      const result = await pullImage({ data: { url: hit.url } });
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
      const next = upsertPhoto(photos, url, "tea");
      const added = next.find((p) => p.url === url);
      commit(next, added?.id);
      toast.success("Photo added — label it tea or packaging if you want.");
    } catch {
      toast.error("Could not pull that photo in.");
    } finally {
      setPulling(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-secondary">
        {photos.length ? (
          <PhotoCarousel photos={photos} alt="" index={index} onIndexChange={setIndex} />
        ) : (
          <button
            type="button"
            onClick={() => document.getElementById("tea-photo-file")?.click()}
            className="flex aspect-photo w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Upload className="size-5" />
            Photo of the leaf, cake, or packaging
          </button>
        )}
      </div>

      {current ? (
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {KINDS.map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => onChange(setPhotoKind(photos, current.id, k.id))}
              className={cn(
                "h-10 flex-1 rounded-md text-xs",
                current.kind === k.id ? "bg-card text-foreground" : "text-muted-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => document.getElementById("tea-photo-file")?.click()}>
          <Camera className="size-4" />
          Add photo
        </Button>
        <Button type="button" variant="outline" onClick={() => document.getElementById("tea-wrapper-file")?.click()}>
          <ScanLine className="size-4" />
          {reading ? "Reading…" : "Snap wrapper"}
        </Button>
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={() => void onFind()} disabled={finding}>
        {finding ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {finding ? "Searching photos…" : "Find photos online"}
      </Button>
      <p className="text-xs text-muted-foreground">
        For grocery or travel teas — search the web for a leaf shot you can keep. Label it tea or packaging.
      </p>

      {current ? (
        <button
          type="button"
          onClick={() => commit(removePhoto(photos, current.id))}
          className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Trash2 className="size-3.5" />
          Remove this photo
        </button>
      ) : null}

      {tried && !finding && hits.length === 0 ? (
        <p className="text-xs text-muted-foreground">No photos found. Try a clearer name.</p>
      ) : null}
      {hits.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {hits.map((p) => {
            const busy = pulling === p.url;
            return (
              <button
                key={p.url}
                type="button"
                onClick={() => void pickHit(p)}
                disabled={Boolean(pulling)}
                className="overflow-hidden rounded-lg bg-secondary text-left shadow-[var(--shadow-border)] disabled:opacity-60"
              >
                <img src={p.url} alt="" className="aspect-photo w-full object-cover" />
                <span className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {busy ? <Loader2 className="size-3 animate-spin" /> : null}
                  {p.source}
                  {p.label ? ` · ${p.label}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={onToggleGen}
          className="flex min-h-11 items-center gap-1.5 text-xs text-celadon"
          aria-expanded={showGen}
        >
          <Sparkles className="size-3.5" />
          Generate a photo
        </button>
        {showGen ? (
          <div className="mt-2 space-y-2 rounded-lg bg-secondary p-3">
            <p className="text-xs text-muted-foreground">
              Describe the leaf, or snap what you have — Grok turns it into a clean portrait.
            </p>
            <Textarea
              value={imagePrompt}
              onChange={(e) => onImagePrompt(e.target.value)}
              rows={2}
              placeholder="tight dark Assam, gold tips, malty…"
            />
            {genRef ? (
              <div className="flex items-center gap-2">
                <img src={genRef} alt="" className="size-12 rounded-md object-cover" />
                <button type="button" className="text-xs text-muted-foreground" onClick={onClearRef}>
                  Remove reference
                </button>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => document.getElementById("tea-gen-ref")?.click()}>
                <Camera className="size-4" />
                {genRef ? "Change photo" : "Use a photo"}
              </Button>
              <Button type="button" variant="celadon" onClick={onGenerate} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {generating ? "Making…" : "Generate"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <input
        id="tea-photo-file"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void addFile(e.target.files?.[0], "tea");
          e.target.value = "";
        }}
      />
      <input
        id="tea-wrapper-file"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void addFile(e.target.files?.[0], "packaging");
          e.target.value = "";
        }}
      />
      <input
        id="tea-gen-ref"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          onGenRef(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
