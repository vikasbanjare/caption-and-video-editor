import type { Word } from "@/engine";

/**
 * Real, in-browser speech-to-text. Decodes the uploaded media's audio with the
 * Web Audio API, then runs Whisper (transformers.js) in a Web Worker to produce
 * word-level timestamps — no server and no API key, so it works on the static
 * GitHub Pages build too. The model downloads once on first use and is cached.
 */

export interface TranscribeProgress {
  phase: "decoding" | "loading" | "transcribing";
  label: string;
  /** 0–100 during model download */
  percent?: number;
}

// whisper-base: multilingual (en/hi/es/fr…), a good accuracy/size balance.
const MODEL = "Xenova/whisper-base";

export async function transcribeInBrowser(
  file: File,
  language: string,
  onProgress: (p: TranscribeProgress) => void
): Promise<Word[]> {
  onProgress({ phase: "decoding", label: "Reading audio from your video…" });
  const audio = await decodeAudio(file);

  return new Promise<Word[]>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/whisper.worker.js", import.meta.url),
      { type: "module" }
    );
    const done = (fn: () => void) => {
      worker.terminate();
      fn();
    };

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerMessage;
      if (msg.type === "progress") {
        const d = msg.data || {};
        if (d.status === "progress" && typeof d.progress === "number") {
          onProgress({
            phase: "loading",
            label: `Downloading speech model… ${Math.round(d.progress)}%`,
            percent: d.progress,
          });
        } else if (d.status === "initiate" || d.status === "download") {
          onProgress({ phase: "loading", label: "Downloading speech model…" });
        }
      } else if (msg.type === "status" && msg.phase === "transcribing") {
        onProgress({ phase: "transcribing", label: "Transcribing your video…" });
      } else if (msg.type === "result") {
        done(() =>
          resolve(
            msg.words.map((w) => ({
              text: w.text,
              start: w.start,
              end: Math.max(w.start + 0.05, w.end),
            }))
          )
        );
      } else if (msg.type === "error") {
        done(() => reject(new Error(msg.message || "Transcription failed")));
      }
    };
    worker.onerror = (e) =>
      done(() => reject(new Error(e.message || "Speech worker failed to start")));

    worker.postMessage({ audio, language, model: MODEL }, [audio.buffer]);
  });
}

async function decodeAudio(file: File): Promise<Float32Array> {
  const arr = await file.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AC({ sampleRate: 16000 });
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arr);
  } catch {
    await ctx.close();
    throw new Error(
      "Couldn't read audio from this file. Try an MP4, MP3, WAV, or WEBM."
    );
  }
  // Mix down to mono (Whisper expects single-channel 16 kHz).
  const len = decoded.length;
  const out = new Float32Array(len);
  const chans = decoded.numberOfChannels;
  for (let c = 0; c < chans; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i] / chans;
  }
  await ctx.close();
  return out;
}

type WorkerMessage =
  | { type: "progress"; data: { status?: string; progress?: number } }
  | { type: "status"; phase: "transcribing" }
  | { type: "result"; words: Word[]; text: string }
  | { type: "error"; message: string };
