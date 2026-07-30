import type { Chapter } from "./tools";

/**
 * NLE timeline interchange. OpenTimelineIO (.otio) is imported natively by
 * DaVinci Resolve (18.5+) and Premiere Pro (2025+), so it carries the project's
 * edit + chapter markers into both. A Resolve/Premiere marker CSV covers
 * chapters for older versions. Pair with the .ass export (captions) + .srt.
 */

function pad(n: number, w = 2): string {
  let s = String(Math.floor(Math.abs(n)));
  while (s.length < w) s = "0" + s;
  return s;
}

/** seconds → SMPTE timecode HH:MM:SS:FF at the given fps. */
export function smpte(sec: number, fps = 30): string {
  const t = Math.max(0, sec);
  const totalFrames = Math.round(t * fps);
  const f = totalFrames % fps;
  const s = Math.floor(totalFrames / fps) % 60;
  const m = Math.floor(totalFrames / (fps * 60)) % 60;
  const h = Math.floor(totalFrames / (fps * 3600));
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

const rt = (value: number, rate: number) => ({
  OTIO_SCHEMA: "RationalTime.1",
  rate,
  value: Math.round(value),
});

export interface OtioOptions {
  name?: string;
  mediaName?: string;
  durationSec: number;
  fps?: number;
  chapters?: Chapter[];
}

/** Build an OpenTimelineIO document (one video clip + chapter markers). */
export function buildOtio(opts: OtioOptions): string {
  const fps = opts.fps || 30;
  const name = opts.name || "Pulse Timeline";
  const media = opts.mediaName || "clip.mp4";
  const durFrames = Math.max(1, Math.round((opts.durationSec || 1) * fps));

  const markers = (opts.chapters || []).map((c) => ({
    OTIO_SCHEMA: "Marker.2",
    name: c.title || "Chapter",
    color: "CYAN",
    marked_range: {
      OTIO_SCHEMA: "TimeRange.1",
      start_time: rt(c.start * fps, fps),
      duration: rt(0, fps),
    },
    metadata: {},
  }));

  const clip = {
    OTIO_SCHEMA: "Clip.2",
    name: media,
    source_range: {
      OTIO_SCHEMA: "TimeRange.1",
      start_time: rt(0, fps),
      duration: rt(durFrames, fps),
    },
    media_reference: {
      OTIO_SCHEMA: "ExternalReference.1",
      target_url: media,
      available_range: {
        OTIO_SCHEMA: "TimeRange.1",
        start_time: rt(0, fps),
        duration: rt(durFrames, fps),
      },
    },
    markers,
    effects: [],
    metadata: {},
  };

  const timeline = {
    OTIO_SCHEMA: "Timeline.1",
    name,
    global_start_time: rt(0, fps),
    tracks: {
      OTIO_SCHEMA: "Stack.1",
      name: "tracks",
      children: [
        {
          OTIO_SCHEMA: "Track.1",
          name: "V1",
          kind: "Video",
          children: [clip],
          markers: [],
          effects: [],
          metadata: {},
        },
      ],
      markers: [],
      effects: [],
      metadata: {},
    },
    metadata: { generator: "Pulse" },
  };

  return JSON.stringify(timeline, null, 2);
}

/**
 * DaVinci Resolve / Premiere marker CSV (chapters). Columns match Resolve's
 * timeline-marker import; Premiere reads the same shape.
 */
export function buildMarkerCsv(chapters: Chapter[], fps = 30): string {
  const rows = ["Timecode In,Timecode Out,Name,Comment,Color"];
  for (const c of chapters || []) {
    const tc = smpte(c.start, fps);
    const title = `"${(c.title || "Chapter").replace(/"/g, '""')}"`;
    rows.push(`${tc},${tc},${title},"Chapter",Cyan`);
  }
  return rows.join("\r\n") + "\r\n";
}
