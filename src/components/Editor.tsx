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
  splitCue,
  mergeWithNext,
  deleteCue,
} from "@/lib/transcript";
import {
  transcribeInBrowser,
  type TranscribeProgress,
} from "@/lib/transcribe-browser";
import { buildStubSrt } from "@/server/transcription/stub";
import Toolbar from "./Toolbar";
import VideoStage from "./VideoStage";
import TranscriptPanel from "./TranscriptPanel";
import StylePanel from "./StylePanel";

/**
 * The editor: upload → real in-browser transcription (Whisper) → editable
 * transcript → live styled preview with premium templates. The same render
 * engine drives the preview and (later) the server burn-in export.
 */
export default function Editor() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(() =>
    styleFromPreset(DEFAULT_PRESET.id)
  );
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Upload a video to begin.");
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTo, setSeekTo] = useState<{ t: number } | null>(null);
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

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

  const handleUpload = useCallback((file: File) => {
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setVideoFile(file);
    setStatus(`Loaded ${file.name}. Hit Auto-transcribe.`);
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!videoFile) return;
    setBusy(true);
    setProgress({ phase: "decoding", label: "Reading audio…" });
    try {
      const words = await transcribeInBrowser(videoFile, language, setProgress);
      if (words.length === 0) throw new Error("No speech detected in this clip.");
      setCues(finalize(cuesFromWords(words), style));
      setStatus(`Transcribed ${words.length} words — all in your browser.`);
    } catch (err) {
      setStatus(`Transcription failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [videoFile, language, style, finalize]);

  const handleLoadSample = useCallback(() => {
    setCues(finalize(parseSRT(buildStubSrt(duration || 24, language)), style));
    setStatus("Loaded sample captions (placeholder text, not from your video).");
  }, [duration, language, style, finalize]);

  const handleImportSrt = useCallback(
    (text: string) => {
      const parsed = parseSRT(text);
      if (parsed.length === 0) {
        setStatus("Could not parse that SRT — is it valid?");
        return;
      }
      setCues(finalize(parsed, style));
      setStatus(`Imported ${parsed.length} cues.`);
    },
    [style, finalize]
  );

  const handleExportSrt = useCallback(() => {
    const blob = new Blob([serializeSRT(cues)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "captions.srt";
    a.click();
    URL.revokeObjectURL(url);
  }, [cues]);

  const handleStyleChange = useCallback((patch: Partial<CaptionStyle>) => {
    setStyle((prev) => {
      const next = { ...prev, ...patch };
      if (patch.wordsPerCue !== undefined && patch.wordsPerCue !== prev.wordsPerCue) {
        setCues((cs) => applyKeywordHighlight(regroupCues(cs, next.wordsPerCue)));
      }
      return next;
    });
  }, []);

  const handlePreset = useCallback((id: string) => {
    const next = styleFromPreset(id);
    setStyle(next);
    setCues((cs) =>
      cs.length ? applyKeywordHighlight(regroupCues(cs, next.wordsPerCue)) : cs
    );
  }, []);

  const onSeek = useCallback((t: number) => setSeekTo({ t }), []);
  const onEditText = useCallback(
    (id: string, text: string) => setCues((cs) => updateCueText(cs, id, text)),
    []
  );
  const onSplit = useCallback((id: string) => setCues((cs) => splitCue(cs, id)), []);
  const onMerge = useCallback((id: string) => setCues((cs) => mergeWithNext(cs, id)), []);
  const onDelete = useCallback((id: string) => setCues((cs) => deleteCue(cs, id)), []);

  const effectiveDuration = duration || transcriptDuration(cues);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        hasVideo={!!videoUrl}
        hasCues={cues.length > 0}
        busy={busy}
        language={language}
        status={status}
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
        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[340px_1fr_340px]">
          <section className="hidden min-h-0 flex-col border-r border-edge bg-surface/60 lg:flex">
            <PanelHeader>
              Transcript {cues.length > 0 && <span className="text-muted">· {cues.length}</span>}
            </PanelHeader>
            <div className="min-h-0 flex-1">
              <TranscriptPanel
                cues={cues}
                activeId={activeId}
                onSeek={onSeek}
                onEditText={onEditText}
                onSplit={onSplit}
                onMerge={onMerge}
                onDelete={onDelete}
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col p-5">
            <VideoStage
              videoUrl={videoUrl}
              cues={cues}
              style={style}
              seekTo={seekTo}
              progress={progress}
              onTime={setCurrentTime}
              onDuration={setDuration}
            />
            <p className="mt-3 text-center text-[11px] text-muted">
              Live preview · {effectiveDuration ? `${effectiveDuration.toFixed(1)}s` : "—"} ·
              the preview is exactly what an export would burn in
            </p>
          </section>

          <section className="hidden min-h-0 flex-col border-l border-edge bg-surface/60 lg:flex">
            <PanelHeader>Style</PanelHeader>
            <div className="min-h-0 flex-1">
              <StylePanel style={style} onChange={handleStyleChange} onPreset={handlePreset} />
            </div>
          </section>
        </main>
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
          Upload a clip, auto-transcribe it locally with Whisper, then style
          animated captions with premium templates.
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
            <p className="text-xs text-muted">or click to browse · MP4, MOV, WEBM, MP3, WAV</p>
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
          <span>🎨 9 premium templates</span>
          <span>✏️ Editable transcript</span>
          <span>🌐 Hinglish romanization</span>
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
