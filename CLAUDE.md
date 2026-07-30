# CLAUDE.md — Pulse (web app)

## Product

**Pulse by AI-Floh** — caption tooling for short-form creators.
Two codebases, don't confuse them:

- **This repo**: the Pulse **web app** — a browser caption NLE (Next.js).
  Upload → in-browser Whisper transcription → edit on a timeline → style with
  111 templates → burn-in export. Local-first, no accounts, nothing uploads.
- **`vikasbanjare/video`**: the Pulse/CutPilot **Premiere Pro plugin** (CEP
  panel, *not* UXP): silence removal, multicam auto-switch, captions, chapters.
  The web engine here is a 1:1 TypeScript port of that plugin's caption brain.

## Naming rule

All products are named **"[Product Name] by AI-Floh"** — never deviate.
Known drift: `src/components/Logo.tsx` and `src/app/layout.tsx` currently
render "by aifloh" (lowercase). Use "AI-Floh" in any new copy; ask before a
sweeping rename of existing UI.

## Fonts

User standard: **Open Sans** for all UI and design output. Known conflict:
the app currently uses Geist Sans/Mono for UI (deliberate, commit 9571612)
and ~20 Google-Fonts faces for caption output — Open Sans isn't loaded.
Apply Open Sans to NEW design artifacts; migrating the app's UI type is a
user decision, don't do it silently.

## Stack & commands

Next.js 14 (app router) · React 18 · TypeScript · Tailwind (token system in
`globals.css`) · Vitest. No other runtime deps — the engine is dependency-free.

```bash
npm install
npm run dev        # editor at http://localhost:3000
npm test           # vitest (72 tests)
npm run typecheck  # tsc --noEmit
npm run lint
npm run build      # NEXT_PUBLIC_STATIC_EXPORT=true → static GitHub Pages build
```

Testing the **plugin** is a `vikasbanjare/video` task (CEP panel + install
scripts there), not something this repo can exercise.

## Architecture invariants

- `src/engine/` is pure and DOM-free; the SAME `renderFrame` draws the live
  preview, gallery thumbnails, and export ("preview === export"). Never fork
  render logic per surface.
- Font size = `fontScale × min(width, height)`; template calibration is
  `fontSize / 1296` (authored 75px @ 1080, plugin Size 90). Don't "fix" this
  back to height-only scaling.
- Real ASR word timings are preserved through every edit op
  (`src/lib/transcript.ts`); only text edits redistribute timing.
- Devanagari/Urdu script is ALWAYS auto-romanized to Latin Hinglish (the
  renderer is LTR-only).

## Premiere / platform constraints seen in code

- Desktop plugin is **CEP** (CSXS manifest); UXP does not apply.
- ASS export: colours are BGR (`&HBBGGRR&`), numpad alignment; OTIO imports
  into Resolve 18.5+ / Premiere 2025+; marker CSV for older versions.
- Burn-in export uses MediaRecorder: records in **real time**, MP4 only where
  supported (Safari), WebM elsewhere; canvas `letterSpacing`/`ctx.filter` are
  feature-detected (node-canvas lacks them).
- Static Pages build drops `src/app/api` (no server); Whisper loads
  transformers.js + model from CDNs at runtime.

## Tried and rejected

- Generic "AI SaaS website" look (hero, purple gradient, glassmorphism, Inter)
  → rejected; the app is an NLE with stage rooms + project console
  (see `.claude/skills/cutpilot-design`).
- Violet accent → rejected for the Pulse-logo blues (#3B6BF5 / #2C57E6).
- Serif/editorial identity (Fraunces) → superseded by Geist technical type;
  the design skill doc predates this and is partially stale.
- Height-only font scaling → oversized portrait captions; replaced by
  min-dimension scaling + fs/1296 calibration.
- Native-script captions → jumbled RTL rendering; replaced by always-romanize.
- Frozen template thumbnails → replaced by live-animated gallery cards
  (IntersectionObserver-gated).
- Toolbar-centric layout (`Toolbar.tsx`, `ProjectLibrary.tsx`) → superseded by
  StageRail/ProjectConsole; those two files are dead code.
