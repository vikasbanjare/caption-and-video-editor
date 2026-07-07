---
name: cutpilot-design
description: The CutPilot design language — a professional caption NLE (like Premiere/DaVinci), NOT a website. Load this BEFORE building or restyling ANY CutPilot UI (console, stages, panels, timeline, monitor, buttons). It exists to keep the product an *application* and out of the generic "AI SaaS website" look (purple gradient, glow, glassmorphism, Inter, hero + 3 cards + marquee).
---

# CutPilot Design — a caption NLE, not a website

CutPilot is a **professional editing application**, operated like Premiere or
DaVinci Resolve — dense, monitor-first, keyboard-driven. It has **no landing
page, no marketing hero, no decorative specimens**. DaVinci earned its place by
re-thinking the *workflow* (its "Pages"), not by being pretty; that is the bar.

## The paradigm — Stage rooms (our "Pages")

The whole app is organised as **stages** switched from a bottom rail (like
DaVinci's page rail), each a workspace laid out for one craft:
`Ingest · Script · Cut · Type · Export`. The front door is a **Project console**
(a dark project manager: your projects as cards + "new from media"), never a
marketing landing. Actions are **contextual to the stage** they belong to, not
piled into one top toolbar.

## Look & feel

- **Application chrome, not web chrome**: slim bars, dense panels, hairline
  dividers, mono micro-labels/timecodes. The monitor and timeline are the heroes;
  chrome is quiet and recedes so the media reads.
- Typography still carries identity (we are a caption tool): **Fraunces** for the
  wordmark, stage numbers and project titles; **Hanken Grotesk** for UI (never
  Inter); **JetBrains Mono** for labels/timecodes/indices.

## Non-negotiables (how we avoid the generic AI look)

DO NOT, ever:
- Use **Inter, Roboto, Arial, Space Grotesk** for display/brand. (Grotesque UI
  body is fine, but never the generic ones above.)
- Use **purple/blue gradients, glows, glassmorphism, blurred color blobs**, or
  `bg-clip-text` rainbow headings. No `shadow-glow`. No neon.
- Ship the template layout: centered hero → 3 feature cards → testimonial →
  pricing. Cards-in-a-row is banned as the primary structure.
- Center everything. Default to a strong **left-aligned, asymmetric** grid.
- Use rounded-everything. Radii are small and deliberate (see tokens).
- Write generic copy ("Caption your videos beautifully", "Powerful features").
  Copy is specific, plain, a little opinionated.

DO:
- Lead with **type**: a huge Fraunces headline is the hero, not an image.
- Use **hairlines** (1px `border-edge`) to build structure, like column rules.
- Use **mono eyebrows / indices / timecodes** (`01 — UPLOAD`) for a technical,
  editorial cadence.
- Let the **product dogfood itself**: render a real caption specimen with the
  actual engine as the hero visual.
- Keep motion **physical and quiet** (transforms, marquee, hairline reveals) —
  never a pulsing glow.

## Type system

- **Display** — `font-display` = **Fraunces** (variable serif, optical sizing).
  Big, tight leading (`leading-[0.95]`), for mastheads and section numbers.
  Use the italic for accents/quotes. This is the brand voice.
- **UI / body** — `font-sans` = **Hanken Grotesk** (warm humanist grotesque,
  NOT Inter). All controls, labels, paragraphs.
- **Mono** — `font-mono` = **JetBrains Mono**. Uppercase eyebrows with wide
  tracking (`tracking-[0.2em]`), indices, timecodes, keyboard hints.
- Caption *template* fonts (Montserrat, Anton, Bebas, …) are a separate concern
  — they belong to the caption engine output, not the chrome.

## Palette (tokens are RGB channels → `rgb(var(--x) / <alpha-value>)`)

Two themes share one set of semantic tokens:
- **Studio** (default, the editor): warm near-black, not blue-black.
  bg `23 20 15` · surface `28 24 19` · surface-2 `34 30 24` · surface-3
  `42 37 30` · edge `50 44 36` · edge-2 `66 58 47` · ink `236 230 218` ·
  muted `154 144 130`.
- **Paper** (`.theme-paper`, the landing): warm bone/ivory.
  bg `244 241 233` · surface `249 246 239` · surface-2 `240 236 227` ·
  edge `219 212 199` · ink `23 20 15` · muted `122 112 98`.
- **Accent** — a single **vermilion** carried over from the CutPilot Premiere
  plugin: `249 75 30` (`#F94B1E`). Used sparingly for one thing per view
  (active state, a rule, a mark). Never a gradient. accent-2 (hover/links):
  studio `255 106 61`, paper `214 60 20`.

## Layout & components

- Grid: 12-col feel, but place things off-axis. Section numbers (`01`, `02`) in
  the left margin, content in a wide column, hairline rules between rows.
- Radius: `--r-sm` 6px, `--r` 10px, `--r-lg` 14px. Buttons/inputs use `--r-sm`.
  Big surfaces use `--r`. Nothing is a pill except intentional chips.
- Buttons: **flat**. `.btn` = hairline border + surface; `.btn-primary` = solid
  vermilion, ink-on-accent, no gradient, no glow, subtle press (`active:scale`).
- Borders do the work of shadows. Shadows, if any, are tiny and warm, never a
  glow ring.
- Empty / zero states are **worktables**: a framed dropzone with a mono
  instruction line, not a floating gradient card.

## When restyling existing screens

Change token *values*, not names, so the whole editor reskins at once. Replace
any `accent-grad` / `hero-grad` / `shadow-glow` / gradient-text with flat
editorial equivalents. Verify with a screenshot every time — this system lives
or dies on spacing and type, which only read in the render.
