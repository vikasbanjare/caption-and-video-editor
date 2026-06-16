"use client";

import { useEffect, useRef } from "react";
import type { Cue } from "@/engine";
import { fmtClock } from "@/lib/transcript";

interface Props {
  cues: Cue[];
  activeId: string | null;
  onSeek: (t: number) => void;
  onEditText: (id: string, text: string) => void;
  onSplit: (id: string) => void;
  onMerge: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Editable transcript (WEBSAASPLAN.md §4.1) — fix words inline, split, merge,
 * delete, and click a timecode to seek the preview. This is the quality lever
 * that closes the gap with competitors even when ASR isn't perfect.
 */
export default function TranscriptPanel({
  cues,
  activeId,
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
      <div className="p-4 text-sm text-slate-500">
        No transcript yet. Use <span className="text-slate-300">Auto-transcribe</span>{" "}
        or <span className="text-slate-300">Import SRT</span> to get started.
      </div>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto p-2">
      {cues.map((c, i) => {
        const active = c.id === activeId;
        return (
          <div
            key={c.id}
            ref={active ? activeRef : undefined}
            className={`mb-2 rounded-md border p-2 transition-colors ${
              active
                ? "border-accent/60 bg-accent/10"
                : "border-edge bg-panel2 hover:border-edge/80"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <button
                onClick={() => onSeek(c.start)}
                className="font-mono text-[11px] text-accent hover:underline"
                title="Seek preview to this cue"
              >
                {fmtClock(c.start)} → {fmtClock(c.end)}
              </button>
              <div className="flex items-center gap-1">
                <IconBtn label="Split cue" onClick={() => onSplit(c.id)}>
                  ⊟
                </IconBtn>
                <IconBtn
                  label="Merge with next"
                  onClick={() => onMerge(c.id)}
                  disabled={i >= cues.length - 1}
                >
                  ⊞
                </IconBtn>
                <IconBtn label="Delete cue" onClick={() => onDelete(c.id)}>
                  ✕
                </IconBtn>
              </div>
            </div>
            <textarea
              value={c.text}
              onChange={(e) => onEditText(c.id, e.target.value)}
              rows={Math.max(1, Math.ceil(c.text.length / 36))}
              className="w-full resize-none rounded bg-transparent text-sm leading-snug text-slate-100 outline-none focus:bg-black/20"
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
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded text-xs text-slate-400 hover:bg-black/30 hover:text-slate-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
