# File Map

Use this file to identify the minimum file set for a task.

## Core diagnostic

### `index.html`

Role:
- main application markup
- diagnostic cards
- settings dialog
- educational content
- metadata/canonical/structured data
- core script/style references
- AdSense loader

Read for:
- UI structure
- SEO/meta
- script ordering
- page copy
- ad placement

### `assets/js/app.js`

Role:
Main runtime controller.

Contains:
- browser/device detection
- Network Information/Battery handling
- security assessment
- service checks
- latency HTTP request function
- speed tests
- quality score
- use-case thresholds
- diagnostic orchestration
- charts/history
- settings
- report/share

**Risk:** High.

### `assets/js/metrics.js`

Role:
Measurement math and sequential probe runner.

Contains:
- sample profile
- median
- jitter
- request-loss summary
- internet evidence helper
- sequential measurement runner

This is the preferred place for testable metric-algorithm changes.

**Risk:** High.

### `assets/css/site.css`

Role:
Shared visual system and responsive layout.

Read for:
- overflow
- mobile layout
- cards/settings
- charts
- ads/content styling

### `ping.txt`

Role:
Dedicated same-origin latency payload.

Must contain:
`ok`

Must not be cached.

**Risk:** Critical to measurement accuracy.

## Configuration / integrations

### `assets/js/config.js`

Role:
Site name/origin and AdSense configuration.

Current ads enable flag is runtime configuration.

### `assets/js/ads.js`

Role:
Optional manual ad-unit handling.

### `assets/js/pwa.js`

Role:
Service-worker registration.

### `service-worker.js`

Role:
PWA caching/fallback.

Important:
- `/ping.txt` bypass
- core cache version
- precache list

### `_headers`

Role:
Cloudflare Pages response headers/cache policy.

Important:
- security headers
- `/ping.txt` no-store
- service-worker no-cache

### `manifest.webmanifest`

Role:
PWA identity/install metadata.

## Tests

### `tests/metrics.test.js`

Behavioral metric tests:
- profile
- median
- jitter
- failure handling
- loss
- sequential runner
- warm-up exclusion

### `tests/app.test.js`

Contract/source tests:
- six security signals/weights
- isolation of quality probe from service checks
- latency-probe cache behavior
- report limitation wording

### `tests/validate_site.py`

Whole-site validation:
- HTML metadata
- canonical domain
- duplicate IDs
- branding
- AdSense
- icons/manifest/sitemap
- ping endpoint
- Cloudflare headers
- service-worker rules
- JS syntax
- unit tests

## Content pages

- `about/index.html`
- `how-it-works/index.html`
- `privacy/index.html`
- `terms/index.html`
- `contact/index.html`
- `guides/**/index.html`
- `404.html`

Read these for:
- content/SEO
- legal/privacy wording
- nav/footer consistency
- AdSense placement/scripts

Do not load every guide for a diagnostic-code task.

## Search/discovery

- `robots.txt`
- `sitemap.xml`
- `ads.txt`

## PWA/icon assets

`assets/icons/**`

Do not inspect binary icons for ordinary diagnostic changes.

## Task routing

| Task | Start with |
|---|---|
| Latency/jitter/loss math | `metrics.js` + `metrics.test.js` |
| Latency endpoint behavior | `app.js` + `ping.txt` + `_headers` + service worker |
| Speed test | `app.js` |
| Quality score | `app.js` + add/update tests |
| Gaming/call/stream verdicts | `app.js` |
| Security signals | `app.js` + `app.test.js` |
| Service endpoints | `app.js` |
| Mobile UI | `index.html` + `site.css` |
| PWA/cache | `service-worker.js` + `pwa.js` |
| AdSense | `config.js` + `ads.js` + HTML pages + validator |
| SEO | affected HTML + sitemap/robots + validator |
| Site-wide release validation | all files referenced by `validate_site.py` |
