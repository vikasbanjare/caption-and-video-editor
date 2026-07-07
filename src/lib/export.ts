import { renderFrame, activeCueAt, type Cue, type CaptionStyle } from "@/engine";

/**
 * Burn captions into a downloadable video, entirely in the browser.
 *
 * Each frame we draw the source video, then overlay the caption canvas using
 * the *same* render engine that powers the live preview (so preview === export).
 * The composite canvas is captured with `captureStream` and recorded with
 * `MediaRecorder`; the source audio is routed through WebAudio into the same
 * stream. No server, no ffmpeg. It records in real time.
 *
 * Output is MP4 where the browser's MediaRecorder supports it (Safari), else
 * WebM (Chrome/Firefox) — both are real, shareable video files.
 */

export interface ExportOptions {
  videoUrl: string;
  cues: Cue[];
  style: CaptionStyle;
  /** total duration in seconds (used to stop; robust to webm Infinity-duration) */
  duration: number;
  /** CSS/canvas filter string for the color grade (applied to the video frame) */
  filter?: string;
  fps?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
  mime: string;
}

export function isExportSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder !==
      "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function pickMime(): string {
  const MR = window.MediaRecorder;
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MR.isTypeSupported?.(c)) return c;
  }
  return "video/webm";
}

export async function exportBurnIn({
  videoUrl,
  cues,
  style,
  duration,
  filter,
  fps = 30,
  onProgress,
  signal,
}: ExportOptions): Promise<ExportResult> {
  if (!isExportSupported()) {
    throw new Error("This browser can't record video (needs MediaRecorder + canvas capture).");
  }

  // --- source video (own element so we control playback/audio) ---------------
  const video = document.createElement("video");
  video.src = videoUrl;
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = false;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not load the source video for export."));
  });

  const W = video.videoWidth || 1080;
  const H = video.videoHeight || 1920;

  // composite canvas (recorded) + transparent caption canvas (overlay)
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const capCanvas = document.createElement("canvas");
  capCanvas.width = W;
  capCanvas.height = H;
  const capCtx = capCanvas.getContext("2d");
  if (!ctx || !capCtx) throw new Error("Canvas 2D context unavailable.");

  // --- audio: route the source into the recorded stream ----------------------
  let audioCtx: AudioContext | null = null;
  let audioTracks: MediaStreamTrack[] = [];
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AC) {
      audioCtx = new AC();
      const srcNode = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      srcNode.connect(dest); // into the file only (not to speakers)
      audioTracks = dest.stream.getAudioTracks();
    }
  } catch {
    // no audio track (e.g. canvas-generated clip) — export video only
    audioTracks = [];
  }

  const canvasStream = canvas.captureStream(fps);
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks,
  ]);

  const mime = pickMime();
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((res) => {
    rec.onstop = () => res();
  });

  // stop cleanly on demand or when we reach the end
  let rafId = 0;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    if (rec.state !== "inactive") rec.stop();
  };

  signal?.addEventListener("abort", finish, { once: true });

  const endT = duration > 0 && isFinite(duration) ? duration : Infinity;

  const draw = () => {
    if (finished) return;
    // grade the video frame (captions stay ungraded — drawn after filter reset)
    ctx.filter = filter && filter !== "none" ? filter : "none";
    ctx.drawImage(video, 0, 0, W, H);
    ctx.filter = "none";
    const t = video.currentTime;
    const cue = activeCueAt(cues, t);
    renderFrame({ ctx: capCtx, cue, style, time: t, width: W, height: H });
    ctx.drawImage(capCanvas, 0, 0);
    if (onProgress && endT !== Infinity) onProgress(Math.min(1, t / endT));
    if (video.ended || (endT !== Infinity && t >= endT - 0.02)) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(draw);
  };

  video.currentTime = 0;
  rec.start();
  try {
    await video.play();
    if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
  } catch (err) {
    finish();
    throw new Error("Playback was blocked — click Export again.");
  }
  video.onended = finish;
  rafId = requestAnimationFrame(draw);

  await stopped;
  if (audioCtx) await audioCtx.close().catch(() => {});

  const ext: "mp4" | "webm" = mime.includes("mp4") ? "mp4" : "webm";
  return { blob: new Blob(chunks, { type: mime }), ext, mime };
}

/** Trigger a browser download for a produced blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
