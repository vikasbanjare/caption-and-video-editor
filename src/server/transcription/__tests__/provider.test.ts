import { describe, it, expect, afterEach } from "vitest";
import { activeProvider } from "../index";

const KEYS = ["DEEPGRAM_API_KEY", "ASSEMBLYAI_API_KEY"];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("provider selection", () => {
  it("defaults to the stub (no media needed) with no keys", () => {
    expect(activeProvider()).toMatchObject({ id: "stub", needsMedia: false });
  });

  it("prefers Deepgram when both keys are set", () => {
    process.env.DEEPGRAM_API_KEY = "x";
    process.env.ASSEMBLYAI_API_KEY = "y";
    expect(activeProvider().id).toBe("deepgram");
  });

  it("uses AssemblyAI when only its key is set", () => {
    process.env.ASSEMBLYAI_API_KEY = "y";
    expect(activeProvider()).toMatchObject({ id: "assemblyai", needsMedia: true });
  });
});
