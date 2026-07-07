"use client";

import { useState } from "react";
import type {
  CaptionStyle,
  AnimationKind,
  CaptionPosition,
  HighlightMode,
} from "@/engine";
import TemplatePicker from "./TemplatePicker";

interface Props {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
  onPreset: (id: string) => void;
}

const FONTS = [
  ["Montserrat, sans-serif", "Montserrat"],
  ["'Archivo Black', sans-serif", "Archivo Black"],
  ["Poppins, sans-serif", "Poppins"],
  ["Anton, sans-serif", "Anton"],
  ["'Bebas Neue', sans-serif", "Bebas Neue"],
  ["Oswald, sans-serif", "Oswald"],
  ["Outfit, sans-serif", "Outfit"],
  ["Inter, sans-serif", "Inter"],
  ["Nunito, sans-serif", "Nunito"],
  ["Manrope, sans-serif", "Manrope"],
  ["'Playfair Display', serif", "Playfair Display"],
  ["Lora, serif", "Lora"],
  ["Georgia, serif", "Georgia"],
  ["'JetBrains Mono', monospace", "JetBrains Mono"],
  ["'Space Mono', monospace", "Space Mono"],
  ["Bangers, cursive", "Bangers"],
  ["'Luckiest Guy', cursive", "Luckiest Guy"],
  ["Pacifico, cursive", "Pacifico"],
];
const ANIMATIONS: AnimationKind[] = [
  "pop",
  "scale",
  "zoom",
  "zoompunch",
  "bounce",
  "slide-up",
  "glide",
  "wave",
  "shake",
  "glitch",
  "whoosh",
  "blurdissolve",
  "karaoke",
  "reveal",
  "word-by-word",
  "typewriter",
  "fade",
  "none",
];
const POSITIONS: CaptionPosition[] = ["top", "center", "bottom"];

export default function StylePanel({ style, onChange, onPreset }: Props) {
  const [tab, setTab] = useState<"templates" | "customize">("templates");

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 p-2">
        <TabBtn active={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
        </TabBtn>
        <TabBtn active={tab === "customize"} onClick={() => setTab("customize")}>
          Customize
        </TabBtn>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3 pt-1">
        {tab === "templates" ? (
          <TemplatePicker current={style.preset} onPick={onPreset} />
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Animation">
                <select
                  value={style.animation}
                  onChange={(e) =>
                    onChange({ animation: e.target.value as AnimationKind })
                  }
                  className="select"
                >
                  {ANIMATIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
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
            </div>

            <Field label="Font">
              <select
                value={style.fontFamily}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
                className="select"
                style={{ fontFamily: style.fontFamily }}
              >
                {FONTS.map(([val, name]) => (
                  <option key={val} value={val} style={{ fontFamily: val }}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Range
                label={`Size ${(style.fontScale * 100).toFixed(1)}%`}
                min={0.03}
                max={0.13}
                step={0.001}
                value={style.fontScale}
                onChange={(v) => onChange({ fontScale: v })}
              />
              <Range
                label={`Words / line ${style.wordsPerCue}`}
                min={1}
                max={9}
                step={1}
                value={style.wordsPerCue}
                onChange={(v) => onChange({ wordsPerCue: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Range
                label={`Nudge X ${Math.round(style.offsetX * 100)}`}
                min={-0.45}
                max={0.45}
                step={0.01}
                value={style.offsetX}
                onChange={(v) => onChange({ offsetX: v })}
              />
              <Range
                label={`Nudge Y ${Math.round(style.offsetY * 100)}`}
                min={-0.45}
                max={0.45}
                step={0.01}
                value={style.offsetY}
                onChange={(v) => onChange({ offsetY: v })}
              />
            </div>

            <label className="flex items-center justify-between rounded-lg border border-edge bg-surface2 px-3 py-2">
              <span>UPPERCASE</span>
              <input
                type="checkbox"
                checked={style.uppercase}
                onChange={(e) => onChange({ uppercase: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>

            {/* emphasis */}
            <div>
              <span className="label">Active word</span>
              <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-edge bg-surface2 p-1">
                {(["color", "box", "bar"] as HighlightMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => onChange({ highlightMode: m })}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                      style.highlightMode === m
                        ? "bg-accent text-white"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {style.highlightMode === "box" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Color
                    label="Box"
                    value={style.activeBoxColor}
                    onChange={(v) => onChange({ activeBoxColor: v })}
                  />
                  <Color
                    label="Box text"
                    value={style.activeBoxTextColor}
                    onChange={(v) => onChange({ activeBoxTextColor: v })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Color
                    label="Active"
                    value={style.activeWordColor}
                    onChange={(v) => onChange({ activeWordColor: v })}
                  />
                  <Color
                    label="Keyword"
                    value={style.highlightColor}
                    onChange={(v) => onChange({ highlightColor: v })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Color
                label="Text"
                value={style.color}
                onChange={(v) => onChange({ color: v })}
              />
              <Color
                label="Outline"
                value={style.strokeColor || "#000000"}
                onChange={(v) => onChange({ strokeColor: v })}
              />
            </div>

            <Range
              label={`Outline ${(style.strokeWidth * 100).toFixed(0)}%`}
              min={0}
              max={0.25}
              step={0.01}
              value={style.strokeWidth}
              onChange={(v) => onChange({ strokeWidth: v })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Range
                label={`Glow ${(style.glow * 100).toFixed(0)}%`}
                min={0}
                max={1}
                step={0.05}
                value={style.glow}
                onChange={(v) => onChange({ glow: v })}
              />
              <Color
                label="Glow color"
                value={style.glowColor}
                onChange={(v) => onChange({ glowColor: v })}
              />
            </div>

            <label className="flex items-center justify-between rounded-lg border border-edge bg-surface2 px-3 py-2">
              <span>Background box</span>
              <input
                type="checkbox"
                checked={!!style.backgroundColor}
                onChange={(e) =>
                  onChange({
                    backgroundColor: e.target.checked ? "rgba(0,0,0,0.55)" : "",
                  })
                }
                className="h-4 w-4 accent-accent"
              />
            </label>

            <Range
              label={`Shadow ${(style.shadowBlur * 100).toFixed(0)}%`}
              min={0}
              max={0.4}
              step={0.01}
              value={style.shadowBlur}
              onChange={(v) => onChange({ shadowBlur: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
        active ? "bg-surface3 text-ink" : "text-muted hover:text-ink"
      }`}
    >
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
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
      />
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
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface2 p-1.5">
        <input
          type="color"
          value={hexOf(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="truncate font-mono text-[11px] text-muted">
          {hexOf(value)}
        </span>
      </div>
    </label>
  );
}

function hexOf(v: string): string {
  if (v.startsWith("#")) return v;
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return "#000000";
  const [r, g, b] = m[1].split(",").map((n) => parseInt(n.trim(), 10));
  const h = (n: number) =>
    Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
