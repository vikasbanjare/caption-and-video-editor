"use client";

import { useRef, useState } from "react";
import { timeAgo, type ProjectRecord } from "@/lib/store";
import { fmtClock } from "@/lib/transcript";

interface Props {
  projects: ProjectRecord[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: (file: File) => void;
}

/**
 * The Ingest stage — a professional project console (a dark project manager,
 * in the register of DaVinci's Project Manager), NOT a marketing landing.
 */
export default function ProjectConsole({
  projects,
  currentId,
  onOpen,
  onDelete,
  onNew,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const pick = () => input.current?.click();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onNew(f);
      }}
      className={`scroll-thin h-full overflow-y-auto ${drag ? "bg-accent/[0.03]" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-6 flex items-end justify-between border-b border-edge pb-4">
          <div>
            <div className="eyebrow">Project console</div>
            <h1 className="mt-1.5 font-display text-2xl font-semibold">
              Projects{" "}
              <span className="font-sans text-lg font-normal text-muted">
                {projects.length}
              </span>
            </h1>
          </div>
          <button className="btn btn-primary" onClick={pick}>
            <PlusIcon /> New from media
          </button>
          <input
            ref={input}
            type="file"
            accept="video/*,audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onNew(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {/* new / drop tile */}
          <button
            onClick={pick}
            className={`flex aspect-video flex-col items-center justify-center gap-2 rounded border border-dashed transition-colors ${
              drag ? "border-accent bg-accent/5" : "border-edge2 hover:border-accent"
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent text-white">
              <UploadIcon />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-label text-muted">
              Drop media · or click
            </span>
          </button>

          {projects.map((p) => (
            <div
              key={p.id}
              className={`group relative overflow-hidden rounded border bg-surface transition-colors ${
                p.id === currentId ? "border-accent" : "border-edge hover:border-edge2"
              }`}
            >
              <button onClick={() => onOpen(p.id)} className="block w-full text-left">
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-black">
                  {p.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-label text-white/25">
                      no frame
                    </span>
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <div className="truncate text-sm font-medium text-ink">{p.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted">
                    <span>{fmtClock(p.duration || 0)}</span>
                    <span className="text-edge2">·</span>
                    <span>{(p.cues || []).length} cues</span>
                    <span className="text-edge2">·</span>
                    <span>{timeAgo(p.updatedAt)}</span>
                  </div>
                </div>
              </button>
              <button
                onClick={() => onDelete(p.id)}
                title="Delete project"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-sm bg-black/60 text-white/70 opacity-0 transition-opacity hover:bg-black/80 hover:text-white group-hover:opacity-100"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <p className="mt-6 max-w-md font-mono text-[11px] leading-relaxed text-muted">
            No projects yet. Drop a video or audio file to start — it&apos;s
            transcribed and edited entirely on your machine, then saved here in
            your browser.
          </p>
        )}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V3M8 3 4.5 6.5M8 3l3.5 3.5M3 11.5V13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13v-1.5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M1.5 3h9M4.5 3V1.8h3V3M2.7 3l.6 7h5.4l.6-7" />
    </svg>
  );
}
