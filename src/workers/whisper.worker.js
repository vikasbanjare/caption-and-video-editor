/* eslint-disable */
// Web Worker: real speech-to-text in the browser via Whisper (transformers.js).
// Runs entirely client-side — no server, no API key — so it works even on the
// static GitHub Pages build. transformers.js is loaded from a CDN at runtime
// (webpackIgnore) so it isn't bundled; it fetches the model + wasm itself and
// the browser caches them after the first run.

const TRANSFORMERS_CDN =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

let lib = null;
let asr = null;
let currentModel = "";

async function getLib() {
  if (!lib) {
    lib = await import(/* webpackIgnore: true */ TRANSFORMERS_CDN);
    lib.env.allowLocalModels = false;
  }
  return lib;
}

async function getPipe(model) {
  const { pipeline } = await getLib();
  if (asr && currentModel === model) return asr;
  asr = await pipeline("automatic-speech-recognition", model, {
    progress_callback: (p) => self.postMessage({ type: "progress", data: p }),
  });
  currentModel = model;
  return asr;
}

self.addEventListener("message", async (e) => {
  const { audio, language, model } = e.data;
  try {
    const pipe = await getPipe(model);
    self.postMessage({ type: "status", phase: "transcribing" });

    const output = await pipe(audio, {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      language: language && language !== "auto" ? language : null,
    });

    const chunks = Array.isArray(output.chunks) ? output.chunks : [];
    const words = chunks
      .filter((c) => Array.isArray(c.timestamp))
      .map((c) => ({
        text: String(c.text || "").trim(),
        start: c.timestamp[0] ?? 0,
        end: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 0.3,
      }))
      .filter((w) => w.text);

    self.postMessage({ type: "result", words, text: output.text || "" });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: (err && err.message) || String(err),
    });
  }
});
