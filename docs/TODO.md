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

### [ ] Document latency reference more prominently in-product

Current latency is same-origin HTTP RTT to the NetVitals hosting path.

Add a concise UI/help explanation that this can differ substantially from:
- ICMP ping,
- a nearby game server,
- an Ookla server,
- a user's ISP gateway.

This is especially useful when users compare NetVitals latency with conventional speed-test tools.

### [ ] Evaluate upload-test methodology

Upload currently times a browser `fetch()` POST to Cloudflare using `mode: no-cors`.

Investigate how browser buffering/request completion affects reported upload throughput across Chrome/Safari/Firefox.

Acceptance:
- methodology documented,
- representative browser comparison recorded,
- implementation changed only if evidence supports it.

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
- throughput payload sizes
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

### [ ] Add Permissions-Policy reasoning to docs

Current policy disables:
- camera
- microphone
- geolocation

Keep those disabled unless a feature genuinely requires them.

## P4 — PWA / release engineering

### [ ] Automate cache-version management

Currently developers must coordinate:
- `?v=3` references
- service-worker cache name
- precache URLs

Consider one release-version constant/build script to prevent mismatch.

### [ ] Add a release checklist

Include:
- tests
- validator
- mobile browser checks
- cache bump
- sitemap/canonical
- AdSense state
- production `/ping.txt` cache verification
- Cloudflare speed endpoint smoke test.

### [ ] Add deployment health monitoring

Because latency relies on same-origin `/ping.txt`, production cache/edge behavior is part of measurement quality.

Periodically verify:
- HTTP 200
- body `ok`
- no-store headers
- no unintended redirect/cache behavior.

## Future ideas

- loaded latency / bufferbloat
- optional regional latency references
- richer history export
- diagnostic result permalink only if privacy/server requirements are designed first
- advanced endpoint profiles for gaming/work/video

Prioritize measurement validity over feature count.
