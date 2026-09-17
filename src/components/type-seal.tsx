import { motifFor } from "@/lib/teas/motifs";
import { cn } from "@/lib/utils";

const TONE: Record<string, { ink: string; wash: string }> = {
  white: { ink: "#e8dfd0", wash: "#3a342c" },
  green: { ink: "#9caf9a", wash: "#1c241c" },
  yellow: { ink: "#c4a574", wash: "#2a2418" },
  oolong: { ink: "#c08457", wash: "#2a1c14" },
  black: { ink: "#b45c4e", wash: "#2a1614" },
  sheng: { ink: "#7d9a72", wash: "#182018" },
  heicha: { ink: "#8a6a4a", wash: "#1e1812" },
  shou: { ink: "#8a6a4a", wash: "#1e1812" },
  herbal: { ink: "#a08090", wash: "#22181e" },
  unknown: { ink: "#9a9286", wash: "#241f1a" },
};

function lattice(ink: string): string {
  return `repeating-linear-gradient(45deg, color-mix(in oklab, ${ink} 35%, transparent) 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, color-mix(in oklab, ${ink} 28%, transparent) 0 1px, transparent 1px 7px)`;
}

export function TypeSeal({ type, label, className }: { type: string; label: string; className?: string }) {
  const tone = TONE[type] ?? TONE.unknown;
  return (
    <span
      className={cn(
        "relative inline-flex max-w-full items-center overflow-hidden rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide",
        className,
      )}
      style={{ color: tone.ink, backgroundColor: tone.wash }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ backgroundImage: lattice(tone.ink) }}
      />
      <span className="relative truncate">{label}</span>
    </span>
  );
}

export function MotifWash({
  tea,
  className,
  tone = "card",
}: {
  tea: { type?: string; subtype?: string; name?: string; nameZh?: string; unknown?: boolean };
  className?: string;
  tone?: "card" | "page";
}) {
  const src = motifFor(tea);
  const veil = TONE[tea.unknown ? "unknown" : (tea.type ?? "")] ?? TONE.unknown;
  return (
    <span aria-hidden className={cn("motif-wash pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <img src={src} alt="" className="size-full object-cover outline-none" />
      <span
        className="absolute inset-0"
        style={{
          background:
            tone === "page"
              ? `linear-gradient(180deg, color-mix(in oklab, ${veil.wash} 28%, transparent) 0%, color-mix(in oklab, var(--color-background) 42%, transparent) 45%, color-mix(in oklab, var(--color-background) 62%, transparent) 100%)`
              : `linear-gradient(180deg, color-mix(in oklab, ${veil.wash} 18%, transparent) 0%, color-mix(in oklab, ${veil.wash} 32%, transparent) 100%)`,
        }}
      />
    </span>
  );
}
