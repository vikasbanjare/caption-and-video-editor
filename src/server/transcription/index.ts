import type { Provider, ProviderId } from "./types";
import { deepgramConfigured } from "./deepgram";

export * from "./types";
export { buildStubSrt } from "./stub";
export { transcribeDeepgram, deepgramConfigured } from "./deepgram";
export { parseDeepgramWords, parseAssemblyaiWords } from "./parse";

/**
 * Resolve which transcription backend is active, based on configured secrets.
 * Defaults to the stub so the app works with zero setup; set DEEPGRAM_API_KEY
 * to switch to real ASR (WEBSAASPLAN.md §4.3).
 */
export function activeProvider(): Provider {
  if (deepgramConfigured()) {
    return {
      id: "deepgram",
      label: "Deepgram",
      ready: true,
      needsMedia: true,
    };
  }
  return {
    id: "stub",
    label: "Sample (stub)",
    ready: true,
    needsMedia: false,
  };
}

export function activeProviderId(): ProviderId {
  return activeProvider().id;
}
