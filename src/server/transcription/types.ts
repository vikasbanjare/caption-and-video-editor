import type { Cue, Word } from "@/engine";

/**
 * Phase 2 transcription contract (WEBSAASPLAN.md §4.3). The engine stays the
 * source of truth for caption shape, so a provider's job is simply: audio in →
 * word-timed {@link Cue}s out. Swapping Deepgram for AssemblyAI / WhisperX is a
 * new file implementing this interface, nothing else changes.
 */

export type ProviderId = "stub" | "deepgram";

export interface TranscriptionResult {
  cues: Cue[];
  language: string;
  provider: ProviderId;
}

export interface TranscribeAudioInput {
  /** raw media bytes (audio or a video container the provider can decode) */
  bytes: ArrayBuffer;
  /** MIME type, e.g. "video/mp4" */
  contentType: string;
  /** BCP-47-ish language hint, e.g. "en", "hi" */
  language: string;
}

export interface TranscribeStubInput {
  durationSeconds: number;
  language: string;
}

export interface Provider {
  id: ProviderId;
  /** human label for the UI/status */
  label: string;
  /** true when this provider can actually run (e.g. API key present) */
  ready: boolean;
  /** does this provider need the media bytes uploaded, or only metadata? */
  needsMedia: boolean;
}

/** A flat, word-timed transcript before it's wrapped into cues. */
export type TimedWords = Word[];
