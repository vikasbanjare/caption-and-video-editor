# Pulse by AI-Floh — browser caption studio

Upload a video → **real Whisper transcription in your browser** → perfect the
timing on a **full editing timeline** → style animated captions with 111
templates, previewed live exactly as they export → **burn them in** and
download. Nothing leaves your machine.

**Live demo:** https://vikasbanjare.github.io/caption-and-video-editor/

This is the **web app** of the Pulse family. The Premiere Pro plugin (silence
removal, multicam auto-switch, captions, chapters) lives in
[`vikasbanjare/video`](https://github.com/vikasbanjare/video); this repo ports
its caption engine to the browser and implements Phases 1–2 of
[`WEBSAASPLAN.md`](./WEBSAASPLAN.md) (plus the client-side half of Phase 3).
Server-side rendering, accounts, and billing are later phases.

## What's here

| Area | Status |
| --- | --- |
| Transcription | ✅ **Whisper runs in your browser** (transformers.js in a Web Worker — no server, no API key, word-level timestamps). Server-side Deepgram/AssemblyAI also supported via `DEEPGRAM_API_KEY` / `ASSEMBLYAI_API_KEY`. |
| Editing timeline | ✅ time ruler, **audio waveform**, caption blocks — drag to move, drag edges to trim (snapping + non-overlap clamps), split at playhead, insert caption, click-to-seek scrubbing, zoom (buttons / ctrl+wheel), playback autoscroll |
| Undo / redo | ✅ full history for every edit (toolbar buttons + Ctrl+Z / Ctrl+Shift+Z), text edits coalesced |
| Keyboard shortcuts | ✅ Space play/pause · S split at playhead · Delete remove selected · ←/→ nudge (Shift = 1s) · `,` `.` frame-step |
| Caption engine (`src/engine`) | ✅ SRT parse/serialize, word timing, regroup, 18 animations (pop/bounce/karaoke/typewriter/glitch/wave/…), keyword highlight, **Hinglish** romanization (Devanagari *and* Urdu script), canvas renderer |
| Templates | ✅ **111 templates** — 97 ported 1:1 from the Pulse Premiere plugin plus the Flux and Titles packs — in a live-animated, filterable gallery, with a full Customize panel (type, fills, stroke stacks, glow, boxes, emphasis, animation, transform) |
| Editable transcript | ✅ edit text, split, merge, delete, select, click-to-seek — synced with the timeline |
| Live preview | ✅ `<canvas>` overlaid on `<video>`, driven by the same `renderFrame` the export uses — plus drag-to-move captions, safe-zone guides, frame notes |
| Export burned-in video | ✅ **in-browser burn-in export** (MediaRecorder, records in real time; MP4 where the browser supports it, else WebM) with the color grade, silence-cut, and optional audio enhancement baked in |
| Export for NLEs | ✅ .srt · styled **.ass** (word-karaoke) · **.otio** timeline · chapter-marker **.csv** — drop into DaVinci Resolve / Premiere Pro |
| Pulse tools | ✅ silence/dead-air detection (tightened export) · filler-word clean-up · auto-chapters · on-device analytics (clarity/hook/pace) · color grading · image background remover |
| Projects | ✅ local persistence (video in IndexedDB, records in localStorage), thumbnails, frame notes, light/dark themes |
| Server render / accounts / billing | ⛔ Phases 3 (server half) – 5 |

## The engine is the moat

`src/engine` is pure, framework-agnostic TypeScript with **no DOM dependency**,
so the *same* code runs in the browser (live preview) and later on the server
(final render). That's the "preview === export" guarantee. `renderFrame` is
written against the standard `CanvasRenderingContext2D` API, so a server worker
can drive it with `node-canvas` / `skia-canvas` unchanged.

```
src/engine/          # pure caption engine (browser + server)
src/components/      # editor UI: stage rooms, monitor, timeline, panels
src/lib/             # burn-in export, cue edit ops, silence, ASS/OTIO, persistence, analytics
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

Then walk the stage rail: **Ingest** a clip → **Script**: Auto-transcribe
(first run downloads the Whisper model once) and fix words → **Cut**: perfect
timing on the timeline → **Color**: grade the picture → **Type**: pick a
template and customize → **Export**: burn-in video, or hand .srt/.ass/.otio to
your NLE.

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

- **Phase 3 (server half)** — server render worker (`renderFrame` headless +
  ffmpeg) for faster-than-real-time, long-video export.
- **Phase 4–5** — accounts, projects, storage lifecycle, Stripe + credits.
