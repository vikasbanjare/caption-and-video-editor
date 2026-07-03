"use client";

import { useEffect, useRef } from "react";
import type { Cue } from "@/engine";
import { fmtClock } from "@/lib/transcript";

interface Props {
  cues: Cue[];
  activeId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
  onEditText: (id: string, text: string) => void;
  onSplit: (id: string) => void;
  onMerge: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Editable transcript — fix words, split, merge, delete, click to seek. */
export default function TranscriptPanel({
  cues,
  activeId,
  selectedId,
  onSelect,
  onSeek,
  onEditText,
  onSplit,
  onMerge,
  onDelete,
}: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  if (cues.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="text-2xl opacity-40">✍️</div>
        <p className="text-sm text-muted">No transcript yet</p>
        <p className="text-xs text-muted/70">
          Hit <span className="text-slate-300">Auto-transcribe</span> or import an
          SRT, then edit any word here.
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto p-2.5">
      {cues.map((c, i) => {
        const active = c.id === activeId;
        const selected = c.id === selectedId;
        return (
          <div
            key={c.id}
            ref={active ? activeRef : undefined}
            onClick={() => onSelect(c.id)}
            className={`group mb-2 rounded-xl border p-2.5 transition-all ${
              active
                ? "border-accent/60 bg-accent/10"
                : "border-edge bg-surface2 hover:border-edge2"
            } ${selected ? "ring-1 ring-accent/70" : ""}`}
          >
            <div className="mb-1 flex items-center justify-between">
              <button
                onClick={() => onSeek(c.start)}
                className="font-mono text-[11px] text-accent2 hover:underline"
                title="Seek to this cue"
              >
                {fmtClock(c.start)} → {fmtClock(c.end)}
              </button>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <IconBtn label="Split" onClick={() => onSplit(c.id)}>
                  ⊟
                </IconBtn>
                <IconBtn
                  label="Merge with next"
                  onClick={() => onMerge(c.id)}
                  disabled={i >= cues.length - 1}
                >
                  ⊞
                </IconBtn>
                <IconBtn label="Delete" onClick={() => onDelete(c.id)}>
                  ✕
                </IconBtn>
              </div>
            </div>
            <textarea
              value={c.text}
              onChange={(e) => onEditText(c.id, e.target.value)}
              rows={Math.max(1, Math.ceil(c.text.length / 30))}
              className="w-full resize-none rounded-lg bg-transparent text-sm leading-snug text-slate-100 outline-none focus:bg-black/20"
              spellCheck={false}
            />
          </div>
        );
      })}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        // don't bubble into the row's select handler — after a delete/split
        // that would re-select a cue id that no longer exists
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-md text-xs text-muted hover:bg-surface3 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
