# TODO / Technical Debt

Prioritized from the reviewed active implementation.

## P0 — Measurement correctness

### [ ] Add direct unit coverage for the quality-score formula

The scoring formula is important product behavior but current tests focus more heavily on metric primitives/probe architecture.

Add deterministic cases for:
- perfect connection
- each individual penalty band
- unavailable metrics
- combined penalties
- offline → 10
- clamp boundaries

### [ ] Add direct tests for use-case verdict thresholds

Protect Gaming, Video Calls, Streaming and Browsing classifications from accidental threshold drift.

### [x] Evaluate upload-test methodology

Completed 2026-08-29. Cloudflare upload now uses an XMLHttpRequest upload-
progress timeline with a 32 MB body, mid-body abort, and an aggregate fallback
when progress events are unavailable. Headless Chromium validation recorded the
methodology and showed the expected improvement over the old small POST loop.

## P1 — Reliability / maintainability

### [ ] Refactor `app.js` into modules

`app.js` currently combines:
- UI
- device APIs
- security
- probes
- throughput
- score
- verdicts
- charts
- settings
- sharing

Suggested structure:

```text
assets/js/
  metrics.js
  probes.js
  scoring.js
  security.js
  storage.js
  charts.js
  app.js
```

Do this incrementally with tests.

### [ ] Rename legacy localStorage keys via migration

Current keys:
- `phone-status-app-v3`
- `phone-status-history-v4`

These predate NetVitals branding.

Do not simply rename: users would lose settings/history.

Implement read-old/write-new migration if cleanup is desired.

### [ ] Add browser end-to-end tests

Current tests are strong static/unit contracts but do not execute the full app in a real browser.

Add Playwright tests for:
- page load
- Quick/Full buttons
- settings
- report sharing fallback
- mocked probe results
- offline state
- responsive layout basics.

The current FAST fallback behavior has been manually smoke-tested with
headless Chromium, but the browser scenarios are not yet committed as a
repository E2E suite.

### [ ] Add CI

No GitHub Actions workflow was present in the reviewed tree.

Recommended:
- Node tests
- Python validator
- optional Playwright smoke test

on pull requests.

### [ ] Make `app.js` easier to review

The active file is compact/minified-style source with many functions on long lines.

Reformat it with stable tooling while preserving behavior, then verify tests/diff carefully.

This will materially improve human and AI review efficiency.

## P2 — Measurement/product improvements

### [ ] Add multi-reference latency as a separate metric, not a replacement

Potential future feature:
- keep same-origin latency as the stable primary measurement,
- optionally test selected regional/reference endpoints,
- display route-specific latency separately.

Do not average arbitrary third-party services into the existing latency metric.

### [ ] Add loaded-latency / responsiveness testing

A useful advanced measurement would compare latency:
- idle,
- during download,
- during upload.

This can reveal bufferbloat more clearly than raw throughput.

Requires careful endpoint and concurrency methodology.

### [ ] Improve history semantics

Current history is local and limited to 20 records.

Potential enhancements:
- timestamps visible on chart interaction,
- export JSON/CSV,
- clear-history control,
- Quick vs Full marker,
- record which metrics were unavailable.

### [ ] Add explicit test metadata to shared report

Useful report fields:
- Quick vs Full
- measured sample count
- NetVitals version
- throughput window/duration and bytes transferred
- browser
- timestamp/timezone

This improves comparability.

## P3 — Security/privacy/content

### [ ] Review AdSense enablement state before every public release

`assets/js/config.js` currently has ads enabled.

Ensure this matches actual AdSense approval/consent/privacy configuration.

### [ ] Consider a stronger Content Security Policy

Current `_headers` includes useful baseline headers but no CSP.

A CSP must account for:
- Google AdSense
- Cloudflare speed-test requests
- current inline scripts/styles
- other required resources.

Test thoroughly before enforcing.

## P4 — PWA / release engineering

### [ ] Automate cache-version management

Currently developers must coordinate:
- `?v=4` references
- service-worker cache name
- precache URLs

Consider one release-version constant/build script to prevent mismatch.

### [ ] Add deployment health monitoring

Because latency relies on same-origin `/ping.txt`, production cache/edge behavior is part of measurement quality.

Periodically verify:
- HTTP 200
- body `ok`
- no-store headers
- no unintended redirect/cache behavior.

## Measurement accuracy roadmap

Proposed 2026-08-22 from a methodology review of `metrics.js` / `app.js`.
Ordered in implementation phases by risk/effort; none are started.
Every code item here requires: node tests, `validate_site.py`, the standard
matching asset/service-worker cache-version updates when core cached JS
changes, and documentation sync per `AGENTS.md`.

### Phase 1 — Low-risk precision (no semantic rewording)

- [x] **Resource-Timing RTT for latency probes** (`app.js` `latencyProbe()`)
  Shipped 2026-08-22 (ADR-020). Prefer `responseStart - requestStart` from the matching Resource Timing entry
  over wall-clock fetch duration (which includes body read + promise overhead);
  keep wall-clock fallback when no finite entry exists. Raise the resource-timing
  buffer once via `performance.setResourceTimingBufferSize()`. Record timing
  source per sample so details stay honest.

- [ ] **Tail latency (p90)** (`metrics.js`)
  Add `percentile(values, p)` beside `median()`; expose `latencyP90` from
  `summarizeProbeResults`; display only (detail line + report). Do not feed
  scoring/verdicts until separately decided.

- [ ] **Gap-aware jitter** (`metrics.js` `summarizeProbeResults`)
  Jitter currently compresses successful samples together, so deltas spanning a
  failed sample measure across a 200+ ms hole. Compute jitter over consecutive
  measured results only when both succeeded and their indices are adjacent.
  Keep `calculateJitter()` exported for compatibility; unit-test the gap case.

- [ ] **Timeout/error loss split + small-sample confidence**
  Summary gains timeout vs HTTP-error counts (results already carry `timeout`);
  loss detail shows the split. Add `wilsonInterval(failures, total)` to
  `metrics.js`; render 95% CI in the loss card when sample count < 30.

### Phase 2 — Throughput fidelity (methodology changes; ADR updates required)

- [x] **Parallel download streams** (`app.js` `timedDownload()`)
  Shipped 2026-08-22 with four streams and the Quick cap raised to 100 MB (ADR-021).
  Single-stream TCP underestimates capacity on high-BDP paths (fast links with
  real RTT). Open ~3 concurrent streamed `__down` requests and merge byte
  timelines into one cumulative series fed through `steadyStateThroughput()`
  (already sorts points). Share data caps across streams. Report label becomes
  "aggregate capacity". Update ADR-009/ADR-019, AGENTS.md speed profile,
  README wording; add merged-timeline unit tests.

- [x] **Upload via XHR progress events** (`app.js` `timedUpload()`)
  Shipped 2026-08-29 (ADR-023). `xhr.upload.onprogress` byte-timeline feeds
  `medianThroughput()` (same adaptive ramp discard as download); falls back to
  `aggregateThroughput()` when progress events do not fire. Upload chunk raised
  to 32 MB to remove the per-POST drain gap (browser-validated ~40→~59 Mbps on
  a real link). Mid-body abort when the window or cap elapses.

- [x] **Latency-adaptive ramp discard** (both throughput phases)
  Shipped 2026-08-29. `rampMs = clamp(2 × measured median latency, 500, 2000)`
  threaded from `runSpeedTests(full, latency)` into `timedDownload`/`timedUpload`
  and passed as `rampDiscardMs`. Deterministic and unit-tested.

- [x] **Median-of-per-second throughput reporting** (both throughput phases)
  Shipped 2026-08-29 (ADR-022). `medianThroughput()` buckets the post-ramp
  timeline into per-second rates and reports their median, replacing the window
  mean. `steadyStateThroughput` retained for the short-window fallback.

- [x] **Equalized data caps and larger chunks**
  Shipped 2026-08-29 (ADR-024). Quick cap 100→250 MB (equal to Full); download
  chunk 25→50 MB; upload chunk 2→32 MB.

- [x] **FAST/Netflix primary with Cloudflare fallback**
  Shipped 2026-08-29 (ADR-025). Direct browser discovery and validated Netflix
  OCA targets use adaptive 1–8 workers, 150 ms progress snapshots, a five-
  snapshot moving average, six-measurement/2% stability acceptance, and a
  cumulative 1 GB FAST-attempt cap. Discovery, CORS, target, progress, and
  stability failures automatically use the Cloudflare path without a provider
  selection. The current production CORS policy blocks `https://netvitals.net`,
  so production currently exercises the fallback.

- [ ] **Revisit the total click data budget**
  FAST has a cumulative 1 GB cap, while a failed FAST attempt can still be
  followed by the Cloudflare fallback's separate per-direction caps. If FAST
  becomes available on production, decide whether one aggregate budget should
  cover both attempts.

### Phase 3 — New signals (largest verdict value; new ADRs)

- [ ] **Loaded latency / bufferbloat**
  Fire ~300 ms-interval micro-probes against `/ping.txt` during download/upload
  windows; report idle -> loaded delta. Touches orchestration (`runChecks()`),
  adds an additive history field, needs a new ADR plus a verdict-wiring
  decision. Absorbs/refines the loaded-latency bullet under Future ideas below
  and the P2 loaded-latency item above when implemented.

- [ ] **Cloudflare edge reference latency (separate metric)**
  Timed GET of `speed.cloudflare.com/__down?bytes=0` (~5 samples), displayed as
  an anycast-edge reference card. Verify `Timing-Allow-Origin` at runtime;
  fall back to wall clock otherwise. Never averaged into the primary
  same-origin latency (consistent with ADR-002/ADR-008). Complements the P2
  multi-reference-latency item.

---

## Future ideas

- loaded latency / bufferbloat
- optional regional latency references
- richer history export
- diagnostic result permalink only if privacy/server requirements are designed first
- advanced endpoint profiles for gaming/work/video

Prioritize measurement validity over feature count.
