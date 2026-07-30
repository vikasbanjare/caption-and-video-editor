# HANDOFF — Pulse web app (branch `claude/awesome-davinci-g2h0or`)

Audited 2026-07-30. Scope: all 33 commits on `origin/main..HEAD` (main is an
empty root commit — this branch IS the entire project, 75 files, ~19.5k lines,
all additive). Verified live: **72/72 vitest tests pass, `tsc --noEmit` clean,
`next lint` clean (1 benign font warning), working tree clean.**

Reality check up front: this repo is **not the Premiere plugin**. It is the
**web app** (Next.js caption NLE) — the web port of the Pulse/CutPilot caption
engine. The actual Premiere Pro plugin (CEP panel: silence removal, multicam,
captions, chapters, MOGRTs) lives in `vikasbanjare/video`
(branch `claude/awesome-davinci-pfsryy`, cloned at `/workspace/video`).

## State

| Feature | State |
| --- | --- |
| Caption engine (SRT parse/serialize, word timing, regroup, hold, keyword highlight) | **Complete** — `src/engine/captions.ts`, tested |
| Canvas renderer: 18 animations, gradients, strokes stack, glow, boxes/pills, 3D, karaoke, typewriter | **Complete** — `src/engine/render.ts` (no unit tests) |
| Template catalog: 97 plugin presets + 14 Flux/Titles = **111** | **Complete** — data ported 1:1, live animated gallery |
| Hinglish: Devanagari + Urdu/Arabic → Latin, auto on every path | **Complete**, tested |
| In-browser Whisper transcription (transformers.js worker, word timestamps) | **Complete**; model + lib load from CDNs at runtime |
| Server ASR (`/api/transcribe`): Deepgram → AssemblyAI → stub priority | **Complete** but **stubbed by default** (no keys in repo); parsers tested, network paths not CI-exercised |
| Editing timeline (drag/trim/snap, waveform, zoom, playhead, virtualized canvases) | **Complete** |
| Transcript panel, undo/redo (80 steps, coalesced text edits), keyboard shortcuts | **Complete**, edit ops tested |
| Burn-in video export (MediaRecorder + captureStream, grade + silence-cut + audio chain) | **Complete** but **records in real time** (10-min video = 10-min export) and outputs WebM on Chrome/Firefox (MP4 only where supported, e.g. Safari) |
| SRT / styled ASS / OTIO timeline / marker-CSV exports | **Complete**, tested |
| Silence-cut | **Export-time only** — detected from word gaps, applied as keep-segments during export; the timeline does not visualise or apply cuts |
| Color grade (looks + exposure/contrast/saturation), enhance-audio | **Complete** (filter-string primitives only; no LUT/temperature — deliberate) |
| Local projects (IndexedDB video + localStorage records), frame notes, analytics panel | **Complete** |
| Image background remover (region-grow, no model) | **Complete**, tested |
| Responsive/mobile | **Half-built** — every stage's side panel is `hidden … lg:flex`, so below the `lg` breakpoint the Script stage has no transcribe controls at all |
| Accounts, billing, server-side render | **Not started** (plan Phases 3–5) |

## Files

- `src/engine/` — pure, DOM-free caption brain shared by preview & (future) server render: `captions.ts` (SRT/words/regroup), `render.ts` (canvas frame renderer), `romanize.ts` (Devanagari+Arabic→Latin), `presets.ts` (raw→CaptionStyle mapping, fs/1296 calibration), `templates.data.ts` (97 ported presets), `flux.data.ts` (Flux/Titles MOGRT ports), `types.ts`, `index.ts` (barrel).
- `src/components/` — `Editor.tsx` (root orchestrator: state, undo, autosave, shortcuts, stage layouts), `VideoStage.tsx` (monitor: canvas overlay, caption drag, safe zones, note pins), `Timeline.tsx`, `TranscriptPanel.tsx`, `StylePanel.tsx` (full customize UI), `TemplatePicker.tsx` (animated gallery), `ProjectConsole.tsx` (Ingest room), `StageRail.tsx`, `NotesPanel.tsx`, `AnalyticsPanel.tsx`, `ImageTools.tsx`, `Logo.tsx` (Pulse mark/wordmark), **`Toolbar.tsx` + `ProjectLibrary.tsx` = DEAD (never imported)**.
- `src/lib/` — `export.ts` (burn-in recorder), `transcript.ts` (cue edit ops), `transcribe-browser.ts` + `src/workers/whisper.worker.js` (Whisper), `silence.ts`, `ass.ts`, `interchange.ts` (OTIO/CSV), `store.ts` (persistence), `analytics.ts`, `grade.ts`, `tools.ts` (fillers/chapters), `bgremove.ts`, `waveform.ts`.
- `src/server/transcription/` — provider registry (`index.ts`), `deepgram.ts`, `assemblyai.ts`, `parse.ts` (tested), `stub.ts`, `types.ts`; `src/app/api/transcribe/route.ts` is the endpoint.
- `src/app/` — `layout.tsx` (Geist UI type + Google-Fonts caption faces + theme script), `globals.css` (token system), `page.tsx` / `editor/page.tsx` (both render `Editor`).
- Root: `Daxio-Review.html` (standalone imported artifact — source of the ported persistence/notes; not referenced by the app), `WEBSAASPLAN.md` (architecture plan), `README.md` (**stale**, see Gotchas), `.claude/skills/cutpilot-design/SKILL.md` (design language; partially stale), `next.config.js` (static-export mode for Pages), CI + Pages workflows, devcontainer.

## Decisions

- INFERRED: Product rebranded CutPilot → **Pulse "by aifloh"** (commit 9571612; `Logo.tsx`, layout metadata). Internal storage keys still say `cutpilot.*`.
- INFERRED: **Preview === export** is the core invariant — one `renderFrame` against plain `CanvasRenderingContext2D` drives monitor, gallery thumbs, hero demo, and export; grade is a shared CSS/canvas filter string.
- INFERRED: Font size scales by **min(width, height)** with the plugin's authored calibration (`fontScale = fontSize/1296`, i.e. 75px@1080 ≙ Size 90) — a Pulse-tech-brief fix over naive height scaling.
- INFERRED: **Real ASR word timings are sacred** — every edit op preserves them (retime scales, merge concatenates, split cuts at word starts); only text edits redistribute.
- INFERRED: **Auto-romanize always** — any Devanagari/Urdu script becomes Latin Hinglish on transcribe/import/open, regardless of the language picker (RTL text would jumble in the LTR renderer).
- INFERRED: Whisper lib is **CDN-loaded, not bundled** (webpackIgnore) so the static GitHub Pages build works with zero server.
- INFERRED: Silence-cut is **non-destructive export-time segments**, not timeline edits.
- INFERRED: Real-time MediaRecorder export chosen over ffmpeg.wasm/server render for Phase 1 (no wasm bundle, no server; accepted cost: real-time speed, WebM on Chrome).
- INFERRED: Local-first, no accounts: video blobs in IndexedDB, records in localStorage with oldest-project eviction on quota overflow.
- INFERRED: Design language = **application, not website** (stage rooms + project console, from the cutpilot-design skill); violet accent explicitly rejected for the Pulse-logo blue (commit 9d17580).

## Constraints

- **Naming**: user rule is “[Product Name] by AI-Floh”. Code currently renders **“Pulse by aifloh”** (lowercase, no hyphen) in `Logo.tsx` and `layout.tsx` metadata — mismatch to resolve one way or the other.
- **Fonts**: user rule says Open Sans for all UI/design output. Code deliberately uses **Geist Sans/Mono** for UI (layout comment: “No serif, no Inter”) and ~20 Google-Fonts caption faces for output. Open Sans is not loaded at all — needs a user decision, not a silent change.
- **Palette**: CSS-var token system in `globals.css`; accent locked to the Pulse logo gradient blues (#3B6BF5 dark / #2C57E6 light). Dark + light themes, pre-paint theme script.
- **Premiere/NLE interop visible in code**: ASS colours are BGR `&HBBGGRR&` with numpad alignment; OTIO targets Resolve 18.5+ / Premiere 2025+; marker CSV covers older versions; SMPTE at 30fps default. The desktop plugin itself is **CEP, not UXP** (`CSXS/` in the video repo).
- **Browser limits handled in code**: `MediaRecorder` MIME negotiation (MP4 Safari, else WebM); canvas `letterSpacing` and `ctx.filter` wrapped in try/catch (node-canvas lacks them); static export drops the API route (`pages.yml` deletes `src/app/api`); autoplay-block on export surfaces a retry message.

## Gotchas

- **Zero TODO/FIXME/commented-out blocks in `src/`** — the branch is clean, not half-finished.
- **README.md is stale**: still titled CutPilot, claims burn-in MP4 export is “⛔ Phase 3” (it shipped in 4f76946) and says 97 templates (it's 111). `layout.tsx` description also says 97.
- **Dead files**: `src/components/Toolbar.tsx` and `src/components/ProjectLibrary.tsx` compile but are never imported (superseded by StageRail/ProjectConsole in the ed64661 redesign).
- **Pages deploy trigger**: `.github/workflows/pages.yml` fires only on `claude/confident-galileo-o4chx1` and `main` — pushes to this branch run CI but never redeploy the live demo.
- **Design-skill drift**: `cutpilot-design/SKILL.md` still prescribes Fraunces/Hanken Grotesk; the code moved to Geist in 9571612.
- **Test gaps**: no tests for `render.ts` (largest, most-edited file), `export.ts`, `analytics.ts`, `grade.ts`, or any React component. Everything that IS tested passes.
- **Export runs in real time** and depends on `requestAnimationFrame` — a backgrounded tab will throttle and mangle the recording.
- **Mobile**: side panels hidden below `lg`; Script stage is unusable on phones.
- CDN runtime deps: jsDelivr (transformers.js), HuggingFace (model), Google Fonts — the app degrades without network on first run.

## Abandoned mid-edit

Checked for all of: unclosed functions, imports with no usage, files referenced
but never created, broken requires. **Found none** — `tsc --noEmit` is clean,
all 75 files parse, every import resolves, no asset/`public/` references exist,
and the tree has no uncommitted debris. The session that built this branch
finished its edits; what it left behind instead is **doc drift** (README, design
skill, template counts) and the two orphaned components above. `Daxio-Review.html`
is a deliberately standalone artifact, not an unfinished page.

## Next 3 actions

1. **Truth-sync the docs to the shipped product** — rewrite `README.md` (Pulse
   branding, burn-in export ✅, 111 templates, correct repo story) and fix the
   template count in `src/app/layout.tsx` metadata. The docs currently
   contradict the app.
2. **Delete the orphans** — remove `src/components/Toolbar.tsx` and
   `src/components/ProjectLibrary.tsx` (superseded; keeping them invites edits
   to dead code).
3. **Fix the demo deploy trigger** — in `.github/workflows/pages.yml`, deploy
   from this branch (`claude/awesome-davinci-g2h0or`) or from `main` after
   merge, so the live demo stops tracking the abandoned sibling branch.
