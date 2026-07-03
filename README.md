# CutPilot — AI Caption Studio

Upload a video → **real Whisper transcription in your browser** → perfect the
timing on a **full editing timeline** → style animated captions with premium
templates, previewed live exactly as they'll export.

**Live demo:** https://vikasbanjare.github.io/caption-and-video-editor/

This repo implements Phases 1–2 of [`WEBSAASPLAN.md`](./WEBSAASPLAN.md); server
burn-in export, accounts, and billing are later phases.

## What's here

| Area | Status |
| --- | --- |
| Transcription | ✅ **Whisper runs in your browser** (transformers.js in a Web Worker — no server, no API key, word-level timestamps). Server-side Deepgram/AssemblyAI also supported via `DEEPGRAM_API_KEY` / `ASSEMBLYAI_API_KEY`. |
| Editing timeline | ✅ time ruler, **audio waveform**, caption blocks — drag to move, drag edges to trim (snapping + non-overlap clamps), split at playhead, insert caption, click-to-seek scrubbing, zoom (buttons / ctrl+wheel), playback autoscroll |
| Undo / redo | ✅ full history for every edit (toolbar buttons + Ctrl+Z / Ctrl+Shift+Z), text edits coalesced |
| Keyboard shortcuts | ✅ Space play/pause · S split at playhead · Delete remove selected · ←/→ nudge (Shift = 1s) |
| Caption engine (`src/engine`) | ✅ SRT parse/serialize, word timing, regroup, animations (pop/bounce/karaoke/word-by-word/slide/fade), keyword highlight, **Hinglish** romanization, canvas renderer |
| Templates | ✅ 9 premium presets (Hormozi boxed-keyword, Beasty, Karaoke, Neon glow, Pop Pink, Bebas, TikTok, Clean, Subtitle) rendered live in a visual gallery |
| Editable transcript | ✅ edit text, split, merge, delete, select, click-to-seek — synced with the timeline |
| Live preview | ✅ `<canvas>` overlaid on `<video>`, driven by the same `renderFrame` the export worker will use |
| Export SRT | ✅ · Export burned-in MP4 | ⛔ Phase 3 |
| Auth / billing | ⛔ Phases 4–5 |

## The engine is the moat

`src/engine` is pure, framework-agnostic TypeScript with **no DOM dependency**,
so the *same* code runs in the browser (live preview) and later on the server
(final render). That's the "preview === export" guarantee. `renderFrame` is
written against the standard `CanvasRenderingContext2D` API, so a server worker
can drive it with `node-canvas` / `skia-canvas` unchanged.

```
src/engine/          # pure caption engine (browser + server)
src/components/      # editor UI: Toolbar, VideoStage, Timeline, panels
src/lib/transcript.ts        # cue edit ops (retime/split/merge/insert) — word-timing preserving
src/lib/transcribe-browser.ts# Web Audio decode → Whisper worker → word cues
src/workers/whisper.worker.js# transformers.js (CDN-loaded) speech recognition
src/server/transcription/    # optional server ASR providers (Deepgram/AssemblyAI/stub)
```

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

### …or in GitHub Codespaces (no local setup)

Open the repo → **Code ▸ Codespaces ▸ Create codespace**. The included
`.devcontainer` installs dependencies and starts `npm run dev` automatically.

Then: **Upload** a clip → **Auto-transcribe** (first run downloads the Whisper
model once) → fix words in the transcript → drag blocks on the timeline to
perfect timing → pick a template → **Export SRT**.

No video handy? **Sample** loads placeholder captions; **Import SRT** works too.
Set language to **Hindi → Hinglish** to see Devanagari romanized.

## Server-side transcription (optional)

The in-browser Whisper path needs nothing. For server-side ASR instead, set one
key — the UI and engine don't change:

```bash
cp .env.example .env.local
DEEPGRAM_API_KEY=dg_xxx          # https://console.deepgram.com/
# ASSEMBLYAI_API_KEY=aai_xxx     # https://www.assemblyai.com/
```

## CI / Deploy

- `.github/workflows/ci.yml` — typecheck, lint, tests, build on every PR/push.
- `.github/workflows/pages.yml` — deploys the static browser-only build to
  GitHub Pages (everything works there, including in-browser Whisper).

## Develop

```bash
npm run dev        # Next.js dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest — engine + editing-core unit tests
```

## Next phases (see WEBSAASPLAN.md)

- **Phase 3** — burn-in export → MP4 (client-side MediaRecorder first, then a
  server render worker: `renderFrame` headless + ffmpeg).
- **Phase 4–5** — accounts, projects, storage lifecycle, Stripe + credits.
