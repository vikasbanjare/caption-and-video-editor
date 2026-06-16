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

### …or in GitHub Codespaces (no local setup)

Open the repo → **Code ▸ Codespaces ▸ Create codespace**. The included
`.devcontainer` installs dependencies and starts `npm run dev` automatically;
when port 3000 forwards, open the preview. For real ASR, add a Codespaces secret
(`DEEPGRAM_API_KEY` or `ASSEMBLYAI_API_KEY`).

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
# edit .env.local — set ONE of:
DEEPGRAM_API_KEY=dg_xxx          # https://console.deepgram.com/
# ASSEMBLYAI_API_KEY=aai_xxx     # https://www.assemblyai.com/
# DEEPGRAM_MODEL=nova-2          # optional
```

Architecture (`src/server/transcription`): a `Provider` interface with pluggable
backends — `stub` (default), `deepgram` (single request), and `assemblyai`
(upload → poll). Priority is Deepgram → AssemblyAI → stub. Adding self-hosted
WhisperX (plan §4.3) is just another file implementing the same interface;
`parse.ts` holds the (unit-tested) response parsers. `GET /api/transcribe`
reports which backend is active — the UI shows it as an `ASR:` badge and uploads
media only when a real provider needs it.

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

- **Phase 2** — ✅ real ASR behind `/api/transcribe` (Deepgram + AssemblyAI).
  Next: queue + progress for long videos, audio extraction, WhisperX backend.
- **Phase 3** — server render worker: run `renderFrame` headless + ffmpeg
  burn-in → MP4.
- **Phase 4–5** — accounts, projects, storage lifecycle, Stripe + credits.
