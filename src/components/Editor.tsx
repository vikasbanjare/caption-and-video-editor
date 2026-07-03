"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Cue, CaptionStyle } from "@/engine";
import {
  parseSRT,
  serializeSRT,
  regroupCues,
  applyKeywordHighlight,
  romanizeTranscript,
  cuesFromWords,
  activeCueAt,
  styleFromPreset,
  DEFAULT_PRESET,
  transcriptDuration,
} from "@/engine";
import {
  updateCueText,
  retimeCue,
  splitCue,
  splitCueAtTime,
  mergeWithNext,
  deleteCue,
  insertCueAt,
} from "@/lib/transcript";
import {
  transcribeInBrowser,
  decodeAudioFile,
  type TranscribeProgress,
} from "@/lib/transcribe-browser";
import { computePeaks } from "@/lib/waveform";
import { buildStubSrt } from "@/server/transcription/stub";
import Toolbar from "./Toolbar";
import VideoStage from "./VideoStage";
import TranscriptPanel from "./TranscriptPanel";
import StylePanel from "./StylePanel";
import Timeline from "./Timeline";

/**
 * The editing studio: upload → real in-browser transcription (Whisper) →
 * editable transcript + full timeline (trim/move/split/insert, undo/redo,
 * keyboard shortcuts) → live styled preview. The same render engine drives
 * the preview and (later) the server burn-in export.
 */
export default function Editor() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [cues, setCuesRaw] = useState<Cue[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(() =>
    styleFromPreset(DEFAULT_PRESET.id)
  );
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Upload a video to begin.");
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTo, setSeekTo] = useState<{ t: number } | null>(null);
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  // shared mutable playback state (updated per animation frame, no re-render)
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  // identity of the currently loaded file — guards async results from stale uploads
  const videoFileRef = useRef<File | null>(null);
  const styleRef = useRef(style);
  styleRef.current = style;

  // ---- undo/redo history (refs + tick keep this StrictMode-safe) ------------
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const pastRef = useRef<Cue[][]>([]);
  const futureRef = useRef<Cue[][]>([]);
  const lastActionRef = useRef("");
  const [historyTick, setHistoryTick] = useState(0);

  /**
   * Commit a cue mutation as one undo step. Consecutive commits with the same
   * non-empty `coalesce` tag (e.g. typing in one cue) collapse into one step.
   */
  const commit = useCallback(
    (next: Cue[] | ((prev: Cue[]) => Cue[]), coalesce = "") => {
      const prev = cuesRef.current;
      const value = typeof next === "function" ? next(prev) : next;
      if (value === prev) return;
      if (!coalesce || lastActionRef.current !== coalesce) {
        pastRef.current = [...pastRef.current.slice(-79), prev];
        futureRef.current = [];
        setHistoryTick((t) => t + 1);
      }
      lastActionRef.current = coalesce;
      setCuesRaw(value);
    },
    []
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (!past.length) return;
    futureRef.current = [cuesRef.current, ...futureRef.current];
    pastRef.current = past.slice(0, -1);
    lastActionRef.current = "";
    setHistoryTick((t) => t + 1);
    setCuesRaw(past[past.length - 1]);
  }, []);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (!future.length) return;
    pastRef.current = [...pastRef.current, cuesRef.current];
    futureRef.current = future.slice(1);
    lastActionRef.current = "";
    setHistoryTick((t) => t + 1);
    setCuesRaw(future[0]);
  }, []);

  void historyTick; // re-render trigger for canUndo/canRedo
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // ---- lifecycle --------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // decode audio for the timeline waveform whenever a new file is loaded
  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    if (!videoFile) return;
    decodeAudioFile(videoFile)
      .then((samples) => {
        if (!cancelled) setPeaks(computePeaks(samples, 4000));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [videoFile]);

  const activeId = useMemo(
    () => activeCueAt(cues, currentTime)?.id ?? null,
    [cues, currentTime]
  );

  const finalize = useCallback(
    (raw: Cue[], s: CaptionStyle): Cue[] => {
      let out = regroupCues(raw, s.wordsPerCue);
      if (language.toLowerCase().startsWith("hi")) {
        out = romanizeTranscript({ cues: out, language }).cues;
      }
      return applyKeywordHighlight(out);
    },
    [language]
  );

  // ---- top-level actions --------------------------------------------------------
  const handleUpload = useCallback((file: File) => {
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setVideoFile(file);
    videoFileRef.current = file;
    setSelectedId(null);
    // new media = new project: clear captions AND history so undo can't
    // resurrect the previous video's cues
    pastRef.current = [];
    futureRef.current = [];
    lastActionRef.current = "";
    setHistoryTick((t) => t + 1);
    setCuesRaw([]);
    setStatus(`Loaded ${file.name}. Hit Auto-transcribe.`);
  }, []);

  const handleTranscribe = useCallback(async () => {
    const file = videoFile;
    if (!file) return;
    setBusy(true);
    setProgress({ phase: "decoding", label: "Reading audio…" });
    try {
      const words = await transcribeInBrowser(file, language, setProgress);
      // a different video may have been loaded while Whisper was running —
      // never commit a stale transcript onto the new clip
      if (videoFileRef.current !== file) {
        setStatus("Discarded a finished transcription for a previously loaded video.");
        return;
      }
      if (words.length === 0) throw new Error("No speech detected in this clip.");
      commit(finalize(cuesFromWords(words), style));
      setStatus(`Transcribed ${words.length} words — all in your browser.`);
    } catch (err) {
      setStatus(`Transcription failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [videoFile, language, style, finalize, commit]);

  const handleLoadSample = useCallback(() => {
    commit(finalize(parseSRT(buildStubSrt(duration || 24, language)), style));
    setStatus("Loaded sample captions (placeholder text, not from your video).");
  }, [duration, language, style, finalize, commit]);

  const handleImportSrt = useCallback(
    (text: string) => {
      const parsed = parseSRT(text);
      if (parsed.length === 0) {
        setStatus("Could not parse that SRT — is it valid?");
        return;
      }
      commit(finalize(parsed, style));
      setStatus(`Imported ${parsed.length} cues.`);
    },
    [style, finalize, commit]
  );

  const handleExportSrt = useCallback(() => {
    const blob = new Blob([serializeSRT(cuesRef.current)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "captions.srt";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ---- style ----------------------------------------------------------------
  // NOTE: state updaters must stay pure (StrictMode double-invokes them), so
  // the regroup commit happens OUTSIDE setStyle, using styleRef for "prev".
  const handleStyleChange = useCallback(
    (patch: Partial<CaptionStyle>) => {
      const prev = styleRef.current;
      const next = { ...prev, ...patch };
      setStyle(next);
      if (
        patch.wordsPerCue !== undefined &&
        patch.wordsPerCue !== prev.wordsPerCue
      ) {
        commit((cs) => applyKeywordHighlight(regroupCues(cs, next.wordsPerCue)));
        setSelectedId(null);
      }
    },
    [commit]
  );

  const handlePreset = useCallback(
    (id: string) => {
      const prev = styleRef.current;
      const next = styleFromPreset(id);
      setStyle(next);
      // only regroup when the word count actually changes — a pure style swap
      // must not discard manual splits/merges/trims on the timeline
      if (cuesRef.current.length && next.wordsPerCue !== prev.wordsPerCue) {
        commit((cs) => applyKeywordHighlight(regroupCues(cs, next.wordsPerCue)));
        setSelectedId(null);
      }
    },
    [commit]
  );

  // ---- playback / seeking -----------------------------------------------------
  const onSeek = useCallback((t: number) => {
    timeRef.current = t; // keep playhead honest even before the video seeks
    setSeekTo({ t });
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoElRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  // ---- cue editing --------------------------------------------------------------
  const onEditText = useCallback(
    (id: string, text: string) =>
      commit((cs) => updateCueText(cs, id, text), `text:${id}`),
    [commit]
  );
  const onSplit = useCallback(
    (id: string) => commit((cs) => splitCue(cs, id)),
    [commit]
  );
  const onMerge = useCallback(
    (id: string) => commit((cs) => mergeWithNext(cs, id)),
    [commit]
  );
  const onDelete = useCallback(
    (id: string) => {
      commit((cs) => deleteCue(cs, id));
      setSelectedId((sel) => (sel === id ? null : sel));
    },
    [commit]
  );
  const onRetime = useCallback(
    (id: string, start: number, end: number) =>
      commit((cs) => retimeCue(cs, id, start, end)),
    [commit]
  );
  const onSplitAt = useCallback(
    (t: number) => commit((cs) => splitCueAtTime(cs, t)),
    [commit]
  );
  const onAddAt = useCallback(
    (t: number) => {
      const prev = cuesRef.current;
      const next = insertCueAt(prev, t);
      if (next === prev) {
        setStatus("No room at the playhead — captions can't overlap.");
        return;
      }
      commit(next);
      setStatus("Caption added — edit its text in the transcript.");
    },
    [commit]
  );

  // drop the selection if its cue disappears (delete, split, regroup, undo…)
  useEffect(() => {
    if (selectedId && !cues.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [cues, selectedId]);

  // ---- keyboard shortcuts -------------------------------------------------------
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        e.preventDefault();
        redo();
      } else if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (key === "s" && !mod) {
        e.preventDefault();
        onSplitAt(timeRef.current);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        e.preventDefault();
        onDelete(selectedIdRef.current);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowLeft" ? -1 : 1);
        onSeek(Math.max(0, timeRef.current + step));
      } else if (e.key === "," || e.key === ".") {
        // frame-step (~1/30s), pausing for precision — Daxio-style , / .
        e.preventDefault();
        const v = videoElRef.current;
        if (v) {
          v.pause();
          v.currentTime = Math.max(
            0,
            v.currentTime + (e.key === "," ? -1 : 1) / 30
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, togglePlay, onSplitAt, onDelete, onSeek]);

  const effectiveDuration = duration || transcriptDuration(cues);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        hasVideo={!!videoUrl}
        hasCues={cues.length > 0}
        busy={busy}
        language={language}
        status={status}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onUpload={handleUpload}
        onImportSrt={handleImportSrt}
        onTranscribe={handleTranscribe}
        onLoadSample={handleLoadSample}
        onExportSrt={handleExportSrt}
        onLanguage={setLanguage}
      />

      {!videoUrl ? (
        <Hero onUpload={handleUpload} />
      ) : (
        <>
          <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr_320px]">
            <section className="hidden min-h-0 flex-col border-r border-edge bg-surface/60 lg:flex">
              <PanelHeader>
                Transcript{" "}
                {cues.length > 0 && <span className="text-muted">· {cues.length}</span>}
              </PanelHeader>
              <div className="min-h-0 flex-1">
                <TranscriptPanel
                  cues={cues}
                  activeId={activeId}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onSeek={onSeek}
                  onEditText={onEditText}
                  onSplit={onSplit}
                  onMerge={onMerge}
                  onDelete={onDelete}
                />
              </div>
            </section>

            <section className="flex min-h-0 flex-col p-4 pb-2">
              <div className="min-h-0 flex-1">
                <VideoStage
                  videoUrl={videoUrl}
                  cues={cues}
                  style={style}
                  seekTo={seekTo}
                  progress={progress}
                  onTime={setCurrentTime}
                  onDuration={setDuration}
                  timeRef={timeRef}
                  onVideoEl={(el) => {
                    videoElRef.current = el;
                  }}
                  onPlayingChange={(p) => {
                    playingRef.current = p;
                  }}
                />
              </div>
            </section>

            <section className="hidden min-h-0 flex-col border-l border-edge bg-surface/60 lg:flex">
              <PanelHeader>Style</PanelHeader>
              <div className="min-h-0 flex-1">
                <StylePanel
                  style={style}
                  onChange={handleStyleChange}
                  onPreset={handlePreset}
                />
              </div>
            </section>
          </main>

          {/* timeline */}
          <div className="shrink-0 border-t border-edge bg-surface/80">
            <Timeline
              cues={cues}
              duration={effectiveDuration}
              selectedId={selectedId}
              timeRef={timeRef}
              playingRef={playingRef}
              peaks={peaks}
              onSelect={setSelectedId}
              onSeek={onSeek}
              onRetime={onRetime}
              onSplitAt={onSplitAt}
              onDeleteCue={onDelete}
              onAddAt={onAddAt}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Hero({ onUpload }: { onUpload: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-hero-grad p-6">
      <div className="w-full max-w-2xl text-center">
        <span className="chip mx-auto mb-5 w-fit border-accent/30 bg-accent/10 text-accent2">
          ✨ Real speech-to-text in your browser — no server, no API key
        </span>
        <h1 className="mb-2 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          Caption your videos beautifully
        </h1>
        <p className="mx-auto mb-8 max-w-md text-sm text-muted">
          Upload a clip, auto-transcribe it locally with Whisper, then perfect the
          timing on a full editing timeline with premium caption templates.
        </p>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onUpload(f);
          }}
          className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 transition-all ${
            drag
              ? "border-accent bg-accent/10"
              : "border-edge2 bg-surface/50 hover:border-accent/60 hover:bg-surface"
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-grad text-white shadow-glow transition-transform group-hover:scale-105">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 11V3M8 3 4.5 6.5M8 3l3.5 3.5M3 11.5V13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13v-1.5" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-white">Drop a video or audio file</p>
            <p className="text-xs text-muted">
              or click to browse · MP4, MOV, WEBM, MP3, WAV
            </p>
          </div>
          <input
            ref={input}
            type="file"
            accept="video/*,audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
          <span>🎙️ Whisper transcription</span>
          <span>🎬 Editing timeline</span>
          <span>🎨 9 premium templates</span>
          <span>↩️ Undo/redo</span>
          <span>🌐 Hinglish</span>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center border-b border-edge px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}
