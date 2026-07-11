"use client";

import { useMemo } from "react";
import type { Cue } from "@/engine";
import { computeAnalytics, type Analytics } from "@/lib/analytics";

interface Props {
  cues: Cue[];
  duration: number;
  peaks?: number[] | Float32Array | null;
}

type Tone = "good" | "warn" | "bad";
const toneClass: Record<Tone, string> = {
  good: "text-good",
  warn: "text-amber-400",
  bad: "text-red-400",
};

export default function AnalyticsPanel({ cues, duration, peaks }: Props) {
  const a = useMemo(
    () => computeAnalytics(cues, duration, peaks),
    [cues, duration, peaks]
  );

  if (!cues.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="text-2xl opacity-40">📊</div>
        <p className="text-sm text-muted">No transcript to analyse yet</p>
        <p className="text-xs text-muted/70">
          Transcribe or import captions to see pace, hook, readability and a
          clarity score.
        </p>
      </div>
    );
  }

  const clarityTone: Tone = a.clarity >= 75 ? "good" : a.clarity >= 55 ? "warn" : "bad";
  const paceTone: Tone =
    a.wpm >= 120 && a.wpm <= 165 ? "good" : a.wpm > 180 || a.wpm < 110 ? "bad" : "warn";
  const hookTone: Tone = a.hook >= 70 ? "good" : a.hook >= 50 ? "warn" : "bad";
  const deadTone: Tone = a.deadAirRatio < 0.1 ? "good" : a.deadAirRatio <= 0.2 ? "warn" : "bad";
  const fillerTone: Tone = a.fillerDensity < 2 ? "good" : a.fillerDensity <= 4 ? "warn" : "bad";
  const readTone: Tone = a.readabilityOver < 0.1 ? "good" : a.readabilityOver <= 0.25 ? "warn" : "bad";

  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-3">
      {/* clarity */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <span className="label mb-0">Clarity score</span>
          <span className="font-mono text-[10px] text-muted">explainable · on-device</span>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className={`font-mono text-4xl font-bold tabular-nums ${toneClass[clarityTone]}`}>
            {a.clarity}
          </span>
          <span className="mb-1 text-xs text-muted">/ 100</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface3">
          <div
            className={`h-full rounded-full ${a.clarity >= 75 ? "bg-good" : a.clarity >= 55 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${a.clarity}%` }}
          />
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Pace" value={`${Math.round(a.wpm)}`} unit="wpm" tone={paceTone}>
          <Spark points={a.paceSeries.map((p) => p.wpm)} lo={90} hi={200} />
        </Tile>
        <Tile label="Hook (0–3s)" value={`${Math.round(a.hook)}`} unit="/100" tone={hookTone} />
        <Tile label="Dead air" value={`${Math.round(a.deadAirRatio * 100)}`} unit="%" tone={deadTone}
          sub={a.longestGapSec > 0.5 ? `longest ${a.longestGapSec.toFixed(1)}s` : undefined} />
        <Tile label="Filler" value={a.fillerDensity.toFixed(1)} unit="/100w" tone={fillerTone}
          sub={`${a.fillerCount} total`} />
        <Tile label="Readability" value={`${Math.round(a.readabilityOver * 100)}`} unit="% over"
          tone={readTone} sub={`${Math.round(a.avgCps)} cps avg`} />
        <Tile label="Energy" value={`${Math.round(a.energyDynamics)}`} unit="/100" tone={a.energyDynamics >= 40 ? "good" : "warn"} />
      </div>

      {/* sentiment arc */}
      {a.sentimentSeries.length > 1 && (
        <div className="card p-3">
          <span className="label">Energy / sentiment arc</span>
          <Spark points={a.sentimentSeries} lo={-5} hi={5} height={34} centered />
        </div>
      )}

      {/* keywords */}
      {a.keywords.length > 0 && (
        <div className="card p-3">
          <span className="label">Top keywords</span>
          <div className="flex flex-wrap gap-1.5">
            {a.keywords.map((k) => (
              <span key={k.word} className="chip">
                {k.word} <span className="text-accent">{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="px-1 font-mono text-[10px] leading-relaxed text-muted">
        Every metric is a transparent formula over your transcript + audio —
        computed on your device, nothing uploaded. Not a black-box virality
        guess; a clarity &amp; deliverability read you can act on.
      </p>
    </div>
  );
}

function Tile({
  label, value, unit, tone, sub, children,
}: {
  label: string; value: string; unit: string; tone: Tone; sub?: string; children?: React.ReactNode;
}) {
  return (
    <div className="card p-3">
      <span className="label mb-1">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</span>
        <span className="text-[10px] text-muted">{unit}</span>
      </div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-muted">{sub}</div>}
      {children}
    </div>
  );
}

/** Minimal inline sparkline. */
function Spark({
  points, lo, hi, height = 24, centered = false,
}: {
  points: number[]; lo: number; hi: number; height?: number; centered?: boolean;
}) {
  if (!points.length) return null;
  const W = 100, H = height;
  const span = hi - lo || 1;
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const y = (v: number) => H - ((Math.max(lo, Math.min(hi, v)) - lo) / span) * H;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const mid = centered ? y(0) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 w-full" preserveAspectRatio="none" style={{ height }}>
      {mid !== null && <line x1="0" y1={mid} x2={W} y2={mid} stroke="currentColor" className="text-edge2" strokeWidth="0.5" />}
      <path d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
