"use client";

/**
 * The Stage rail — CutPilot's signature workflow switcher (our answer to
 * DaVinci's page rail). Each stage is a purpose-built workspace; the rail sits
 * at the bottom, always visible, and reframes the whole app per craft.
 */

export type Stage = "ingest" | "script" | "cut" | "color" | "type" | "export";

const STAGES: { id: Stage; n: string; label: string }[] = [
  { id: "ingest", n: "01", label: "Ingest" },
  { id: "script", n: "02", label: "Script" },
  { id: "cut", n: "03", label: "Cut" },
  { id: "color", n: "04", label: "Color" },
  { id: "type", n: "05", label: "Type" },
  { id: "export", n: "06", label: "Export" },
];

export default function StageRail({
  stage,
  onChange,
  hasMedia,
}: {
  stage: Stage;
  onChange: (s: Stage) => void;
  hasMedia: boolean;
}) {
  return (
    // All six stages must stay reachable at phone width (6 × 104px overflowed a
    // 390px viewport and silently hid Ingest + Export): shrink the cells on
    // small screens and let the rail scroll rather than clip.
    <nav className="scroll-thin flex shrink-0 items-stretch justify-start overflow-x-auto border-t border-edge bg-surface sm:justify-center">
      {STAGES.map((s) => {
        const active = stage === s.id;
        const disabled = !hasMedia && s.id !== "ingest";
        return (
          <button
            key={s.id}
            disabled={disabled}
            onClick={() => onChange(s.id)}
            className={`group relative flex min-w-[60px] shrink-0 flex-col items-center justify-center gap-1 px-3 py-2.5 transition-colors sm:min-w-[104px] sm:px-5 ${
              active ? "text-ink" : "text-muted hover:text-ink"
            } disabled:pointer-events-none disabled:opacity-25`}
          >
            <span
              className={`absolute inset-x-3 top-0 h-[2px] transition-colors ${
                active ? "bg-accent" : "bg-transparent"
              }`}
            />
            <span className="font-mono text-[10px] tracking-label">{s.n}</span>
            <span className="font-display text-[12px] font-semibold leading-none sm:text-[13px]">
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
