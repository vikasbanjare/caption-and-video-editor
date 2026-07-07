"use client";

import type { ProjectNote } from "@/lib/store";
import { fmtClock } from "@/lib/transcript";

interface Props {
  notes: ProjectNote[];
  noteMode: boolean;
  onToggleMode: () => void;
  onSeek: (t: number) => void;
  onEdit: (id: string, body: string) => void;
  onToggleResolved: (id: string) => void;
  onDelete: (id: string) => void;
  onAddAtPlayhead: () => void;
}

/**
 * Frame-notes list — ported from Daxio's review comments/pins, single-user.
 * Notes are pinned to a timestamp (and optionally an x/y point on the frame,
 * dropped by clicking the video in "note mode").
 */
export default function NotesPanel({
  notes,
  noteMode,
  onToggleMode,
  onSeek,
  onEdit,
  onToggleResolved,
  onDelete,
  onAddAtPlayhead,
}: Props) {
  const sorted = [...notes].sort((a, b) => a.t - b.t);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <button
          onClick={onToggleMode}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
            noteMode
              ? "border-accent bg-accent text-white"
              : "border-edge bg-surface2 text-ink hover:border-edge2"
          }`}
          title="Click the video to drop a note pin"
        >
          <PinIcon /> {noteMode ? "Click the video…" : "Pin on frame"}
        </button>
        <button
          onClick={onAddAtPlayhead}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-edge bg-surface2 px-2.5 text-xs font-medium text-ink hover:border-edge2"
          title="Add a note at the current time"
        >
          ＋ At playhead
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2.5">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="text-2xl opacity-40">📌</div>
            <p className="text-sm text-muted">No notes yet</p>
            <p className="text-xs text-muted/70">
              Pin feedback to a moment — great for planning caption fixes.
            </p>
          </div>
        ) : (
          sorted.map((n) => (
            <div
              key={n.id}
              className={`group mb-2 rounded-xl border p-2.5 transition-all ${
                n.resolved
                  ? "border-edge/60 bg-surface2/40 opacity-70"
                  : "border-edge bg-surface2 hover:border-edge2"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={() => onSeek(n.t)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-accent2 hover:underline"
                  title="Seek to this note"
                >
                  {n.x !== null && <PinIcon small />}
                  {fmtClock(n.t)}
                </button>
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onToggleResolved(n.id)}
                    title={n.resolved ? "Reopen" : "Resolve"}
                    aria-label="Toggle resolved"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-xs text-muted hover:bg-surface3 hover:text-good"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => onDelete(n.id)}
                    title="Delete note"
                    aria-label="Delete note"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-xs text-muted hover:bg-surface3 hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <textarea
                value={n.body}
                onChange={(e) => onEdit(n.id, e.target.value)}
                rows={Math.max(1, Math.ceil((n.body.length || 1) / 30))}
                placeholder="Write a note…"
                className="w-full resize-none rounded-lg bg-transparent text-sm leading-snug text-ink outline-none placeholder:text-muted/60 focus:bg-surface2"
                spellCheck={false}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PinIcon({ small }: { small?: boolean }) {
  const s = small ? 10 : 13;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
    </svg>
  );
}
