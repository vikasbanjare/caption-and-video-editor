"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cue, CaptionStyle } from "@/engine";
import {
  parseSRT,
  serializeSRT,
  regroupCues,
  applyKeywordHighlight,
  romanizeTranscript,
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
import Toolbar from "./Toolbar";
import VideoStage from "./VideoStage";
import TranscriptPanel from "./TranscriptPanel";
import StylePanel from "./StylePanel";

/**
 * Phase 1 editor (WEBSAASPLAN.md §6): upload → transcribe (stub) / import SRT →
 * editable transcript → live styled preview. No export/accounts/billing yet —
 * those are later phases. All caption logic comes from the shared engine.
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
  const [providerLabel, setProviderLabel] = useState("");

  // Discover which transcription backend is active (stub vs. real ASR).
  useEffect(() => {
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((d) => setProviderLabel(d.label || ""))
      .catch(() => {});
  }, []);

  // Revoke the object URL when it changes / on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const activeId = useMemo(
    () => activeCueAt(cues, currentTime)?.id ?? null,
    [cues, currentTime]
  );

  // Build a display-ready cue list from raw cues: regroup → romanize → highlight.
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

  const handleUpload = useCallback(
    (file: File) => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoFile(file);
      setStatus(`Loaded ${file.name}. Auto-transcribe or import an SRT.`);
    },
    [videoUrl]
  );

  const handleTranscribe = useCallback(async () => {
    if (!videoUrl) return;
    setBusy(true);
    try {
      // Ask which backend is active (real ASR vs. stub).
      const cap = await fetch("/api/transcribe")
        .then((r) => r.json())
        .catch(() => null);

      if (cap?.ready && cap.needsMedia && videoFile) {
        // Real path: upload the media, get back word-level cues.
        setStatus(`Transcribing with ${cap.label}…`);
        const fd = new FormData();
        fd.append("file", videoFile);
        fd.append("language", language);
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Transcription failed");
        setCues(finalize(data.cues as Cue[], style));
        setStatus(`Transcribed with ${cap.label}. Edit, then style.`);
      } else {
        // Stub path: metadata only.
        setStatus("Transcribing (stub)…");
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ durationSeconds: duration, language }),
        });
        const data = await res.json();
        const parsed = parseSRT(data.srt);
        setCues(finalize(parsed, style));
        setStatus(
          data.stub
            ? "Stub transcript loaded — edit it, then style. (Set DEEPGRAM_API_KEY for real ASR.)"
            : "Transcript loaded."
        );
      }
    } catch (err) {
      setStatus(`Transcription failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [videoUrl, videoFile, duration, language, style, finalize]);

  const handleImportSrt = useCallback(
    (text: string) => {
      const parsed = parseSRT(text);
      if (parsed.length === 0) {
        setStatus("Could not parse that SRT — is it valid?");
        return;
      }
      setCues(finalize(parsed, style));
      setStatus(`Imported ${parsed.length} cues from SRT.`);
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

  // Style edits. Changing wordsPerCue re-groups the current cues.
  const handleStyleChange = useCallback(
    (patch: Partial<CaptionStyle>) => {
      setStyle((prev) => {
        const next = { ...prev, ...patch };
        if (
          patch.wordsPerCue !== undefined &&
          patch.wordsPerCue !== prev.wordsPerCue
        ) {
          setCues((cs) => applyKeywordHighlight(regroupCues(cs, next.wordsPerCue)));
        }
        return next;
      });
    },
    []
  );

  const handlePreset = useCallback((id: string) => {
    const next = styleFromPreset(id);
    setStyle(next);
    setCues((cs) =>
      cs.length ? applyKeywordHighlight(regroupCues(cs, next.wordsPerCue)) : cs
    );
  }, []);

  const onSeek = useCallback((t: number) => setSeekTo({ t }), []);

  // Transcript editing
  const onEditText = useCallback(
    (id: string, text: string) => setCues((cs) => updateCueText(cs, id, text)),
    []
  );
  const onSplit = useCallback(
    (id: string) => setCues((cs) => splitCue(cs, id)),
    []
  );
  const onMerge = useCallback(
    (id: string) => setCues((cs) => mergeWithNext(cs, id)),
    []
  );
  const onDelete = useCallback(
    (id: string) => setCues((cs) => deleteCue(cs, id)),
    []
  );

  const effectiveDuration = duration || transcriptDuration(cues);

  return (
    <div className="flex h-screen flex-col bg-ink">
      <Toolbar
        hasVideo={!!videoUrl}
        hasCues={cues.length > 0}
        busy={busy}
        language={language}
        providerLabel={providerLabel}
        status={status}
        onUpload={handleUpload}
        onImportSrt={handleImportSrt}
        onTranscribe={handleTranscribe}
        onExportSrt={handleExportSrt}
        onLanguage={setLanguage}
      />

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[320px_1fr_300px]">
        {/* transcript */}
        <section className="hidden min-h-0 flex-col border-r border-edge bg-panel lg:flex">
          <PanelHeader>
            Transcript {cues.length > 0 && `(${cues.length})`}
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

        {/* preview */}
        <section className="flex min-h-0 flex-col p-4">
          <VideoStage
            videoUrl={videoUrl}
            cues={cues}
            style={style}
            seekTo={seekTo}
            onTime={setCurrentTime}
            onDuration={setDuration}
          />
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Live preview · {effectiveDuration ? `${effectiveDuration.toFixed(1)}s` : "—"} ·
            render.js draws exactly what the export will burn in.
          </p>
        </section>

        {/* style */}
        <section className="hidden min-h-0 flex-col border-l border-edge bg-panel lg:flex">
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
    </div>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-edge px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </div>
  );
}
