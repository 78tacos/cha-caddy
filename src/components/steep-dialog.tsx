import { useEffect, useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gramsFromBrew } from "@/lib/teas/brew";
import { compressImageFile } from "@/lib/teas/photos";
import { displayTempField, parseTempField, readTempUnit, useTempUnit } from "@/lib/teas/temp";
import { useCellar } from "@/lib/teas/use-cellar";
import {
  TASTE_TAGS,
  VESSEL_LABEL,
  VESSELS,
  type Tea,
  type VesselKind,
} from "@/lib/teas/types";
import { cn } from "@/lib/utils";

function guessVessel(raw: string): VesselKind {
  const s = raw.toLowerCase();
  if (s.includes("yixing") || s.includes("clay")) return "yixing";
  if (s.includes("grandpa") || s.includes("mug")) return "grandpa";
  if (s.includes("cup") || s.includes("bowl")) return "cup";
  return "gaiwan";
}

export function SteepDialog({
  tea,
  open,
  onOpenChange,
  steepTimes,
  onLogged,
}: {
  tea: Tea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steepTimes: number[];
  onLogged?: () => void;
}) {
  const { logSteep, cellar } = useCellar();
  const { unit, toggle } = useTempUnit();
  const lockedOut = tea.locked && cellar?.role !== "owner";
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [vessel, setVessel] = useState<VesselKind>(guessVessel(tea.lastVessel || tea.brew?.vessel || ""));
  const [leafGrams, setLeafGrams] = useState(String(gramsFromBrew(tea.brew)));
  const [waterMl, setWaterMl] = useState("100");
  const [waterTempC, setWaterTempC] = useState(tea.brew?.tempC ?? 95);
  const [tempText, setTempText] = useState(() => displayTempField({ tempC: tea.brew?.tempC ?? 95 }, readTempUnit()));
  const [infusions, setInfusions] = useState(String(steepTimes.length || 8));
  const [when, setWhen] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [liquor, setLiquor] = useState("");
  const [wet, setWet] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInfusions(String(steepTimes.length || 8));
    setWhen(new Date().toISOString().slice(0, 16));
    const nextC = tea.brew?.tempC ?? 95;
    setWaterTempC(nextC);
    setTempText(displayTempField({ tempC: nextC, tempLowC: tea.brew?.tempLowC, tempHighC: tea.brew?.tempHighC }, unit));
  }, [open, steepTimes.length, tea.brew?.tempC, tea.brew?.tempLowC, tea.brew?.tempHighC, unit]);

  async function onFile(file: File | undefined, which: "liquor" | "wet") {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 720, 0.7);
      if (which === "liquor") setLiquor(dataUrl);
      else setWet(dataUrl);
    } catch {
      toast.error("Could not read that photo.");
    }
  }

  async function commit() {
    if (lockedOut) {
      toast.error("This cake is locked. Ask the owner to unlock it.");
      return;
    }
    setSaving(true);
    try {
      await logSteep({
        id: tea.id,
        note,
        rating,
        vessel: VESSEL_LABEL[vessel],
        leafGrams: Number(leafGrams) || null,
        waterMl: Number(waterMl) || null,
        waterTemp: Number.isFinite(waterTempC) ? Math.round(waterTempC) : null,
        infusionCount: Number(infusions) || steepTimes.length || null,
        liquorPhotoUrl: liquor,
        wetLeafPhotoUrl: wet,
        steepTimes,
        tasteTags: tags,
        steepedAt: when ? new Date(when).toISOString() : undefined,
      });
      setNote("");
      setRating(null);
      setTags([]);
      setLiquor("");
      setWet("");
      onOpenChange(false);
      onLogged?.();
      toast.success("Session saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Steep {tea.name}</DialogTitle>
          <DialogDescription>
            {lockedOut
              ? "Locked — the owner asked that this cake not be broken yet."
              : `A full session, attributed to you. Rest clock starts (${tea.restDays} days).`}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {tea.prompt ? (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-secondary px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs tracking-wide text-celadon">
                <Sparkles className="size-3" /> Tasting prompt
              </p>
              <pre className="font-sans text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {tea.prompt}
              </pre>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Vessel</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {VESSELS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVessel(v)}
                  className={cn(
                    "h-11 rounded-md text-xs",
                    vessel === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {VESSEL_LABEL[v]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leaf-g">Leaf grams</Label>
              <Input
                id="leaf-g"
                type="number"
                inputMode="decimal"
                value={leafGrams}
                onChange={(e) => setLeafGrams(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="water-ml">Water ml</Label>
              <Input
                id="water-ml"
                type="number"
                inputMode="numeric"
                value={waterMl}
                onChange={(e) => setWaterMl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="water-temp" className="flex items-center justify-between">
                Temp
                <button type="button" onClick={toggle} className="text-xs text-celadon tabular-nums">
                  °{unit}
                </button>
              </Label>
              <Input
                id="water-temp"
                inputMode="decimal"
                value={tempText}
                placeholder={unit === "F" ? "203" : "95"}
                onChange={(e) => setTempText(e.target.value)}
                onBlur={(e) => {
                  const parsed = parseTempField(e.target.value, unit);
                  if (!parsed) {
                    setTempText(displayTempField({ tempC: waterTempC }, unit));
                    return;
                  }
                  setWaterTempC(parsed.tempC);
                  setTempText(displayTempField(parsed, unit));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="infusions">Infusions</Label>
              <Input
                id="infusions"
                type="number"
                inputMode="numeric"
                value={infusions}
                onChange={(e) => setInfusions(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="steep-when">When</Label>
            <Input
              id="steep-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>

          {steepTimes.length > 0 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Timer: {steepTimes.map((t) => `${t}s`).join(" → ")}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>Taste tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {TASTE_TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags(on ? tags.filter((t) => t !== tag) : [...tags, tag])}
                    className={cn(
                      "h-9 rounded-full px-3 text-xs",
                      on ? "bg-celadon text-celadon-fg" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Session note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                tea.unknown
                  ? "What the prompt asked — liquor, wet leaf, what it might be"
                  : "Liquor, roast, weather, who you shared it with"
              }
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Rating</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`size-11 rounded-md text-sm tabular-nums ${
                    rating === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PhotoSlot
              label="Liquor"
              src={liquor}
              onPick={(f) => void onFile(f, "liquor")}
            />
            <PhotoSlot
              label="Wet leaf"
              src={wet}
              onPick={(f) => void onFile(f, "wet")}
            />
          </div>

          <Button className="w-full" size="lg" onClick={() => void commit()} disabled={saving || lockedOut}>
            {saving ? "Saving…" : "Log this steep"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhotoSlot({
  label,
  src,
  onPick,
}: {
  label: string;
  src: string;
  onPick: (file: File | undefined) => void;
}) {
  const id = `shot-${label.replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <button
        type="button"
        onClick={() => document.getElementById(id)?.click()}
        className="flex aspect-photo w-full items-center justify-center overflow-hidden rounded-lg bg-secondary text-xs text-muted-foreground"
      >
        {src ? <img src={src} alt="" className="size-full object-cover" /> : <Upload className="size-4" />}
      </button>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </div>
  );
}
