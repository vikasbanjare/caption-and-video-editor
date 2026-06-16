"use client";

import { useRef } from "react";

interface Props {
  hasVideo: boolean;
  hasCues: boolean;
  busy: boolean;
  language: string;
  status: string;
  onUpload: (file: File) => void;
  onImportSrt: (text: string) => void;
  onTranscribe: () => void;
  onExportSrt: () => void;
  onLanguage: (lang: string) => void;
}

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi → Hinglish" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
];

/** Top action bar: upload, transcribe (stub), import/export SRT, language. */
export default function Toolbar({
  hasVideo,
  hasCues,
  busy,
  language,
  status,
  onUpload,
  onImportSrt,
  onTranscribe,
  onExportSrt,
  onLanguage,
}: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const srtInput = useRef<HTMLInputElement>(null);

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-edge bg-panel px-4 py-2">
      <div className="mr-2 flex items-center gap-2">
        <span className="text-lg">🎬</span>
        <span className="font-semibold text-white">CutPilot</span>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
          Phase 1
        </span>
      </div>

      <button className="btn" onClick={() => videoInput.current?.click()}>
        ⬆ Upload video
      </button>
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
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
        title="Transcription language"
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
        {busy ? "Transcribing…" : "✨ Auto-transcribe"}
      </button>

      <button className="btn" onClick={() => srtInput.current?.click()}>
        ⤓ Import SRT
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
        ⤒ Export SRT
      </button>

      <span className="ml-auto truncate text-xs text-slate-400" title={status}>
        {status}
      </span>
    </header>
  );
}
