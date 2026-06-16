import type { Provider, ProviderId, TimedWords, TranscribeAudioInput } from "./types";
import { deepgramConfigured, transcribeDeepgram } from "./deepgram";
import { assemblyaiConfigured, transcribeAssemblyai } from "./assemblyai";

export * from "./types";
export { buildStubSrt } from "./stub";
export { transcribeDeepgram, deepgramConfigured } from "./deepgram";
export { transcribeAssemblyai, assemblyaiConfigured } from "./assemblyai";
export { parseDeepgramWords, parseAssemblyaiWords } from "./parse";

/**
 * Resolve which transcription backend is active, based on configured secrets.
 * Priority: Deepgram → AssemblyAI → stub. Defaults to the stub so the app works
 * with zero setup (WEBSAASPLAN.md §4.3).
 */
export function activeProvider(): Provider {
  if (deepgramConfigured()) {
    return { id: "deepgram", label: "Deepgram", ready: true, needsMedia: true };
  }
  if (assemblyaiConfigured()) {
    return { id: "assemblyai", label: "AssemblyAI", ready: true, needsMedia: true };
  }
  return { id: "stub", label: "Sample (stub)", ready: true, needsMedia: false };
}

export function activeProviderId(): ProviderId {
  return activeProvider().id;
}

/** Run media-based transcription with whichever real provider is configured. */
export function transcribeMedia(input: TranscribeAudioInput): Promise<TimedWords> {
  if (deepgramConfigured()) return transcribeDeepgram(input);
  if (assemblyaiConfigured()) return transcribeAssemblyai(input);
  return Promise.reject(new Error("No media transcription provider configured"));
}
