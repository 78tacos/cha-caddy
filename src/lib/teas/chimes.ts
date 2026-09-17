export const CHIME_IDS = ["gong", "bell", "qing", "muyu", "kettle", "pour"] as const;
export type ChimeId = (typeof CHIME_IDS)[number];

export const CHIME_LABEL: Record<ChimeId, string> = {
  gong: "Bronze gong",
  bell: "Temple bell",
  qing: "Qing chime",
  muyu: "Wooden fish",
  kettle: "Kettle",
  pour: "Pouring",
};

const KEY = "cha-caddy-chime";

const SAMPLE: Partial<Record<ChimeId, string>> = {
  gong: "/sounds/gong.mp3",
  bell: "/sounds/bell.ogg",
  qing: "/sounds/qing.mp3",
  pour: "/sounds/pour.mp3",
};

export function readChime(): ChimeId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (CHIME_IDS as readonly string[]).includes(v)) return v as ChimeId;
  } catch {
    /* ignore */
  }
  return "gong";
}

export function writeChime(id: ChimeId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

function env(ctx: AudioContext, start: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  return g;
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  peak: number,
  attack: number,
  decay: number,
  type: OscillatorType = "sine",
  slideTo?: number,
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + decay);
  const g = env(ctx, start, peak, attack, decay);
  osc.connect(g);
  g.connect(dest);
  osc.start(start);
  osc.stop(start + decay + 0.05);
}

function playPour(ctx: AudioContext, dest: AudioNode, t: number) {
  const seconds = 1.6;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.92 + white * 0.08;
    const envAmp = Math.min(1, i / (ctx.sampleRate * 0.06)) * Math.exp(-i / (ctx.sampleRate * 0.95));
    data[i] = last * envAmp;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, t);
  filter.frequency.exponentialRampToValueAtTime(480, t + 1.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.07);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + seconds);
}

function playSynth(id: ChimeId) {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    const t = ctx.currentTime + 0.02;
    if (id === "gong") {
      tone(ctx, master, 98, t, 0.45, 0.02, 1.8, "sine", 82);
      tone(ctx, master, 147, t, 0.22, 0.02, 1.4, "triangle", 130);
      tone(ctx, master, 220, t, 0.08, 0.01, 0.9, "sine");
    } else if (id === "bell") {
      tone(ctx, master, 392, t, 0.28, 0.01, 1.4, "sine");
      tone(ctx, master, 784, t, 0.12, 0.01, 1.1, "sine");
      tone(ctx, master, 1176, t, 0.06, 0.01, 0.7, "triangle");
    } else if (id === "qing") {
      tone(ctx, master, 1480, t, 0.22, 0.005, 0.7, "sine");
      tone(ctx, master, 2220, t, 0.08, 0.005, 0.45, "triangle");
    } else if (id === "muyu") {
      tone(ctx, master, 180, t, 0.35, 0.001, 0.12, "square");
      tone(ctx, master, 90, t, 0.2, 0.001, 0.18, "sine");
    } else if (id === "pour") {
      playPour(ctx, master, t);
    } else {
      tone(ctx, master, 1680, t, 0.12, 0.05, 0.9, "sine", 2400);
      tone(ctx, master, 2100, t + 0.12, 0.1, 0.05, 0.8, "sine", 2600);
    }
    window.setTimeout(() => void ctx.close(), 2400);
  } catch {
    /* ignore */
  }
}

export function playChime(id: ChimeId = readChime()) {
  const src = SAMPLE[id];
  if (src && typeof Audio !== "undefined") {
    try {
      const audio = new Audio(src);
      audio.volume = 0.85;
      void audio.play().catch(() => playSynth(id));
      return;
    } catch {
      /* fall through to synth */
    }
  }
  playSynth(id);
}
