# UI Revamp — Vitals Monitor

Status: **Implemented** (design approved; automated checks and the browser matrix are the release validation record)

## Purpose

Replace the current generic "dark dashboard" look (blue gradients, glassmorphism
blur, rounded glow cards) with the **Vitals Monitor** design system defined in
`DESIGN.md`. The network is framed as a patient; the diagnostic is a check-up; the
progress bar is a live ECG heartbeat trace.

This document is the implementation record and testing plan. The source of truth
for the visual system is `DESIGN.md` (tokens + rationale). `AGENTS.md` remains the
source of truth for measurement behavior, which this revamp must not change.

## Non-negotiable constraints

- **Do not change measurement semantics.** No change to latency/jitter/loss/throughput
  math, scoring, verdicts, security signals, report wording, or localStorage keys.
- **Keep every DOM `id` that `app.js` reads.** The full list is the `ids` array at the
  top of `assets/js/app.js`. Removing/renaming an id breaks runtime behavior.
- **No "AI dashboard" clichés:** no `linear-gradient` button fills, no
  `backdrop-filter` blur, no blue/purple/cyan accents (the one allowed cyan is the
  secondary chart trace), no drop-shadow floating cards.
- **Measurement honesty is preserved** in every visible label (latency = "HTTP RTT
  approximation", loss = "application-layer request loss", security = "browser-visible
  only"). The ECG trace is explicitly decorative.
- Site remains static; `/ping.txt` cache rules and service-worker bypass are untouched.

## Files and changes

| File | Change | Version bump |
|---|---|---|
| `DESIGN.md` | Already authored (Vitals Monitor). No further change expected. | — |
| `assets/css/site.css` | Full visual rewrite: tokens → CSS custom properties, new palette/typography/components, ECG progress styles. | `?v=4` → `?v=6` |
| `index.html` | Update `theme-color`, add font loading, replace `.progress-track` span with the ECG progress markup, add the "Monitoring network vitals / LIVE" label row, tasteful static copy (see below). Keep all ids. | — |
| `assets/js/app.js` | Two small, contained changes: (1) add `runProgressDot` to the `ids` array; (2) update `updateProgress()` to drive the ECG fill via `clip-path` + dot position. | `?v=8` → `?v=9` |
| `service-worker.js` | Bump cache name and precache URLs to match new versions. | `netvitals-v8` → `netvitals-v10` |
| `tests/validate_site.py` | Update hardcoded asset versions (`site.css?v=6`, `app.js?v=9`) in the script-order check and the precache list. | — |
| `assets/fonts/` | New directory with self-hosted WOFF2 (see Fonts). | — |
| docs (`ARCHITECTURE.md`, `AGENTS.md`, `TESTING.md`, `FILE_MAP.md`) | Sync cache versions, add design-system pointers, add visual test plan. | — |

## ECG progress bar

The old progress bar is a 7px `<span>` whose width is set to a percentage. The new
one is a horizontal ECG trace that fills left-to-right. To keep the change minimal
and the fill undistorted, the fill is revealed with CSS `clip-path` (not by resizing
the SVG, which would squash the waveform).

### Markup (replaces the `.progress-track` div in `index.html`)

```html
<div class="ecg-label"><span class="rec">Monitoring network vitals</span><span class="live">Live</span></div>
<div class="ecg-progress" aria-hidden="true">
  <svg class="ecg-ghost" viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true">
    <!-- faint full waveform polyline (the "track") -->
  </svg>
  <div class="ecg-fill" id="runProgress">
    <svg viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true">
      <!-- bright waveform polyline + soft phosphor glow (the "fill") -->
    </svg>
  </div>
  <span class="ecg-dot" id="runProgressDot"></span>
</div>
<div class="progress-text" id="progressText">Choose a quick check or full diagnostic.</div>
```

The bright SVG sits at full track width inside `.ecg-fill`; the `clip-path` on
`.ecg-fill` reveals the left portion, so the waveform never distorts. `.ecg-ghost`
always shows the faint full track. `.ecg-dot` is the glowing pulse head.

### JS change (`app.js`)

```js
function updateProgress(p, text) {
  const x = clamp(p, 0, 100);
  els.runProgress.style.clipPath = `inset(0 ${100 - x}% 0 0)`;
  els.runProgressDot.style.left = `${x}%`;
  els.progressText.textContent = text;
}
```

Also add `'runProgressDot'` to the `ids` array (adjacent to `'runProgress'`). No
other `app.js` logic changes. `updateProgress` is not covered by the contract tests,
so the change is low risk.

## Fonts

Vitals Monitor uses IBM Plex Sans (display/body) and IBM Plex Mono (readouts/labels).

Preferred: **self-host** WOFF2 under `assets/fonts/` with `@font-face` in `site.css`,
using `font-display: swap` and system fallbacks. Weights: Plex Sans 400/600/700;
Plex Mono 400/500/600. Source via `google-webfonts-helper` or IBM Plex releases.
Self-hosted fonts are same-origin, so the service worker runtime-caches them and the
site keeps its static/privacy-first posture (no new third-party font host).

Fallback if self-hosting is blocked in the environment: use the Google Fonts
`<link>` and review/update the privacy page wording accordingly. Do not ship a mix
of both without a note.

System fallbacks (must remain in the stacks so the site degrades gracefully):
- Sans: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- Mono: `ui-monospace, 'SFMono-Regular', Menlo, monospace`

## Cache/version discipline (target state)

The current shipped versions are `site.css?v=6` and `netvitals-v10`, with
`app.js?v=9` (a follow-up Device-grid spacing fix advanced `site.css` from `?v=5`
and the cache from `netvitals-v9`).

| Asset | Before | After |
|---|---|---|
| `site.css` | `?v=4` | `?v=6` |
| `app.js` | `?v=8` | `?v=9` |
| `metrics.js` | `?v=6` | unchanged |
| `fast.js` | `?v=1` | unchanged |
| service-worker `CACHE` | `netvitals-v8` | `netvitals-v10` |

Update all of these in the same change, plus the two hardcoded version strings in
`tests/validate_site.py`. Do not let a changed file keep its old query string.

## Static copy (optional, low-risk)

Pure-HTML text that has no matching `id` in `app.js` may be reworded for the new
framing, e.g. `.overall-label` "Overall status" → "Overall condition". The dynamic
score label (`#qualityLabel`) is overwritten with the grade after a run, so leave its
logic alone. Do **not** rename any measurement name or strengthen any claim. Do not
introduce the literal strings `Connection Health` or `example.com` (the site
validator rejects them).

## Testing plan

### Automated

```bash
node --test tests/app.test.js tests/metrics.test.js tests/fast.test.js
python3 tests/validate_site.py
```

Expectations:
- Contract tests stay green (no measured-section changes).
- `validate_site.py` passes after its version strings are updated (duplicate-id
  check catches any broken markup; it also runs `node --check` on all JS).
- Optional: add a lightweight contract test asserting `index.html` contains the ECG
  progress ids (`runProgress`, `runProgressDot`) and that `updateProgress` sets
  `clipPath` — mirroring the existing `app.test.js` source-contract style.

### Browser / visual matrix (manual)

Desktop (Chrome, Edge, Firefox, Safari) and mobile (iOS Safari, Android Chrome):

1. **Idle** — ghost track visible, empty bright fill, dot at 0%, "Choose a quick
   check or full diagnostic."
2. **Running** — bright trace draws left-to-right, dot tracks the fill head, no
   horizontal layout shift or overflow.
3. **Complete** — full trace; status dot/verdict/score render as before.
4. **Error/offline** — "bad" dot and messaging still render; ECG returns to a reset
   state on the next run.
5. **Fonts** — IBM Plex Sans/Mono load; fallback stacks appear correctly when fonts
   are blocked (DevTools offline).
6. **Contrast** — phosphor green trace vs screen-black, amber/red severity text
   legible; no color-only meaning (dots/pills keep text labels).
7. **Viewports** — 320, 350, 375, 390, 430, 768, 1024+: no horizontal overflow,
   tappable controls, charts fit, long endpoint URLs don't break layout.
8. **prefers-reduced-motion** — the trace fill and dot must not animate on a loop or
   strobe; honor reduced motion.
9. **PWA** — new worker activates, offline shell works, `/ping.txt` stays network-only,
   old `netvitals-v8` cache is cleaned up.
10. **No-regression sweep** — confirm the retired clichés (blue gradient buttons,
    blur panels, glowing blue cards) are gone and measurement labels are unchanged.

## Documentation sync checklist (same change)

- `DESIGN.md` — already reflects Vitals Monitor.
- `docs/ARCHITECTURE.md` — PWA cache section now records v10 / `site.css?v=6` /
  `app.js?v=9` and includes a "Visual design system" pointer to `DESIGN.md`.
- `docs/DECISIONS.md` — ADR-026 records the implemented Vitals Monitor + ECG-as-
  progress + self-hosted-font decision.
- `docs/FILE_MAP.md` — includes `DESIGN.md`, `docs/UI_REVAMP_PLAN.md`,
  `assets/fonts/`, and a task-routing entry for "design system / visual redesign".
- `docs/TESTING.md` — includes the visual-regression section and current
  cache-version references.
- `AGENTS.md` — records the current cache/version discipline, `DESIGN.md` and this
  plan in the context-loading pointers, and the "no AI-dashboard clichés" rule.
- Review `README.md`/`privacy/index.html` only if visual wording or font hosting
  (third-party vs self-hosted) changes their claims.

## Definition of Done

- Automated tests + site validator pass.
- Browser/visual matrix items 1–10 checked on the relevant browsers.
- Cache/asset versions and `validate_site.py` strings are coherent.
- ECG fill is driven by the existing `updateProgress()` values (no measurement change).
- Documentation impact assessed and synced per `AGENTS.md`.
