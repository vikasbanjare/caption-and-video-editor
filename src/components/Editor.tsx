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
import {
  removeFillerWords,
  generateChapters,
  chaptersToText,
  formatTimestamp,
  type Chapter,
} from "@/lib/tools";
import {
  initStore,
  listProjects,
  saveProject,
  deleteProject,
  loadProjectVideo,
  getProject,
  uid,
  type ProjectRecord,
  type ProjectNote,
} from "@/lib/store";
import { buildStubSrt } from "@/server/transcription/stub";
import { exportBurnIn, downloadBlob, isExportSupported } from "@/lib/export";
import { buildAss } from "@/lib/ass";
import { buildOtio, buildMarkerCsv } from "@/lib/interchange";
import {
  DEFAULT_GRADE,
  gradeFilter,
  isGradeActive,
  LOOKS,
  type ColorGrade,
} from "@/lib/grade";
import VideoStage from "./VideoStage";
import TranscriptPanel from "./TranscriptPanel";
import NotesPanel from "./NotesPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import StylePanel from "./StylePanel";
import Timeline from "./Timeline";
import ProjectConsole from "./ProjectConsole";
import StageRail, { type Stage } from "./StageRail";
import { PulseMark, Wordmark } from "./Logo";

/**
 * The editing studio: upload → real in-browser transcription (Whisper) →
 * editable transcript + full timeline → live styled preview → auto-saved local
 * projects with frame notes (persistence + notes ported from the Daxio review
 * tool). The same render engine drives the preview and the future export.
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

  // ---- projects / persistence -----------------------------------------------
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [createdAt, setCreatedAt] = useState(0);
  const [thumb, setThumb] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("ingest");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [safeZones, setSafeZones] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const srtInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setTheme(t);
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("cutpilot-theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ---- notes -----------------------------------------------------------------
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [leftTab, setLeftTab] = useState<"transcript" | "notes" | "insights">("transcript");

  // ---- video export (burn-in) ------------------------------------------------
  const [exportPct, setExportPct] = useState<number | null>(null);

  // ---- color grade -----------------------------------------------------------
  const [grade, setGrade] = useState<ColorGrade>(DEFAULT_GRADE);
  const gradeRef = useRef(grade);
  gradeRef.current = grade;
  const patchGrade = useCallback(
    (p: Partial<ColorGrade>) => setGrade((g) => ({ ...g, ...p })),
    []
  );

  // shared mutable playback state (updated per animation frame, no re-render)
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
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

  const resetHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    lastActionRef.current = "";
    setHistoryTick((t) => t + 1);
  }, []);

  void historyTick;
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // ---- store init ------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    initStore().then(() => {
      if (alive) setProjects(listProjects());
    });
    return () => {
      alive = false;
    };
  }, []);
  const refreshProjects = useCallback(() => setProjects(listProjects()), []);

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

  // ---- autosave (debounced) --------------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // opportunistically capture a thumbnail once the frame is decodable
      let t = thumb;
      if (!t && videoElRef.current && videoElRef.current.readyState >= 2) {
        t = captureThumb(videoElRef.current);
        if (t) setThumb(t);
      }
      const rec: ProjectRecord = {
        id: projectId,
        title: title.trim() || "Untitled",
        createdAt: createdAt || Date.now(),
        updatedAt: Date.now(),
        duration,
        language,
        style,
        cues,
        notes,
        thumb: t,
        video: videoFileRef.current
          ? {
              name: videoFileRef.current.name,
              type: videoFileRef.current.type,
              size: videoFileRef.current.size,
            }
          : null,
      };
      saveProject(rec)
        .then(refreshProjects)
        .catch(() => {});
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [projectId, title, createdAt, duration, language, style, cues, notes, thumb, refreshProjects]);

  // ---- top-level actions --------------------------------------------------------
  const startProjectFromFile = useCallback(
    (file: File) => {
      const id = uid("p");
      const now = Date.now();
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setVideoFile(file);
      videoFileRef.current = file;
      setProjectId(id);
      setCreatedAt(now);
      setTitle(file.name.replace(/\.[^.]+$/, "") || "Untitled");
      setThumb(null);
      setNotes([]);
      setNoteMode(false);
      setSelectedId(null);
      setDuration(0);
      resetHistory();
      setCuesRaw([]);
      setStage("script"); // media in → go to the Script (transcribe) room
      setStatus(`Loaded ${file.name}. Run Auto-transcribe.`);
      // persist the media blob immediately so the project survives a reload
      saveProject(
        {
          id,
          title: file.name.replace(/\.[^.]+$/, "") || "Untitled",
          createdAt: now,
          updatedAt: now,
          duration: 0,
          language,
          style,
          cues: [],
          notes: [],
          thumb: null,
          video: { name: file.name, type: file.type, size: file.size },
        },
        file
      )
        .then(refreshProjects)
        .catch(() => {});
    },
    [language, style, resetHistory, refreshProjects]
  );

  const openProject = useCallback(
    async (id: string) => {
      const rec = getProject(id);
      if (!rec) return;
      const blob = await loadProjectVideo(id);
      if (!blob) {
        setStatus("That project's video is missing (storage was cleared).");
        return;
      }
      const file = new File([blob], rec.video?.name || "video", {
        type: rec.video?.type || blob.type,
      });
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setVideoFile(file);
      videoFileRef.current = file;
      setProjectId(rec.id);
      setCreatedAt(rec.createdAt);
      setTitle(rec.title);
      setThumb(rec.thumb);
      setNotes(rec.notes || []);
      setStyle(rec.style);
      setLanguage(rec.language);
      setDuration(rec.duration);
      setNoteMode(false);
      setSelectedId(null);
      resetHistory();
      setCuesRaw(rec.cues || []);
      setStage((rec.cues || []).length ? "cut" : "script");
      setStatus(`Opened “${rec.title}”.`);
    },
    [resetHistory]
  );

  const newProject = useCallback(() => {
    setStage("ingest");
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVideoFile(null);
    videoFileRef.current = null;
    setProjectId(null);
    setTitle("Untitled");
    setThumb(null);
    setNotes([]);
    setNoteMode(false);
    setSelectedId(null);
    setDuration(0);
    resetHistory();
    setCuesRaw([]);
    setStatus("Upload a video to begin.");
  }, [resetHistory]);

  const handleDeleteProject = useCallback(
    (id: string) => {
      deleteProject(id);
      refreshProjects();
      if (id === projectId) newProject();
    },
    [projectId, newProject, refreshProjects]
  );

  const handleTranscribe = useCallback(async () => {
    const file = videoFile;
    if (!file) return;
    setBusy(true);
    setProgress({ phase: "decoding", label: "Reading audio…" });
    try {
      const words = await transcribeInBrowser(file, language, setProgress);
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

  // ---- Pulse tools -----------------------------------------------------------
  const handleCleanUp = useCallback(() => {
    const { cues: next, removed } = removeFillerWords(cuesRef.current);
    if (removed === 0) {
      setStatus("No filler words or stutters found.");
      return;
    }
    commit(applyKeywordHighlight(next));
    setStatus(`Removed ${removed} filler${removed > 1 ? "s" : ""} / stutter${removed > 1 ? "s" : ""}.`);
  }, [commit]);

  const handleChapters = useCallback(() => {
    const ch = generateChapters(cuesRef.current);
    setChapters(ch);
    setStatus(ch.length ? `Generated ${ch.length} chapters.` : "Add captions first.");
  }, []);

  const copyChapters = useCallback(() => {
    navigator.clipboard?.writeText(chaptersToText(chapters)).then(
      () => setStatus("Chapters copied to clipboard."),
      () => setStatus("Couldn't copy — select and copy manually.")
    );
  }, [chapters]);

  const resetCaptionPos = useCallback(() => {
    handleStyleChange({ offsetX: 0, offsetY: 0 });
    setStatus("Caption position reset.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportSrt = useCallback(() => {
    const blob = new Blob([serializeSRT(cuesRef.current)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "captions").replace(/[^\w-]+/g, "_")}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [title]);

  const handleExportAss = useCallback(() => {
    const v = videoElRef.current;
    const ass = buildAss(cuesRef.current, styleRef.current, {
      width: v?.videoWidth || 1080,
      height: v?.videoHeight || 1920,
    });
    const blob = new Blob([ass], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "captions").replace(/[^\w-]+/g, "_")}.ass`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Exported styled .ass — import into DaVinci Resolve or any libass player.");
  }, [title]);

  const downloadText = useCallback(
    (text: string, ext: string, mime = "text/plain") => {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "pulse").replace(/[^\w-]+/g, "_")}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [title]
  );

  const handleExportOtio = useCallback(() => {
    const chaps = chapters.length ? chapters : generateChapters(cuesRef.current);
    downloadText(
      buildOtio({
        name: title || "Pulse Timeline",
        mediaName: videoFileRef.current?.name || "clip.mp4",
        durationSec: transcriptDuration(cuesRef.current) || duration || 0,
        chapters: chaps,
      }),
      "otio",
      "application/json"
    );
    setStatus("Exported .otio timeline — import into DaVinci Resolve or Premiere Pro.");
  }, [chapters, title, duration, downloadText]);

  const handleExportMarkers = useCallback(() => {
    const chaps = chapters.length ? chapters : generateChapters(cuesRef.current);
    downloadText(buildMarkerCsv(chaps), "csv", "text/csv");
    setStatus(`Exported ${chaps.length} chapter markers (.csv) for Resolve / Premiere.`);
  }, [chapters, downloadText]);

  const handleExportVideo = useCallback(async () => {
    if (!videoUrl || exportPct !== null) return;
    if (!isExportSupported()) {
      setStatus("This browser can't record video — try Chrome, Edge or Safari.");
      return;
    }
    const dur = transcriptDuration(cuesRef.current) || duration || 0;
    setExportPct(0);
    setStatus("Rendering video with burned-in captions… (records in real time)");
    try {
      const { blob, ext } = await exportBurnIn({
        videoUrl,
        cues: cuesRef.current,
        style: styleRef.current,
        duration: dur,
        filter: isGradeActive(gradeRef.current)
          ? gradeFilter(gradeRef.current)
          : undefined,
        onProgress: (f) => setExportPct(f),
      });
      const base = (title || "pulse-captions").replace(/[^\w-]+/g, "_");
      downloadBlob(blob, `${base}.${ext}`);
      setStatus(`Exported ${base}.${ext} (${(blob.size / 1e6).toFixed(1)} MB).`);
    } catch (err) {
      setStatus(`Export failed: ${(err as Error).message}`);
    } finally {
      setExportPct(null);
    }
  }, [videoUrl, duration, title, exportPct]);

  // ---- style ----------------------------------------------------------------
  const handleStyleChange = useCallback(
    (patch: Partial<CaptionStyle>) => {
      const prev = styleRef.current;
      const next = { ...prev, ...patch };
      setStyle(next);
      if (patch.wordsPerCue !== undefined && patch.wordsPerCue !== prev.wordsPerCue) {
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
      if (cuesRef.current.length && next.wordsPerCue !== prev.wordsPerCue) {
        commit((cs) => applyKeywordHighlight(regroupCues(cs, next.wordsPerCue)));
        setSelectedId(null);
      }
    },
    [commit]
  );

  // ---- playback / seeking -----------------------------------------------------
  const onSeek = useCallback((t: number) => {
    timeRef.current = t;
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
  const onSplit = useCallback((id: string) => commit((cs) => splitCue(cs, id)), [commit]);
  const onMerge = useCallback((id: string) => commit((cs) => mergeWithNext(cs, id)), [commit]);
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

  useEffect(() => {
    if (selectedId && !cues.some((c) => c.id === selectedId)) setSelectedId(null);
  }, [cues, selectedId]);

  // The monitor remounts when switching stages — restore the playhead position.
  useEffect(() => {
    if (videoUrl && timeRef.current > 0) setSeekTo({ t: timeRef.current });
  }, [stage, videoUrl]);

  // ---- notes ------------------------------------------------------------------
  const addNote = useCallback((t: number, x: number | null, y: number | null) => {
    setNotes((ns) => [
      ...ns,
      { id: uid("n"), t, x, y, body: "", resolved: false, createdAt: Date.now() },
    ]);
    setLeftTab("notes");
  }, []);
  const onAddNoteAt = useCallback(
    (x: number, y: number, t: number) => {
      addNote(t, x, y);
      setNoteMode(false);
    },
    [addNote]
  );
  const onAddNoteAtPlayhead = useCallback(
    () => addNote(timeRef.current, null, null),
    [addNote]
  );
  const editNote = useCallback(
    (id: string, body: string) =>
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, body } : n))),
    []
  );
  const toggleNoteResolved = useCallback(
    (id: string) =>
      setNotes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, resolved: !n.resolved } : n))
      ),
    []
  );
  const deleteNote = useCallback(
    (id: string) => setNotes((ns) => ns.filter((n) => n.id !== id)),
    []
  );

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
        e.preventDefault();
        const v = videoElRef.current;
        if (v) {
          v.pause();
          v.currentTime = Math.max(0, v.currentTime + (e.key === "," ? -1 : 1) / 30);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, togglePlay, onSplitAt, onDelete, onSeek]);

  const effectiveDuration = duration || transcriptDuration(cues);
  const openNoteCount = notes.filter((n) => !n.resolved).length;
  const hasMedia = !!videoUrl;

  // One monitor instance, placed into whichever stage is active.
  const monitor = videoUrl ? (
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
      notes={notes}
      noteMode={noteMode}
      onAddNote={onAddNoteAt}
      onSeekNote={onSeek}
      onStyleChange={handleStyleChange}
      safeZones={safeZones}
      videoFilter={isGradeActive(grade) ? gradeFilter(grade) : undefined}
    />
  ) : null;

  return (
    <div className="flex h-screen flex-col bg-bg text-ink">
      {/* slim top bar */}
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-edge bg-surface px-3">
        <button onClick={() => setStage("ingest")} className="flex items-center gap-2" title="Project console">
          <PulseMark size={18} />
          <Wordmark />
        </button>
        {hasMedia && (
          <>
            <span className="text-edge2">/</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-44 rounded-sm bg-transparent px-1.5 py-0.5 text-sm font-medium outline-none hover:bg-surface2 focus:bg-surface2"
              aria-label="Project title"
            />
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <TopBtn title="Toggle light / dark" onClick={toggleTheme}>
            {theme === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3.2" /><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M13 3l-1.1 1.1M4.1 11.9 3 13" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M6.2 2.2a5.8 5.8 0 1 0 7.6 7.6A4.8 4.8 0 0 1 6.2 2.2Z" /></svg>
            )}
          </TopBtn>
          <span className="mx-0.5 h-5 w-px bg-edge" />
          <TopBtn title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3 3 6.5 6.5 10" /><path d="M3 6.5h6a4 4 0 0 1 0 8H7" /></svg>
          </TopBtn>
          <TopBtn title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3 13 6.5 9.5 10" /><path d="M13 6.5H7a4 4 0 0 0 0 8h2" /></svg>
          </TopBtn>
          <span className="mx-1.5 h-5 w-px bg-edge" />
          <span className="hidden max-w-[42ch] truncate font-mono text-[11px] text-muted sm:block" title={status}>
            {status}
          </span>
        </div>
      </header>

      {/* active stage room */}
      <div className="relative min-h-0 flex-1">
        {stage === "ingest" && (
          <ProjectConsole
            projects={projects}
            currentId={projectId}
            onOpen={openProject}
            onDelete={handleDeleteProject}
            onNew={startProjectFromFile}
          />
        )}

        {stage === "script" && hasMedia && (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[360px_1fr]">
            <aside className="scroll-thin hidden min-h-0 flex-col overflow-y-auto border-r border-edge lg:flex">
              <div className="border-b border-edge p-3">
                <div className="aspect-video overflow-hidden rounded bg-black">{monitor}</div>
              </div>
              <div className="space-y-3 p-3">
                <div>
                  <span className="label">Spoken language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="select">
                    <option value="en">English</option>
                    <option value="hi">Hindi → Hinglish</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="pt">Portuguese</option>
                  </select>
                </div>
                <button className="btn btn-primary w-full justify-center" onClick={handleTranscribe} disabled={busy}>
                  {busy ? "Transcribing…" : "Auto-transcribe"}
                </button>
                {progress && (
                  <div>
                    <div className="mb-1 font-mono text-[10px] text-muted">{progress.label}</div>
                    {typeof progress.percent === "number" && (
                      <div className="h-1 overflow-hidden rounded-full bg-surface3">
                        <div className="h-full bg-accent transition-all" style={{ width: `${progress.percent}%` }} />
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn justify-center" onClick={() => srtInput.current?.click()}>Import SRT</button>
                  <button className="btn justify-center" onClick={handleLoadSample} disabled={busy}>Sample</button>
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-muted">
                  Whisper runs on your device. The first run downloads the model once, then it&apos;s cached.
                </p>

                {/* transcript tools */}
                <div className="border-t border-edge pt-3">
                  <span className="label">Tools</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn justify-center" onClick={handleCleanUp} disabled={!cues.length} title="Remove um / uh / stutters">
                      Clean up
                    </button>
                    <button className="btn justify-center" onClick={handleChapters} disabled={!cues.length} title="Auto-chapters from the transcript">
                      Chapters
                    </button>
                  </div>
                  {chapters.length > 0 && (
                    <div className="mt-2 rounded border border-edge bg-surface2">
                      <div className="flex items-center justify-between border-b border-edge px-2.5 py-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-label text-muted">
                          {chapters.length} chapters
                        </span>
                        <button onClick={copyChapters} className="font-mono text-[10px] text-accent2 hover:underline">
                          Copy
                        </button>
                      </div>
                      <div className="scroll-thin max-h-40 overflow-y-auto p-1.5">
                        {chapters.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => onSeek(c.start)}
                            className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-surface3"
                          >
                            <span className="font-mono text-[10px] text-accent2">{formatTimestamp(c.start)}</span>
                            <span className="truncate text-xs text-ink">{c.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
            <main className="flex min-h-0 flex-col">
              <StageHead title="Script" hint="Correct the words">
                <PanelTab active={leftTab === "transcript"} onClick={() => setLeftTab("transcript")}>
                  Transcript {cues.length > 0 && <Count n={cues.length} />}
                </PanelTab>
                <PanelTab active={leftTab === "notes"} onClick={() => setLeftTab("notes")}>
                  Notes {openNoteCount > 0 && <Count n={openNoteCount} accent />}
                </PanelTab>
                <PanelTab active={leftTab === "insights"} onClick={() => setLeftTab("insights")}>
                  Insights
                </PanelTab>
              </StageHead>
              <div className="min-h-0 flex-1">
                {leftTab === "transcript" ? (
                  <TranscriptPanel cues={cues} activeId={activeId} selectedId={selectedId} onSelect={setSelectedId} onSeek={onSeek} onEditText={onEditText} onSplit={onSplit} onMerge={onMerge} onDelete={onDelete} />
                ) : leftTab === "notes" ? (
                  <NotesPanel notes={notes} noteMode={noteMode} onToggleMode={() => setNoteMode((m) => !m)} onSeek={onSeek} onEdit={editNote} onToggleResolved={toggleNoteResolved} onDelete={deleteNote} onAddAtPlayhead={onAddNoteAtPlayhead} />
                ) : (
                  <AnalyticsPanel cues={cues} duration={effectiveDuration} peaks={peaks} />
                )}
              </div>
            </main>
          </div>
        )}

        {stage === "cut" && hasMedia && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
              <aside className="hidden min-h-0 border-r border-edge lg:block">
                <TranscriptPanel cues={cues} activeId={activeId} selectedId={selectedId} onSelect={setSelectedId} onSeek={onSeek} onEditText={onEditText} onSplit={onSplit} onMerge={onMerge} onDelete={onDelete} />
              </aside>
              <section className="flex min-h-0 flex-col p-4">
                <div className="min-h-0 flex-1">{monitor}</div>
              </section>
            </div>
            <div className="shrink-0 border-t border-edge bg-surface/60">
              <Timeline cues={cues} duration={effectiveDuration} selectedId={selectedId} timeRef={timeRef} playingRef={playingRef} peaks={peaks} onSelect={setSelectedId} onSeek={onSeek} onRetime={onRetime} onSplitAt={onSplitAt} onDeleteCue={onDelete} onAddAt={onAddAt} />
            </div>
          </div>
        )}

        {stage === "color" && hasMedia && (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[1fr_340px]">
            <section className="flex min-h-0 flex-col p-4">
              <div className="min-h-0 flex-1">{monitor}</div>
            </section>
            <aside className="hidden min-h-0 flex-col border-l border-edge lg:flex">
              <StageHead title="Color" hint="Grade the picture — baked into export">
                <button
                  onClick={() => setGrade(DEFAULT_GRADE)}
                  className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-label text-muted hover:text-ink"
                  title="Reset the grade"
                >
                  Reset
                </button>
              </StageHead>
              <div className="scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <div>
                  <span className="label">Look</span>
                  <div className="grid grid-cols-3 gap-2">
                    {LOOKS.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => patchGrade({ look: l.id })}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                          grade.look === l.id
                            ? "border-transparent bg-grad-accent text-white shadow-glow-sm"
                            : "border-edge bg-surface2 text-muted hover:text-ink"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <GradeSlider label="Exposure" value={grade.exposure} onChange={(v) => patchGrade({ exposure: v })} />
                <GradeSlider label="Contrast" value={grade.contrast} onChange={(v) => patchGrade({ contrast: v })} />
                <GradeSlider label="Saturation" value={grade.saturation} onChange={(v) => patchGrade({ saturation: v })} />
                <p className="font-mono text-[10px] leading-relaxed text-muted">
                  The grade renders live here and burns into the exported video —
                  same engine, so what you see is what ships.
                </p>
              </div>
            </aside>
          </div>
        )}

        {stage === "type" && hasMedia && (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[1fr_360px]">
            <section className="flex min-h-0 flex-col p-4">
              <div className="min-h-0 flex-1">{monitor}</div>
            </section>
            <aside className="hidden min-h-0 flex-col border-l border-edge lg:flex">
              <StageHead title="Type" hint="Drag caption on the monitor to move">
                <button
                  onClick={resetCaptionPos}
                  className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-label text-muted hover:text-ink"
                  title="Reset caption position"
                >
                  Reset pos
                </button>
                <button
                  onClick={() => setSafeZones((s) => !s)}
                  className={`rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-label transition-colors ${
                    safeZones ? "bg-accent text-white" : "text-muted hover:text-ink"
                  }`}
                  title="Toggle safe-zone guides"
                >
                  Safe zones
                </button>
              </StageHead>
              <div className="min-h-0 flex-1">
                <StylePanel style={style} onChange={handleStyleChange} onPreset={handlePreset} />
              </div>
            </aside>
          </div>
        )}

        {stage === "export" && hasMedia && (
          <div className="grid h-full min-h-0 grid-cols-1 place-items-center gap-8 p-8 lg:grid-cols-2">
            <div className="w-full max-w-sm lg:justify-self-end">
              <div className="aspect-video overflow-hidden rounded-lg border border-edge bg-black">{monitor}</div>
            </div>
            <div className="w-full max-w-sm">
              <span className="eyebrow">Export</span>
              <h2 className="mt-1.5 font-display text-2xl font-semibold">Deliver captions</h2>
              <p className="mt-2 text-sm text-muted">
                {cues.length} cues · {effectiveDuration.toFixed(1)}s
              </p>
              <div className="mt-5 space-y-2">
                <button
                  className="btn btn-primary w-full justify-center"
                  onClick={handleExportVideo}
                  disabled={!cues.length || exportPct !== null}
                >
                  {exportPct !== null
                    ? `Rendering… ${Math.round(exportPct * 100)}%`
                    : "Export video · captions burned in"}
                </button>
                {exportPct !== null && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface3">
                    <div
                      className="h-full bg-grad-accent transition-all"
                      style={{ width: `${Math.round(exportPct * 100)}%` }}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn w-full justify-center"
                    onClick={handleExportSrt}
                    disabled={!cues.length || exportPct !== null}
                  >
                    .srt
                  </button>
                  <button
                    className="btn w-full justify-center"
                    onClick={handleExportAss}
                    disabled={!cues.length || exportPct !== null}
                    title="Styled + word-karaoke captions for DaVinci Resolve / libass players"
                  >
                    .ass (styled)
                  </button>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-label text-muted">
                    Into your editor
                  </span>
                  <span className="h-px flex-1 bg-edge" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn w-full justify-center"
                    onClick={handleExportOtio}
                    disabled={!cues.length || exportPct !== null}
                    title="OpenTimelineIO — DaVinci Resolve 18.5+ and Premiere Pro 2025+ import natively"
                  >
                    .otio timeline
                  </button>
                  <button
                    className="btn w-full justify-center"
                    onClick={handleExportMarkers}
                    disabled={!cues.length || exportPct !== null}
                    title="Chapter markers CSV for DaVinci Resolve / Premiere"
                  >
                    markers .csv
                  </button>
                </div>
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
                Burn-in renders in your browser in real time (MP4 where
                supported, else WebM). Or hand off to an NLE: styled captions
                (.ass), the timeline (.otio) and chapter markers (.csv) drop
                straight into DaVinci Resolve / Premiere Pro.
              </p>
            </div>
          </div>
        )}
      </div>

      <StageRail stage={stage} onChange={setStage} hasMedia={hasMedia} />

      {/* hidden SRT importer (used by the Script room) */}
      <input
        ref={srtInput}
        type="file"
        accept=".srt,text/plain"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) handleImportSrt(await f.text());
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Grab a small JPEG thumbnail from the current video frame. */
function captureThumb(video: HTMLVideoElement): string | null {
  try {
    const w = 320;
    const ratio = video.videoHeight && video.videoWidth
      ? video.videoHeight / video.videoWidth
      : 0.5625;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = Math.round(w * ratio);
    const g = c.getContext("2d");
    if (!g) return null;
    g.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

function GradeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-label text-muted">
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted">
          {value > 0 ? `+${value}` : value}
        </span>
      </span>
      <input
        type="range"
        min={-100}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
      />
    </label>
  );
}

function StageHead({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-edge px-3 py-2">
      <span className="font-display text-[13px] font-semibold text-ink">{title}</span>
      {hint && <span className="eyebrow">{hint}</span>}
      {children && <div className="ml-auto flex gap-1">{children}</div>}
    </div>
  );
}

function TopBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-7 w-7 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function PanelTab({
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
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active ? "bg-surface3 text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n, accent }: { n: number; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        accent ? "bg-accent text-white" : "bg-surface2 text-muted"
      }`}
    >
      {n}
    </span>
  );
}
