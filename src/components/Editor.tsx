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
import Toolbar from "./Toolbar";
import VideoStage from "./VideoStage";
import TranscriptPanel from "./TranscriptPanel";
import NotesPanel from "./NotesPanel";
import StylePanel from "./StylePanel";
import Timeline from "./Timeline";
import ProjectLibrary from "./ProjectLibrary";
import Landing from "./Landing";

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
  const [showLibrary, setShowLibrary] = useState(false);

  // ---- notes -----------------------------------------------------------------
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [leftTab, setLeftTab] = useState<"transcript" | "notes">("transcript");

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
      setStatus(`Loaded ${file.name}. Hit Auto-transcribe.`);
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

  const handleUpload = useCallback(
    (file: File) => startProjectFromFile(file),
    [startProjectFromFile]
  );

  const openProject = useCallback(
    async (id: string) => {
      const rec = getProject(id);
      if (!rec) return;
      const blob = await loadProjectVideo(id);
      setShowLibrary(false);
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
      setStatus(`Opened “${rec.title}”.`);
    },
    [resetHistory]
  );

  const newProject = useCallback(() => {
    setShowLibrary(false);
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

  const handleExportSrt = useCallback(() => {
    const blob = new Blob([serializeSRT(cuesRef.current)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "captions").replace(/[^\w-]+/g, "_")}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [title]);

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

  return (
    <div className="flex h-screen flex-col">
      {!videoUrl ? (
        <Landing onUpload={handleUpload} projects={projects} onOpen={openProject} />
      ) : (
        <>
          <Toolbar
            hasVideo={!!videoUrl}
            hasCues={cues.length > 0}
            hasProject={!!projectId}
            title={title}
            projectCount={projects.length}
            busy={busy}
            language={language}
            status={status}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onTitleChange={setTitle}
            onOpenLibrary={() => setShowLibrary(true)}
            onUpload={handleUpload}
            onImportSrt={handleImportSrt}
            onTranscribe={handleTranscribe}
            onLoadSample={handleLoadSample}
            onExportSrt={handleExportSrt}
            onLanguage={setLanguage}
          />
          <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr_320px]">
            <section className="hidden min-h-0 flex-col border-r border-edge bg-surface/60 lg:flex">
              <div className="flex gap-1 border-b border-edge px-2 py-1.5">
                <PanelTab active={leftTab === "transcript"} onClick={() => setLeftTab("transcript")}>
                  Transcript {cues.length > 0 && <Count n={cues.length} />}
                </PanelTab>
                <PanelTab active={leftTab === "notes"} onClick={() => setLeftTab("notes")}>
                  Notes {openNoteCount > 0 && <Count n={openNoteCount} accent />}
                </PanelTab>
              </div>
              <div className="min-h-0 flex-1">
                {leftTab === "transcript" ? (
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
                ) : (
                  <NotesPanel
                    notes={notes}
                    noteMode={noteMode}
                    onToggleMode={() => setNoteMode((m) => !m)}
                    onSeek={onSeek}
                    onEdit={editNote}
                    onToggleResolved={toggleNoteResolved}
                    onDelete={deleteNote}
                    onAddAtPlayhead={onAddNoteAtPlayhead}
                  />
                )}
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
                  notes={notes}
                  noteMode={noteMode}
                  onAddNote={onAddNoteAt}
                  onSeekNote={onSeek}
                />
              </div>
            </section>

            <section className="hidden min-h-0 flex-col border-l border-edge bg-surface/60 lg:flex">
              <PanelHeader>Style</PanelHeader>
              <div className="min-h-0 flex-1">
                <StylePanel style={style} onChange={handleStyleChange} onPreset={handlePreset} />
              </div>
            </section>
          </main>

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

      {showLibrary && (
        <ProjectLibrary
          projects={projects}
          currentId={projectId}
          onOpen={openProject}
          onDelete={handleDeleteProject}
          onNew={newProject}
          onClose={() => setShowLibrary(false)}
        />
      )}
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

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center border-b border-edge px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
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
        active ? "bg-surface3 text-white" : "text-muted hover:text-white"
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
