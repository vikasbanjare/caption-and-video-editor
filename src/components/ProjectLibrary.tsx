"use client";

import type { ProjectRecord } from "@/lib/store";
import { timeAgo } from "@/lib/store";

interface Props {
  projects: ProjectRecord[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

/** "My Projects" gallery — ported from Daxio's library grid, adapted for
 *  caption projects. Everything is stored locally in the browser. */
export default function ProjectLibrary({
  projects,
  currentId,
  onOpen,
  onDelete,
  onNew,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            My Projects
          </h2>
          <p className="text-xs text-muted">
            Saved in this browser · {projects.length}{" "}
            {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>
        <button className="btn" onClick={onClose} aria-label="Close">
          ✕ Close
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <button
            onClick={onNew}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-edge2 bg-surface/40 text-muted transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent2"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-sm font-medium">New project</span>
          </button>

          {projects.map((p) => (
            <div
              key={p.id}
              className={`group relative overflow-hidden rounded-lg border bg-surface text-left transition-all hover:-translate-y-0.5 ${
                p.id === currentId ? "border-accent ring-1 ring-accent/50" : "border-edge hover:border-edge2"
              }`}
            >
              <button
                onClick={() => onOpen(p.id)}
                className="block w-full text-left"
                title={`Open “${p.title}”`}
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
                  {p.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumb}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="text-3xl opacity-40">🎬</div>
                  )}
                  {p.id === currentId && (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                      Open
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white/90">
                    {p.cues.length} cues
                  </span>
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    {p.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                    <span>{timeAgo(p.updatedAt)}</span>
                    {p.notes.length > 0 && (
                      <>
                        <span className="opacity-40">·</span>
                        <span>
                          {p.notes.length} {p.notes.length === 1 ? "note" : "notes"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  if (confirm(`Delete “${p.title}”? This can't be undone.`)) {
                    onDelete(p.id);
                  }
                }}
                title="Delete project"
                aria-label="Delete project"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white/80 opacity-0 transition-opacity hover:bg-danger hover:text-white group-hover:opacity-100"
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M1.5 3h9M4.5 3V1.8h3V3M2.7 3l.6 7h5.4l.6-7" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">
            No saved projects yet — start one and it&apos;ll appear here automatically.
          </p>
        )}
      </div>
    </div>
  );
}
