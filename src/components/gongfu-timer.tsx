import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSeconds, infusionTarget, infusionTempC, parseBrewSchedule, TYPE_BREW } from "@/lib/teas/brew";
import { CHIME_IDS, CHIME_LABEL, playChime, readChime, writeChime, type ChimeId } from "@/lib/teas/chimes";
import { proverbFor } from "@/lib/teas/proverbs";
import { useTempUnit } from "@/lib/teas/temp";
import type { Tea } from "@/lib/teas/types";

export function GongfuTimer({
  tea,
  times,
  onTimes,
  onPersistSchedule,
}: {
  tea: Tea;
  times: number[];
  onTimes: (times: number[]) => void;
  onPersistSchedule?: (times: number[], brewTime: string) => void;
}) {
  const { unit, toggle, format } = useTempUnit();
  const infusion = times.length;
  const [planned, setPlanned] = useState<number[] | null>(null);
  const schedule = planned ?? (tea.lastSteepTimes.length > 0 ? tea.lastSteepTimes : null);
  const target = schedule?.[infusion] ?? infusionTarget(tea.brew, infusion, tea.type);
  const baseC = tea.brew?.tempC || 95;
  const steepC = infusionTempC(baseC, infusion, tea.type);
  const maxF = TYPE_BREW[tea.type]?.maxF ?? 212;
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(target);
  const [nudge, setNudge] = useState(0);
  const [chimeId, setChimeId] = useState<ChimeId>("gong");
  const endsAt = useRef<number | null>(null);
  const leftRef = useRef(left);
  leftRef.current = left;
  const persistTimer = useRef<number | null>(null);
  const saying = proverbFor(tea.id || tea.name, infusion);

  useEffect(() => {
    setChimeId(readChime());
  }, []);

  useEffect(() => {
    if (running) return;
    setLeft(target + nudge);
  }, [target, nudge, running, infusion]);

  useEffect(() => {
    if (!running) {
      endsAt.current = null;
      return;
    }
    endsAt.current = Date.now() + leftRef.current * 1000;
    const tick = () => {
      const end = endsAt.current;
      if (end == null) return;
      const next = Math.max(0, (end - Date.now()) / 1000);
      setLeft(next);
      if (next <= 0) {
        setRunning(false);
        playChime(chimeId);
      }
    };
    const id = window.setInterval(tick, 200);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [running, chimeId]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, []);

  function brewTimeFrom(nextTimes: number[]): string {
    const first = nextTimes[0] ?? Math.max(1, Math.round(target + nudge));
    const step =
      nextTimes.length >= 2
        ? Math.max(1, Math.round(nextTimes[1] - nextTimes[0]))
        : parseBrewSchedule(tea.brew?.time).step;
    return `${first}s, +${step}s`;
  }

  function persist(nextTimes: number[], immediate = false) {
    const brewTime = brewTimeFrom(nextTimes);
    if (!onPersistSchedule) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    if (immediate) {
      onPersistSchedule(nextTimes, brewTime);
      return;
    }
    persistTimer.current = window.setTimeout(() => {
      onPersistSchedule(nextTimes, brewTime);
    }, 500);
  }

  function start() {
    if (running) return;
    setRunning(true);
  }

  function stop() {
    const shouldSound = running && left > 0.05;
    setRunning(false);
    if (shouldSound) playChime(chimeId);
    setNudge(0);
    setLeft(target);
  }

  function bump(delta: number) {
    const plannedTime = Math.max(1, Math.round(target + nudge + delta));
    const next = [...(schedule ?? [])];
    while (next.length < infusion) {
      next.push(infusionTarget(tea.brew, next.length, tea.type));
    }
    next[infusion] = plannedTime;
    setPlanned(next);
    setNudge(0);
    if (running && endsAt.current) {
      endsAt.current += delta * 1000;
      setLeft((l) => Math.max(0, l + delta));
    }
    persist(next);
  }

  function markInfusion() {
    const plannedTime = target + nudge;
    const elapsed = plannedTime - left;
    const recorded = Math.max(1, Math.round(elapsed > 0.4 ? elapsed : plannedTime));
    const nextTimes = [...times, recorded];
    const nextPlanned = [...(schedule ?? [])];
    while (nextPlanned.length < infusion) {
      nextPlanned.push(infusionTarget(tea.brew, nextPlanned.length, tea.type));
    }
    nextPlanned[infusion] = recorded;
    onTimes(nextTimes);
    setPlanned(nextPlanned);
    setRunning(false);
    setNudge(0);
    persist(nextPlanned, true);
  }

  function reset() {
    setRunning(false);
    setNudge(0);
    onTimes([]);
  }

  return (
    <section className="space-y-4 rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center gap-2">
        <Timer className="size-4 text-celadon" />
        <h2 className="font-display text-2xl font-medium">Gongfu timer</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Infusion {infusion + 1}
        {schedule ? " · last session’s times" : ` · ${tea.brew?.time || "10s, +5s"}`}
        {tea.lastVessel ? ` · ${tea.lastVessel}` : ""}
      </p>
      <p className="text-xs leading-relaxed text-paper/90">{saying}</p>
      <p className="font-display text-5xl leading-none tabular-nums">{formatSeconds(left)}</p>
      <p className="text-[10px] tracking-wide text-muted-foreground">
        inf. {infusion + 1} · {target + nudge}s
        {" · "}
        <button type="button" onClick={toggle} className="tabular-nums hover:text-foreground">
          {format(steepC)}
        </button>
        {unit === "F" ? ` · max ${maxF}°F` : ` · max ${Math.round(((maxF - 32) * 5) / 9)}°C`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-12" onClick={start} disabled={running}>
          <Play className="size-4" />
          Start
        </Button>
        <Button type="button" variant="secondary" className="h-12" onClick={stop} disabled={!running && left === target}>
          <Square className="size-4" />
          Stop
        </Button>
        <Button type="button" variant="celadon" className="h-12 col-span-2" onClick={markInfusion}>
          Log steep {infusion + 1}
        </Button>
        <Button type="button" variant="secondary" onClick={() => bump(1)}>
          +1s
        </Button>
        <Button type="button" variant="secondary" onClick={() => bump(-1)}>
          −1s
        </Button>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] tracking-wide text-muted-foreground">Steep sound</span>
        <select
          value={chimeId}
          onChange={(e) => {
            const id = e.target.value as ChimeId;
            setChimeId(id);
            writeChime(id);
            playChime(id);
          }}
          className="h-11 w-full rounded-md bg-secondary px-3 text-sm text-foreground shadow-[var(--shadow-border)]"
        >
          {CHIME_IDS.map((id) => (
            <option key={id} value={id}>
              {CHIME_LABEL[id]}
            </option>
          ))}
        </select>
      </label>
      {times.length > 0 ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          Used: {times.map((t) => `${t}s`).join(" → ")}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <RotateCcw className="size-3" /> Reset this session
      </button>
    </section>
  );
}
