"use client";

import { useState } from "react";
import type {
  CaptionStyle,
  AnimationKind,
  CaptionPosition,
  HighlightMode,
  EmphasisMode,
  TextTransform,
  TextAlign,
  ExitAnimation,
  StrokeLayer,
} from "@/engine";
import TemplatePicker from "./TemplatePicker";

interface Props {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
  onPreset: (id: string) => void;
}

const FONTS: [string, string][] = [
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
const WEIGHTS: [number, string][] = [
  [300, "Light"],
  [400, "Regular"],
  [500, "Medium"],
  [600, "Semibold"],
  [700, "Bold"],
  [800, "Extrabold"],
  [900, "Black"],
];
const ANIMATIONS: AnimationKind[] = [
  "pop", "scale", "zoom", "zoompunch", "bounce", "slide-up", "glide", "wave",
  "shake", "glitch", "whoosh", "blurdissolve", "karaoke", "reveal",
  "word-by-word", "typewriter", "fade", "none",
];
const EXITS: ExitAnimation[] = ["fade", "slide", "zoom", "blur", "none"];
const POSITIONS: CaptionPosition[] = ["top", "center", "bottom"];

export default function StylePanel({ style, onChange, onPreset }: Props) {
  const [tab, setTab] = useState<"templates" | "customize">("templates");
  const set = onChange;

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

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {tab === "templates" ? (
          <TemplatePicker current={style.preset} onPick={onPreset} />
        ) : (
          <div className="text-sm">
            {/* ---- Typography ---- */}
            <Section title="Typography" open>
              <Field label="Font">
                <select
                  value={style.fontFamily}
                  onChange={(e) => set({ fontFamily: e.target.value })}
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
              <Row>
                <Field label="Weight">
                  <select
                    value={style.fontWeight}
                    onChange={(e) => set({ fontWeight: Number(e.target.value) })}
                    className="select"
                  >
                    {WEIGHTS.map(([w, n]) => (
                      <option key={w} value={w}>{n}</option>
                    ))}
                  </select>
                </Field>
                <Range label={`Size ${(style.fontScale * 100).toFixed(1)}%`} min={0.03} max={0.16} step={0.001} value={style.fontScale} onChange={(v) => set({ fontScale: v })} />
              </Row>
              <Row>
                <Range label={`Letter-spacing ${(style.letterSpacing * 100).toFixed(0)}`} min={-0.05} max={0.3} step={0.005} value={style.letterSpacing} onChange={(v) => set({ letterSpacing: v })} />
                <Range label={`Line-height ${style.lineHeight.toFixed(2)}`} min={0.8} max={2.4} step={0.02} value={style.lineHeight} onChange={(v) => set({ lineHeight: v })} />
              </Row>
              <Row>
                <Range label={`Words / line ${style.wordsPerCue}`} min={1} max={9} step={1} value={style.wordsPerCue} onChange={(v) => set({ wordsPerCue: v })} />
                <div>
                  <span className="label">Lines</span>
                  <Segmented value={style.maxLines === 1 ? 1 : 0} options={[[0, "Wrap"], [1, "One line"]]} onChange={(v) => set({ maxLines: v })} />
                </div>
              </Row>
              <div>
                <span className="label">Case</span>
                <Segmented<TextTransform>
                  value={style.textTransform !== "none" ? style.textTransform : style.uppercase ? "upper" : "none"}
                  options={[["none", "Aa"], ["upper", "AA"], ["lower", "aa"], ["title", "Aa Bb"]]}
                  onChange={(v) => set({ textTransform: v, uppercase: v === "upper" })}
                />
              </div>
              <div>
                <span className="label">Align</span>
                <Segmented<TextAlign> value={style.textAlign} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} onChange={(v) => set({ textAlign: v })} />
              </div>
              <Row>
                <Toggle label="Italic" checked={style.italic} onChange={(v) => set({ italic: v })} />
                <Toggle label="Underline" checked={style.underline} onChange={(v) => set({ underline: v })} />
              </Row>
              <Toggle label="Strikethrough" checked={style.strikethrough} onChange={(v) => set({ strikethrough: v })} />
            </Section>

            {/* ---- Fill & color ---- */}
            <Section title="Fill & color" open>
              <Row>
                <Color label="Text" value={style.color} onChange={(v) => set({ color: v })} />
                <GradientColor label="Gradient" value={style.color2} onChange={(v) => set({ color2: v })} base={style.color} />
              </Row>
              {style.color2 && (
                <div>
                  <span className="label">Gradient direction</span>
                  <Segmented value={style.fillGradientDir} options={[["v", "Vertical"], ["h", "Horizontal"]]} onChange={(v) => set({ fillGradientDir: v })} />
                </div>
              )}
              <Range label={`Text opacity ${(style.textOpacity * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={style.textOpacity} onChange={(v) => set({ textOpacity: v })} />
              <Toggle label="Glossy sheen" checked={style.gloss} onChange={(v) => set({ gloss: v })} />
            </Section>

            {/* ---- Outline ---- */}
            <Section title="Outline / stroke">
              <Row>
                <Color label="Outline" value={style.strokeColor || "#000000"} onChange={(v) => set({ strokeColor: v })} />
                <Range label={`Width ${(style.strokeWidth * 100).toFixed(0)}%`} min={0} max={0.3} step={0.005} value={style.strokeWidth} onChange={(v) => set({ strokeWidth: v })} />
              </Row>
              <Range label={`Outline opacity ${(style.strokeOpacity * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={style.strokeOpacity} onChange={(v) => set({ strokeOpacity: v })} />
              <StrokeStack strokes={style.strokes} onChange={(s) => set({ strokes: s })} />
            </Section>

            {/* ---- Shadow & glow ---- */}
            <Section title="Shadow & glow">
              <Row>
                <Color label="Shadow" value={style.shadowColor} onChange={(v) => set({ shadowColor: v })} />
                <Range label={`Blur ${(style.shadowBlur * 100).toFixed(0)}%`} min={0} max={0.5} step={0.01} value={style.shadowBlur} onChange={(v) => set({ shadowBlur: v })} />
              </Row>
              <Row>
                <Range label={`Offset X ${(style.shadowOffsetX * 100).toFixed(0)}`} min={-0.2} max={0.2} step={0.005} value={style.shadowOffsetX} onChange={(v) => set({ shadowOffsetX: v })} />
                <Range label={`Offset Y ${(style.shadowOffsetY * 100).toFixed(0)}`} min={-0.2} max={0.2} step={0.005} value={style.shadowOffsetY} onChange={(v) => set({ shadowOffsetY: v })} />
              </Row>
              <Row>
                <Range label={`Long shadow ${(style.longShadow * 100).toFixed(0)}`} min={0} max={1} step={0.02} value={style.longShadow} onChange={(v) => set({ longShadow: v })} />
                <Range label={`Angle ${style.longShadowAngle}°`} min={0} max={360} step={5} value={style.longShadowAngle} onChange={(v) => set({ longShadowAngle: v })} />
              </Row>
              <Row>
                <Range label={`Glow ${(style.glow * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={style.glow} onChange={(v) => set({ glow: v })} />
                <Range label={`Glow radius ${(style.glowRadius * 100).toFixed(0)}`} min={0} max={1} step={0.02} value={style.glowRadius} onChange={(v) => set({ glowRadius: v })} />
              </Row>
              <Color label="Glow color" value={style.glowColor} onChange={(v) => set({ glowColor: v })} />
            </Section>

            {/* ---- Background box ---- */}
            <Section title="Background box">
              <Toggle label="Enable box" checked={!!style.backgroundColor} onChange={(e) => set({ backgroundColor: e ? "rgba(0,0,0,0.6)" : "" })} />
              {!!style.backgroundColor && (
                <>
                  <Row>
                    <Color label="Box color" value={style.backgroundColor} onChange={(v) => set({ backgroundColor: v })} />
                    <GradientColor label="Box gradient" value={style.boxColor2} onChange={(v) => set({ boxColor2: v, boxGradient: v ? "v" : "" })} base={style.backgroundColor} />
                  </Row>
                  <Row>
                    <Range label={`Opacity ${(style.boxOpacity * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={style.boxOpacity} onChange={(v) => set({ boxOpacity: v })} />
                    <Range label={`Radius ${(style.cornerRadius * 100).toFixed(0)}`} min={0} max={0.6} step={0.02} value={style.cornerRadius} onChange={(v) => set({ cornerRadius: v })} />
                  </Row>
                  <Row>
                    <Range label={`Pad X ${(style.boxPadX * 100).toFixed(0)}`} min={0} max={0.8} step={0.02} value={style.boxPadX || 0.42} onChange={(v) => set({ boxPadX: v })} />
                    <Range label={`Pad Y ${(style.boxPadY * 100).toFixed(0)}`} min={0} max={0.8} step={0.02} value={style.boxPadY || 0.24} onChange={(v) => set({ boxPadY: v })} />
                  </Row>
                  <Row>
                    <GradientColor label="Border" value={style.boxStroke} onChange={(v) => set({ boxStroke: v })} base="#ffffff" />
                    <Range label={`Border w ${(style.boxStrokeWidth * 100).toFixed(0)}`} min={0} max={0.2} step={0.005} value={style.boxStrokeWidth} onChange={(v) => set({ boxStrokeWidth: v })} />
                  </Row>
                  <Row>
                    <GradientColor label="Box glow" value={style.boxGlow} onChange={(v) => set({ boxGlow: v })} base="#3b6bf5" />
                    <GradientColor label="Box shadow" value={style.boxShadow} onChange={(v) => set({ boxShadow: v })} base="#000000" />
                  </Row>
                  <Row>
                    <GradientColor label="3D extrude" value={style.box3d} onChange={(v) => set({ box3d: v, box3dDepth: v ? style.box3dDepth || 0.12 : 0 })} base="#000000" />
                    <Range label={`Box gloss ${(style.boxGloss * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={style.boxGloss} onChange={(v) => set({ boxGloss: v })} />
                  </Row>
                </>
              )}
            </Section>

            {/* ---- Emphasis / active word ---- */}
            <Section title="Emphasis / active word" open>
              <div>
                <span className="label">Emphasise</span>
                <Segmented<EmphasisMode> value={style.emphasis} options={[["spoken", "Spoken word"], ["keyword", "Keyword"]]} onChange={(v) => set({ emphasis: v })} />
              </div>
              <div>
                <span className="label">Style</span>
                <Segmented<HighlightMode> value={style.highlightMode} options={[["color", "Color"], ["box", "Box"], ["bar", "Bar"]]} onChange={(v) => set({ highlightMode: v })} />
              </div>
              {style.highlightMode === "box" ? (
                <Row>
                  <Color label="Box" value={style.activeBoxColor} onChange={(v) => set({ activeBoxColor: v })} />
                  <Color label="Box text" value={style.activeBoxTextColor} onChange={(v) => set({ activeBoxTextColor: v })} />
                </Row>
              ) : (
                <Row>
                  <Color label="Active" value={style.activeWordColor} onChange={(v) => set({ activeWordColor: v })} />
                  <GradientColor label="Active grad" value={style.activeWordColor2} onChange={(v) => set({ activeWordColor2: v })} base={style.activeWordColor} />
                </Row>
              )}
              {style.emphasis === "keyword" && (
                <Color label="Keyword color" value={style.highlightColor} onChange={(v) => set({ highlightColor: v })} />
              )}
              <Row>
                <Range label={`Scale ${style.activeScale.toFixed(2)}×`} min={1} max={2} step={0.02} value={style.activeScale} onChange={(v) => set({ activeScale: v })} />
                <Range label={`Punch ${style.activePunch.toFixed(2)}`} min={0} max={0.8} step={0.02} value={style.activePunch} onChange={(v) => set({ activePunch: v })} />
              </Row>
              <Row>
                <Range label={`Bounce ${(style.activeBounce * 100).toFixed(0)}`} min={0} max={0.4} step={0.01} value={style.activeBounce} onChange={(v) => set({ activeBounce: v })} />
                <Range label={`Dim others ${(style.upcomingOpacity * 100).toFixed(0)}%`} min={0.2} max={1} step={0.05} value={style.upcomingOpacity} onChange={(v) => set({ upcomingOpacity: v })} />
              </Row>
              <Toggle label="Underline active word" checked={style.activeUnderline} onChange={(v) => set({ activeUnderline: v })} />
            </Section>

            {/* ---- Animation ---- */}
            <Section title="Animation">
              <Row>
                <Field label="In">
                  <select value={style.animation} onChange={(e) => set({ animation: e.target.value as AnimationKind })} className="select">
                    {ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Out">
                  <select value={style.exitAnimation} onChange={(e) => set({ exitAnimation: e.target.value as ExitAnimation })} className="select">
                    {EXITS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
              </Row>
              <Row>
                <Range label={`In ${style.animInMs}ms`} min={80} max={1500} step={20} value={style.animInMs} onChange={(v) => set({ animInMs: v })} />
                <Range label={`Out ${style.animOutMs}ms`} min={60} max={1200} step={20} value={style.animOutMs} onChange={(v) => set({ animOutMs: v })} />
              </Row>
              <Range label={`Word stagger ${style.wordStaggerMs}ms`} min={0} max={400} step={10} value={style.wordStaggerMs} onChange={(v) => set({ wordStaggerMs: v })} />
            </Section>

            {/* ---- Position & transform ---- */}
            <Section title="Position & transform">
              <div>
                <span className="label">Position</span>
                <Segmented<CaptionPosition> value={style.position} options={POSITIONS.map((p) => [p, p[0].toUpperCase() + p.slice(1)]) as [CaptionPosition, string][]} onChange={(v) => set({ position: v })} />
              </div>
              <Row>
                <Range label={`Margin ${(style.marginV * 100).toFixed(0)}%`} min={0} max={0.4} step={0.01} value={style.marginV} onChange={(v) => set({ marginV: v })} />
                <Range label={`Max width ${(style.maxWidth * 100).toFixed(0)}%`} min={0.4} max={1} step={0.02} value={style.maxWidth} onChange={(v) => set({ maxWidth: v })} />
              </Row>
              <Row>
                <Range label={`Nudge X ${Math.round(style.offsetX * 100)}`} min={-0.45} max={0.45} step={0.01} value={style.offsetX} onChange={(v) => set({ offsetX: v })} />
                <Range label={`Nudge Y ${Math.round(style.offsetY * 100)}`} min={-0.45} max={0.45} step={0.01} value={style.offsetY} onChange={(v) => set({ offsetY: v })} />
              </Row>
              <Row>
                <Range label={`Rotate ${style.rotation}°`} min={-45} max={45} step={1} value={style.rotation} onChange={(v) => set({ rotation: v })} />
                <Range label={`Opacity ${(style.captionOpacity * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={style.captionOpacity} onChange={(v) => set({ captionOpacity: v })} />
              </Row>
            </Section>

            {/* ---- Effects ---- */}
            <Section title="Effects">
              <Toggle label="Strip punctuation" checked={style.punctuationStrip} onChange={(v) => set({ punctuationStrip: v })} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- controls -- */

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${active ? "bg-surface3 text-ink" : "text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="border-b border-edge">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 font-mono text-[10px] uppercase tracking-label text-muted hover:text-ink">
        {title}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M2 3.5 5 6.5 8 3.5" />
        </svg>
      </summary>
      <div className="space-y-3 pb-4">{children}</div>
    </details>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full cursor-pointer" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-edge bg-surface2 px-3 py-2 text-[13px]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-accent" />
    </label>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-lg border border-edge bg-surface2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([val, lbl]) => (
        <button
          key={String(val)}
          onClick={() => onChange(val)}
          className={`rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors ${value === val ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface2 p-1.5">
        <input type="color" value={hexOf(value)} onChange={(e) => onChange(e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="truncate font-mono text-[11px] text-muted">{hexOf(value)}</span>
      </div>
    </label>
  );
}

/** A colour that can be toggled off (empty string) — for optional gradients/decoration. */
function GradientColor({ label, value, onChange, base }: { label: string; value: string; onChange: (v: string) => void; base: string }) {
  const on = !!value;
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] text-muted">
        {label}
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? hexOf(base) || "#ffffff" : "")} className="h-3.5 w-3.5 accent-accent" />
      </span>
      <div className={`flex items-center gap-2 rounded-lg border border-edge bg-surface2 p-1.5 ${on ? "" : "opacity-40"}`}>
        <input type="color" disabled={!on} value={hexOf(value || base)} onChange={(e) => onChange(e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="truncate font-mono text-[11px] text-muted">{on ? hexOf(value) : "off"}</span>
      </div>
    </label>
  );
}

function StrokeStack({ strokes, onChange }: { strokes: StrokeLayer[]; onChange: (s: StrokeLayer[]) => void }) {
  const list = strokes || [];
  const add = () => onChange([...list, { width: 0.08, color: "#000000", opacity: 1 }]);
  const upd = (i: number, p: Partial<StrokeLayer>) => onChange(list.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const del = (i: number) => onChange(list.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      <span className="label">Extra outlines (stacked)</span>
      {list.map((s, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-edge bg-surface2 p-1.5">
          <input type="color" value={hexOf(s.color)} onChange={(e) => upd(i, { color: e.target.value })} className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
          <input type="range" min={0.01} max={0.4} step={0.01} value={s.width} onChange={(e) => upd(i, { width: Number(e.target.value) })} className="w-full cursor-pointer" />
          <button onClick={() => del(i)} className="shrink-0 px-1 text-muted hover:text-ink" title="Remove">✕</button>
        </div>
      ))}
      {list.length < 4 && (
        <button onClick={add} className="w-full rounded-lg border border-dashed border-edge2 py-1.5 text-[11px] text-muted hover:border-accent hover:text-ink">
          + Add outline layer
        </button>
      )}
    </div>
  );
}

function hexOf(v: string): string {
  if (!v) return "#000000";
  if (v.startsWith("#")) return v;
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return "#000000";
  const [r, g, b] = m[1].split(",").map((n) => parseInt(n.trim(), 10));
  const h = (n: number) => Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
