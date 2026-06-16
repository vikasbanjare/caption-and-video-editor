"use client";

import type { CaptionStyle, AnimationKind, CaptionPosition } from "@/engine";
import { PRESETS } from "@/engine";

interface Props {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
  onPreset: (id: string) => void;
}

const FONTS = [
  "Inter, sans-serif",
  "'Arial Black', Arial, sans-serif",
  "Impact, sans-serif",
  "Georgia, serif",
  "'Courier New', monospace",
  "Verdana, sans-serif",
];

const ANIMATIONS: AnimationKind[] = [
  "word-by-word",
  "karaoke",
  "pop",
  "slide-up",
  "fade",
  "none",
];
const POSITIONS: CaptionPosition[] = ["top", "center", "bottom"];

/**
 * Style panel (WEBSAASPLAN.md §4.1) — preset picker plus the color / font /
 * animation controls ported from the desktop panel. Writes straight into the
 * shared CaptionStyle so the preview reflects every change instantly.
 */
export default function StylePanel({ style, onChange, onPreset }: Props) {
  return (
    <div className="scroll-thin h-full space-y-4 overflow-y-auto p-3 text-sm">
      <Field label="Preset">
        <select
          value={style.preset}
          onChange={(e) => onPreset(e.target.value)}
          className="select"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Animation">
        <select
          value={style.animation}
          onChange={(e) => onChange({ animation: e.target.value as AnimationKind })}
          className="select"
        >
          {ANIMATIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Position">
          <select
            value={style.position}
            onChange={(e) =>
              onChange({ position: e.target.value as CaptionPosition })
            }
            className="select"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Words / cue: ${style.wordsPerCue}`}>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={style.wordsPerCue}
            onChange={(e) => onChange({ wordsPerCue: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      </div>

      <Field label="Font">
        <select
          value={style.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="select"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f.split(",")[0].replace(/'/g, "")}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Size: ${(style.fontScale * 100).toFixed(1)}%`}>
          <input
            type="range"
            min={0.03}
            max={0.12}
            step={0.001}
            value={style.fontScale}
            onChange={(e) => onChange({ fontScale: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        <Field label={`Weight: ${style.fontWeight}`}>
          <input
            type="range"
            min={400}
            max={900}
            step={100}
            value={style.fontWeight}
            onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={style.uppercase}
          onChange={(e) => onChange({ uppercase: e.target.checked })}
        />
        <span>UPPERCASE</span>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <Color label="Text" value={style.color} onChange={(v) => onChange({ color: v })} />
        <Color
          label="Highlight"
          value={style.highlightColor}
          onChange={(v) => onChange({ highlightColor: v })}
        />
        <Color
          label="Active word"
          value={style.activeWordColor}
          onChange={(v) => onChange({ activeWordColor: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Color
          label="Outline"
          value={style.strokeColor || "#000000"}
          onChange={(v) => onChange({ strokeColor: v })}
        />
        <Field label={`Outline width: ${(style.strokeWidth * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0}
            max={0.25}
            step={0.01}
            value={style.strokeWidth}
            onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      </div>

      <div className="space-y-2 rounded-md border border-edge p-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!style.backgroundColor}
            onChange={(e) =>
              onChange({
                backgroundColor: e.target.checked ? "rgba(0,0,0,0.55)" : "",
              })
            }
          />
          <span>Background box</span>
        </label>
        {style.backgroundColor && (
          <Color
            label="Box color"
            value={hexFromRgba(style.backgroundColor)}
            onChange={(v) => onChange({ backgroundColor: v })}
          />
        )}
      </div>

      <Field label={`Shadow: ${(style.shadowBlur * 100).toFixed(0)}%`}>
        <input
          type="range"
          min={0}
          max={0.4}
          step={0.01}
          value={style.shadowBlur}
          onChange={(e) => onChange({ shadowBlur: Number(e.target.value) })}
          className="w-full"
        />
      </Field>
    </div>
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
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full cursor-pointer rounded border border-edge bg-panel2"
      />
    </label>
  );
}

// <input type=color> only understands #rrggbb; approximate an rgba() bg as hex.
function hexFromRgba(v: string): string {
  if (v.startsWith("#")) return v;
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return "#000000";
  const [r, g, b] = m[1].split(",").map((n) => parseInt(n.trim(), 10));
  const h = (n: number) => Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
