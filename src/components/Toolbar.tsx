"use client";

import { useRef } from "react";

interface Props {
  hasVideo: boolean;
  hasCues: boolean;
  hasProject: boolean;
  title: string;
  projectCount: number;
  busy: boolean;
  language: string;
  status: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTitleChange: (t: string) => void;
  onOpenLibrary: () => void;
  onUpload: (file: File) => void;
  onImportSrt: (text: string) => void;
  onTranscribe: () => void;
  onLoadSample: () => void;
  onExportSrt: () => void;
  onLanguage: (lang: string) => void;
}

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi → Hinglish" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
];

export default function Toolbar({
  hasVideo,
  hasCues,
  hasProject,
  title,
  projectCount,
  busy,
  language,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTitleChange,
  onOpenLibrary,
  onUpload,
  onImportSrt,
  onTranscribe,
  onLoadSample,
  onExportSrt,
  onLanguage,
}: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const srtInput = useRef<HTMLInputElement>(null);

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface/80 px-4 py-2.5 backdrop-blur">
      <div className="mr-1 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent font-display text-[15px] font-semibold leading-none text-white">
          C
        </div>
        <span className="font-display text-[17px] font-semibold tracking-tight text-ink">
          CutPilot
        </span>
      </div>

      <button
        className="btn px-2.5"
        onClick={onOpenLibrary}
        title="My Projects"
        aria-label="My Projects"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="5" height="4.5" rx="1" />
          <rect x="9" y="3" width="5" height="4.5" rx="1" />
          <rect x="2" y="9" width="5" height="4.5" rx="1" />
          <rect x="9" y="9" width="5" height="4.5" rx="1" />
        </svg>
        {projectCount > 0 && <span className="text-[11px] text-muted">{projectCount}</span>}
      </button>

      {hasProject && (
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="max-w-[180px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-white outline-none hover:border-edge focus:border-accent focus:bg-surface2"
          title="Project name"
          aria-label="Project name"
        />
      )}

      <div className="mx-1 h-6 w-px bg-edge" />

      <button className="btn" onClick={() => videoInput.current?.click()}>
        <UploadIcon /> Upload
      </button>
      <input
        ref={videoInput}
        type="file"
        accept="video/*,audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />

      <select
        value={language}
        onChange={(e) => onLanguage(e.target.value)}
        className="select w-auto"
        title="Spoken language"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>

      <button
        className="btn btn-primary"
        onClick={onTranscribe}
        disabled={!hasVideo || busy}
      >
        {busy ? "Working…" : "✨ Auto-transcribe"}
      </button>

      <button className="btn" onClick={onLoadSample} disabled={busy}>
        Sample
      </button>

      <div className="mx-1 h-6 w-px bg-edge" />

      <button
        className="btn px-2.5"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 3 3 6.5 6.5 10" />
          <path d="M3 6.5h6a4 4 0 0 1 0 8H7" />
        </svg>
      </button>
      <button
        className="btn px-2.5"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 3 13 6.5 9.5 10" />
          <path d="M13 6.5H7a4 4 0 0 0 0 8h2" />
        </svg>
      </button>

      <div className="mx-1 h-6 w-px bg-edge" />

      <button className="btn" onClick={() => srtInput.current?.click()}>
        Import SRT
      </button>
      <input
        ref={srtInput}
        type="file"
        accept=".srt,text/plain"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onImportSrt(await f.text());
          e.target.value = "";
        }}
      />
      <button className="btn" onClick={onExportSrt} disabled={!hasCues}>
        Export SRT
      </button>

      <span className="ml-auto max-w-[40%] truncate text-xs text-muted" title={status}>
        {status}
      </span>
    </header>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10.5V2.5M8 2.5 5 5.5M8 2.5l3 3M2.5 11v1.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V11" />
    </svg>
  );
}
