"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { Cue } from "@/engine";
import { MIN_CUE, fmtClock } from "@/lib/transcript";

/**
 * Editing timeline (CapCut-style): adaptive time ruler, audio waveform track,
 * draggable caption blocks (move + edge-trim with snapping), a playhead synced
 * to the video via a shared mutable timeRef (no React re-render per frame),
 * zoom (buttons / ctrl+wheel around the cursor), and playback autoscroll.
 *
 * The ruler and waveform are drawn on viewport-sized canvases and redrawn with
 * a scrollLeft offset ("virtualized"), so huge zoomed timelines never exceed
 * canvas size limits. Cue blocks are plain DOM inside the scrollable content.
 */

interface Props {
  cues: Cue[];
  duration: number;
  selectedId: string | null;
  timeRef: MutableRefObject<number>;
  playingRef: MutableRefObject<boolean>;
  peaks: Float32Array | null;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
  /** commit a move/trim (one undo entry) */
  onRetime: (id: string, start: number, end: number) => void;
  onSplitAt: (t: number) => void;
  onDeleteCue: (id: string) => void;
  onAddAt: (t: number) => void;
}

const RULER_H = 26;
const WAVE_TOP = 8;
const WAVE_H = 34;
const CUE_TOP = 50;
const CUE_H = 46;
const CONTENT_H = 104;
const PPS_MIN = 8;
const PPS_MAX = 240;

type Drag =
  | { kind: "scrub" }
  | {
      kind: "move" | "trim-l" | "trim-r";
      id: string;
      grabX: number;
      origStart: number;
      origEnd: number;
      moved: boolean;
    };

const clamp = (n: number, lo: number, hi: number) =>
  n < lo ? lo : n > hi ? hi : n;

export default function Timeline({
  cues,
  duration,
  selectedId,
  timeRef,
  playingRef,
  peaks,
  onSelect,
  onSeek,
  onRetime,
  onSplitAt,
  onDeleteCue,
  onAddAt,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLCanvasElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);

  const [viewportW, setViewportW] = useState(0);
  const [pps, setPps] = useState<number | null>(null);
  const [dragTemp, setDragTemp] = useState<{
    id: string;
    start: number;
    end: number;
  } | null>(null);

  const dragRef = useRef<Drag | null>(null);
  // mirror of dragTemp — lets endCueDrag commit without side effects inside a
  // state updater (React StrictMode may double-invoke updaters)
  const dragTempRef = useRef<{ id: string; start: number; end: number } | null>(
    null
  );
  const ppsRef = useRef<number>(0);
  ppsRef.current = pps ?? 0;
  const userZoomed = useRef(false);
  // zoom anchor: keep the time under the cursor fixed while pps changes
  const zoomAnchor = useRef<{ t: number; x: number } | null>(null);

  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const peaksRef = useRef(peaks);
  peaksRef.current = peaks;

  const lastCueEnd = cues.length ? cues[cues.length - 1].end : 0;
  const totalT = Math.max(duration, lastCueEnd, 0.001);
  const contentW = pps ? Math.ceil(totalT * pps) + 2 : 0;

  // The component renders null until duration is known — refs only attach once
  // `active` flips true, so every ref-touching effect must re-run on it.
  const active = duration > 0;

  // ---- measure viewport ------------------------------------------------------
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  // ---- fit zoom on load / duration change (until the user zooms manually) ----
  useEffect(() => {
    if (!viewportW || userZoomed.current) return;
    setPps(clamp((viewportW - 16) / totalT, PPS_MIN, PPS_MAX));
  }, [viewportW, totalT]);

  // ---- canvas drawing (ruler + waveform), virtualized by scrollLeft ----------
  const redraw = useCallback(() => {
    const sc = scrollRef.current;
    const p = ppsRef.current;
    if (!sc || !p) return;
    const left = sc.scrollLeft;
    const w = sc.clientWidth;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const ruler = rulerRef.current;
    if (ruler) {
      if (ruler.width !== Math.round(w * dpr)) {
        ruler.width = Math.round(w * dpr);
        ruler.height = Math.round(RULER_H * dpr);
      }
      const ctx = ruler.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, RULER_H);
        const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
        const major = steps.find((s) => s * p >= 64) ?? 600;
        const minor = major / 5;
        ctx.fillStyle = "#5b6270";
        ctx.font = "9px ui-monospace, monospace";
        ctx.textBaseline = "top";
        // index-based ticks — no float accumulation, so labels stay exact
        const k0 = Math.floor(left / p / minor);
        const k1 = Math.ceil((left + w) / p / minor);
        for (let k = k0; k <= k1; k++) {
          const t = k * minor;
          if (t < 0) continue;
          const x = Math.round(t * p - left) + 0.5;
          const isMajor = k % 5 === 0;
          ctx.strokeStyle = isMajor ? "#454c5c" : "#2b303c";
          ctx.beginPath();
          ctx.moveTo(x, RULER_H);
          ctx.lineTo(x, RULER_H - (isMajor ? 10 : 5));
          ctx.stroke();
          if (isMajor) ctx.fillText(fmtClock(t), x + 3, 4);
        }
      }
    }

    const wave = waveRef.current;
    if (wave) {
      if (wave.width !== Math.round(w * dpr)) {
        wave.width = Math.round(w * dpr);
        wave.height = Math.round(WAVE_H * dpr);
      }
      const ctx = wave.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, WAVE_H);
        const pk = peaksRef.current;
        const total = Math.max(durationRef.current, 0.001);
        const mid = WAVE_H / 2;
        if (pk && pk.length) {
          ctx.fillStyle = "rgba(124,92,255,0.75)";
          for (let x = 0; x < w; x += 2) {
            const t = (left + x) / p;
            if (t > total) break;
            const i = clamp(Math.floor((t / total) * pk.length), 0, pk.length - 1);
            const h = Math.max(1.5, pk[i] * (WAVE_H - 4));
            ctx.fillRect(x, mid - h / 2, 1.4, h);
          }
        } else {
          ctx.fillStyle = "rgba(124,92,255,0.35)";
          ctx.fillRect(0, mid - 1, Math.min(w, total * p - left), 2);
        }
      }
    }
  }, []);

  useEffect(() => {
    redraw();
  }, [redraw, pps, viewportW, peaks, duration]);

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(redraw);
    };
    sc.addEventListener("scroll", onScroll);
    return () => {
      sc.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [redraw, active]);

  // ---- zoom ------------------------------------------------------------------
  const zoomTo = useCallback((nextPps: number, anchorT?: number, anchorX?: number) => {
    userZoomed.current = true;
    const p = clamp(nextPps, PPS_MIN, PPS_MAX);
    // fully clamped → pps won't change → the anchor effect would never fire,
    // so don't store an anchor that would hijack a later zoom
    if (p === ppsRef.current) return;
    if (anchorT !== undefined && anchorX !== undefined) {
      zoomAnchor.current = { t: anchorT, x: anchorX };
    } else {
      const sc = scrollRef.current;
      if (sc && ppsRef.current) {
        const cx = sc.clientWidth / 2;
        zoomAnchor.current = {
          t: (sc.scrollLeft + cx) / ppsRef.current,
          x: cx,
        };
      }
    }
    setPps(p);
  }, []);

  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const anchor = zoomAnchor.current;
    if (sc && anchor && pps) {
      sc.scrollLeft = Math.max(0, anchor.t * pps - anchor.x);
      zoomAnchor.current = null;
    }
    redraw();
  }, [pps, redraw]);

  const fitZoom = useCallback(() => {
    userZoomed.current = false;
    zoomAnchor.current = null; // Fit owns the scroll position
    if (viewportW) setPps(clamp((viewportW - 16) / totalT, PPS_MIN, PPS_MAX));
    const sc = scrollRef.current;
    if (sc) sc.scrollLeft = 0;
  }, [viewportW, totalT]);

  // ctrl+wheel zoom / wheel horizontal scroll (needs passive:false)
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      const p = ppsRef.current;
      if (!p) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = sc.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const t = (sc.scrollLeft + x) / p;
        zoomTo(p * (e.deltaY < 0 ? 1.25 : 0.8), t, x);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        sc.scrollLeft += e.deltaY;
      }
    };
    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => sc.removeEventListener("wheel", onWheel);
  }, [zoomTo, active]);

  // ---- playhead + autoscroll + time label (rAF, no re-render) ----------------
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = ppsRef.current;
      const t = timeRef.current;
      const ph = playheadRef.current;
      const sc = scrollRef.current;
      if (ph && p) ph.style.left = `${t * p}px`;
      if (timeLabelRef.current) {
        timeLabelRef.current.textContent = `${fmtClock(t)} / ${fmtClock(
          durationRef.current
        )}`;
      }
      if (sc && p && playingRef.current && !dragRef.current) {
        const x = t * p;
        if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 32) {
          sc.scrollLeft = Math.max(0, x - sc.clientWidth * 0.25);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [timeRef, playingRef]);

  // ---- pointer helpers --------------------------------------------------------
  const timeAtClientX = useCallback((clientX: number) => {
    const sc = scrollRef.current;
    const p = ppsRef.current;
    if (!sc || !p) return 0;
    const rect = sc.getBoundingClientRect();
    return clamp(
      (clientX - rect.left + sc.scrollLeft) / p,
      0,
      Math.max(durationRef.current, 0.001)
    );
  }, []);

  /** snap `t` to the playhead or neighbouring cue edges (±6px). */
  const snap = useCallback((t: number, excludeId: string) => {
    const p = ppsRef.current;
    if (!p) return t;
    const thr = 6 / p;
    const cands: number[] = [timeRef.current];
    const list = cuesRef.current;
    const i = list.findIndex((c) => c.id === excludeId);
    if (i > 0) cands.push(list[i - 1].end);
    if (i >= 0 && i < list.length - 1) cands.push(list[i + 1].start);
    for (const c of cands) if (Math.abs(t - c) < thr) return c;
    return t;
  }, [timeRef]);

  // ---- scrub (ruler or empty track area) --------------------------------------
  const startScrub = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-cue]")) return; // cue blocks handle themselves
      dragRef.current = { kind: "scrub" };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onSeek(timeAtClientX(e.clientX));
      onSelect(null);
    },
    [onSeek, onSelect, timeAtClientX]
  );
  const moveScrub = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current?.kind !== "scrub") return;
      onSeek(timeAtClientX(e.clientX));
    },
    [onSeek, timeAtClientX]
  );
  const endScrub = useCallback(() => {
    if (dragRef.current?.kind === "scrub") dragRef.current = null;
  }, []);

  // ---- cue drag (move / trim) --------------------------------------------------
  const startCueDrag = useCallback(
    (e: React.PointerEvent, c: Cue, kind: "move" | "trim-l" | "trim-r") => {
      if (e.button !== 0) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        kind,
        id: c.id,
        grabX: e.clientX,
        origStart: c.start,
        origEnd: c.end,
        moved: false,
      };
      const temp = { id: c.id, start: c.start, end: c.end };
      dragTempRef.current = temp;
      setDragTemp(temp);
    },
    []
  );

  const moveCueDrag = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      const p = ppsRef.current;
      if (!d || d.kind === "scrub" || !p) return;
      if (Math.abs(e.clientX - d.grabX) > 3) d.moved = true;
      const dt = (e.clientX - d.grabX) / p;

      const list = cuesRef.current;
      const i = list.findIndex((c) => c.id === d.id);
      if (i < 0) return;
      const prevEnd = i > 0 ? list[i - 1].end : 0;
      const nextStart =
        i < list.length - 1 ? list[i + 1].start : Number.POSITIVE_INFINITY;

      let start = d.origStart;
      let end = d.origEnd;
      if (d.kind === "trim-l") {
        start = snap(
          clamp(d.origStart + dt, prevEnd, d.origEnd - MIN_CUE),
          d.id
        );
        start = clamp(start, prevEnd, d.origEnd - MIN_CUE);
      } else if (d.kind === "trim-r") {
        const maxEnd = Number.isFinite(nextStart)
          ? nextStart
          : Math.max(durationRef.current, d.origEnd);
        end = snap(clamp(d.origEnd + dt, d.origStart + MIN_CUE, maxEnd), d.id);
        end = clamp(end, d.origStart + MIN_CUE, maxEnd);
      } else {
        const span = d.origEnd - d.origStart;
        // the last cue may not be moved past the end of the video
        const rightWall = Number.isFinite(nextStart)
          ? nextStart
          : Math.max(durationRef.current, d.origEnd);
        const maxStart = rightWall - span;
        let s = clamp(d.origStart + dt, prevEnd, Math.max(prevEnd, maxStart));
        // try snapping either edge, keep the smaller correction
        const sSnap = snap(s, d.id);
        const eSnap = snap(s + span, d.id) - span;
        const cand =
          Math.abs(sSnap - s) <= Math.abs(eSnap - s) ? sSnap : eSnap;
        if (Math.abs(cand - s) < 12 / p) s = cand;
        s = clamp(s, prevEnd, Math.max(prevEnd, maxStart));
        start = s;
        end = s + span;
      }
      const temp = { id: d.id, start, end };
      dragTempRef.current = temp;
      setDragTemp(temp);
    },
    [snap]
  );

  const endCueDrag = useCallback(() => {
    const d = dragRef.current;
    if (!d || d.kind === "scrub") return;
    dragRef.current = null;
    const temp = dragTempRef.current;
    dragTempRef.current = null;
    setDragTemp(null);
    if (!temp) return;
    if (d.moved) {
      if (
        Math.abs(temp.start - d.origStart) > 1e-4 ||
        Math.abs(temp.end - d.origEnd) > 1e-4
      ) {
        onRetime(d.id, temp.start, temp.end);
      }
    } else {
      onSelect(d.id);
      onSeek(d.origStart + 1e-3);
    }
  }, [onRetime, onSelect, onSeek]);

  if (duration <= 0) return null;

  return (
    <div className="select-none">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-edge px-3 py-1.5">
        <TlBtn label="Add caption at playhead" onClick={() => onAddAt(timeRef.current)}>
          <PlusIcon /> <span className="hidden sm:inline">Caption</span>
        </TlBtn>
        <TlBtn label="Split at playhead (S)" onClick={() => onSplitAt(timeRef.current)}>
          <SplitIcon /> <span className="hidden sm:inline">Split</span>
        </TlBtn>
        <TlBtn
          label="Delete selected (Del)"
          onClick={() => selectedId && onDeleteCue(selectedId)}
          disabled={!selectedId}
        >
          <TrashIcon /> <span className="hidden sm:inline">Delete</span>
        </TlBtn>

        <span
          ref={timeLabelRef}
          className="ml-2 font-mono text-[11px] tabular-nums text-muted"
        />

        <span className="ml-auto hidden text-[10px] text-muted/70 md:inline">
          drag = move · edges = trim · space = play · S = split · , . = frame step
        </span>
        <div className="ml-2 flex items-center gap-1">
          <TlBtn label="Zoom out" onClick={() => zoomTo((ppsRef.current || 40) * 0.7)}>
            −
          </TlBtn>
          <TlBtn label="Fit" onClick={fitZoom}>
            Fit
          </TlBtn>
          <TlBtn label="Zoom in" onClick={() => zoomTo((ppsRef.current || 40) * 1.45)}>
            +
          </TlBtn>
        </div>
      </div>

      {/* ruler (viewport-fixed canvas; scrub target) */}
      <div
        className="relative cursor-col-resize"
        style={{ height: RULER_H }}
        onPointerDown={startScrub}
        onPointerMove={moveScrub}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
      >
        <canvas ref={rulerRef} className="absolute inset-0 h-full w-full" />
      </div>

      {/* tracks */}
      <div className="relative">
        {/* track labels overlay (don't scroll) */}
        <div className="pointer-events-none absolute left-2 z-20 text-[9px] font-semibold uppercase tracking-wider text-muted/80">
          <div style={{ marginTop: WAVE_TOP + 2 }}>Audio</div>
          <div style={{ marginTop: CUE_TOP - WAVE_TOP - 12 }}>Captions</div>
        </div>
        {/* waveform overlay (viewport-fixed canvas over the audio row) */}
        <canvas
          ref={waveRef}
          className="pointer-events-none absolute z-0 w-full"
          style={{ top: WAVE_TOP, height: WAVE_H }}
        />

        <div
          ref={scrollRef}
          className="scroll-thin relative overflow-x-auto overflow-y-hidden"
          style={{ height: CONTENT_H }}
          onPointerDown={startScrub}
          onPointerMove={moveScrub}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
        >
          <div className="relative" style={{ width: contentW, height: CONTENT_H }}>
            {/* row backgrounds */}
            <div
              className="absolute w-full rounded-md border border-edge/60 bg-surface2/40"
              style={{ top: WAVE_TOP, height: WAVE_H }}
            />
            <div
              className="absolute w-full rounded-md border border-edge/60 bg-surface2/40"
              style={{ top: CUE_TOP, height: CUE_H }}
            />

            {/* cue blocks */}
            {pps &&
              cues.map((c) => {
                const isDragging = dragTemp?.id === c.id;
                const start = isDragging ? dragTemp.start : c.start;
                const end = isDragging ? dragTemp.end : c.end;
                const selected = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    data-cue
                    data-testid="cue-block"
                    className={`group absolute cursor-grab overflow-hidden rounded-lg border text-left transition-shadow active:cursor-grabbing ${
                      selected
                        ? "z-10 border-accent bg-accent/30 ring-1 ring-accent/60"
                        : "border-accent/40 bg-accent/15 hover:border-accent/70"
                    }`}
                    style={{
                      left: start * pps,
                      width: Math.max(6, (end - start) * pps),
                      top: CUE_TOP + 2,
                      height: CUE_H - 4,
                    }}
                    onPointerDown={(e) => startCueDrag(e, c, "move")}
                    onPointerMove={moveCueDrag}
                    onPointerUp={endCueDrag}
                    onPointerCancel={endCueDrag}
                    title={`${c.text}\n${fmtClock(start)} → ${fmtClock(end)}`}
                  >
                    <div className="pointer-events-none truncate px-2 pt-1 text-[10px] font-medium leading-tight text-slate-100">
                      {c.text}
                    </div>
                    <div className="pointer-events-none truncate px-2 font-mono text-[8px] text-slate-300/70">
                      {fmtClock(start)}–{fmtClock(end)}
                    </div>
                    {/* trim handles */}
                    <div
                      data-cue
                      className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-lg bg-accent/0 group-hover:bg-accent/60"
                      onPointerDown={(e) => startCueDrag(e, c, "trim-l")}
                      onPointerMove={moveCueDrag}
                      onPointerUp={endCueDrag}
                      onPointerCancel={endCueDrag}
                    />
                    <div
                      data-cue
                      className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-lg bg-accent/0 group-hover:bg-accent/60"
                      onPointerDown={(e) => startCueDrag(e, c, "trim-r")}
                      onPointerMove={moveCueDrag}
                      onPointerUp={endCueDrag}
                      onPointerCancel={endCueDrag}
                    />
                  </div>
                );
              })}

            {/* playhead */}
            <div
              ref={playheadRef}
              className="pointer-events-none absolute top-0 z-20 h-full"
              style={{ left: 0 }}
            >
              <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-rose-400" />
              <div className="absolute -left-px h-full w-0.5 bg-rose-400/90" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TlBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border border-edge bg-surface2 px-2 text-[11px] font-medium text-slate-200 transition-colors hover:border-edge2 hover:text-white disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  );
}
function SplitIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M6 1v10" strokeDasharray="1.5 1.5" />
      <rect x="0.7" y="3" width="3.6" height="6" rx="1" />
      <rect x="7.7" y="3" width="3.6" height="6" rx="1" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M1.5 3h9M4.5 3V1.8h3V3M2.7 3l.6 7h5.4l.6-7M4.8 5v3.5M7.2 5v3.5" />
    </svg>
  );
}
