# CutPilot Web — Phase 1

Upload a video → auto-transcribe → style animated captions → preview them live,
exactly as they'll export. This repo is **Phase 1** of [`WEBSAASPLAN.md`](./WEBSAASPLAN.md):
the editor MVP. Transcription is a **stub** for now; GPU transcription, server
burn-in export, accounts, and billing are later phases.

## What's here

| Area | Status |
| --- | --- |
| Caption engine (`src/engine`) | ✅ SRT parse/serialize, word splitting, regroup, animation timing, keyword highlight, **Hinglish** romanization, canvas renderer |
| Live preview | ✅ `<canvas>` overlaid on `<video>`, driven by the same `renderFrame` the export worker will use |
| Editable transcript | ✅ edit text, split, merge, delete, click-to-seek |
| Style panel | ✅ presets, animation, fonts, colors, position, words/cue, outline, shadow, background |
| Transcription | ✅ provider-agnostic: **Deepgram** (real word-level ASR) when `DEEPGRAM_API_KEY` is set, else a built-in **stub** sample — same `/api/transcribe` contract either way |
| Export (burn-in MP4) | ⛔ Phase 3 |
| Auth / billing | ⛔ Phases 4–5 |

## The engine is the moat

`src/engine` is pure, framework-agnostic TypeScript with **no DOM dependency**,
so the *same* code runs in the browser (live preview) and later on the server
(final render). That's the "preview === export" guarantee. `renderFrame` is
written against the standard `CanvasRenderingContext2D` API, so a server worker
can drive it with `node-canvas` / `skia-canvas` unchanged.

```
src/engine/
  types.ts      # shared Cue / CaptionStyle JSON schema (Phase 0 lock)
  captions.ts   # SRT parse/serialize, words, regroup, active-cue, highlight
  render.ts     # canvas renderer (browser + server)
  romanize.ts   # Devanagari → Latin (Hinglish)
  presets.ts    # style preset catalog
```

## Run it

```bash
npm install
npm run dev      # http://localhost:3000  → redirects to /editor
```

Then: **Upload video** → **Auto-transcribe** (stub) → edit the transcript →
pick a preset / tweak the style → scrub the preview.

No video handy? Click **Import SRT** with any `.srt` file, or transcribe with
language set to **Hindi → Hinglish** to see Devanagari romanized.

## Real transcription (Phase 2)

With no key configured, `/api/transcribe` serves a stub sample transcript so the
editor works out of the box. Set a key to switch to real, word-level ASR — the
client and engine don't change (`captions.js` re-groups the provider's true word
timestamps into cues, so karaoke sync is exact):

```bash
cp .env.example .env.local
# edit .env.local:
DEEPGRAM_API_KEY=dg_xxx        # https://console.deepgram.com/
# DEEPGRAM_MODEL=nova-2        # optional
```

Architecture (`src/server/transcription`): a `Provider` interface with pluggable
backends — `stub` (default) and `deepgram` (real). Adding AssemblyAI or
self-hosted WhisperX (plan §4.3) is a new file implementing the same interface;
`parse.ts` already includes (unit-tested) parsers for Deepgram and AssemblyAI.
`GET /api/transcribe` reports which backend is active so the UI uploads media
only when a real provider needs it.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, tests, and build on every push
to `main` and every PR.

## Develop

```bash
npm run dev        # Next.js dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest — engine unit tests
```

## Next phases (see WEBSAASPLAN.md)

- **Phase 2** — ✅ real ASR behind `/api/transcribe` (Deepgram). Next: queue +
  progress for long videos, audio extraction, more backends (AssemblyAI/WhisperX).
- **Phase 3** — server render worker: run `renderFrame` headless + ffmpeg
  burn-in → MP4.
- **Phase 4–5** — accounts, projects, storage lifecycle, Stripe + credits.
