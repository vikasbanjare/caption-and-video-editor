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
| Transcription | 🟡 **stub** at `POST /api/transcribe` (returns a sample transcript) — swap for WhisperX / commercial ASR in Phase 2 |
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

## Develop

```bash
npm run dev        # Next.js dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest — engine unit tests
```

## Next phases (see WEBSAASPLAN.md)

- **Phase 2** — replace `/api/transcribe` with a queued WhisperX / commercial
  ASR job returning word-level cues.
- **Phase 3** — server render worker: run `renderFrame` headless + ffmpeg
  burn-in → MP4.
- **Phase 4–5** — accounts, projects, storage lifecycle, Stripe + credits.
