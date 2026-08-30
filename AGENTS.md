# AGENTS.md

## Purpose

This is the entry point for AI coding agents working on **NetVitals / Network Connection Tester**.

The project is intentionally a static browser application. Agents should make targeted changes without repeatedly reading the entire repository.

Reviewed baseline: `main` commit `1de4c4c2c713100de7cbf37556a34476e19aeb3f`.

## Context-loading rule

**Do not scan the entire repository by default.**

For every task:

1. Read this file.
2. Read `docs/FILE_MAP.md`.
3. Read only the documentation relevant to the task:
   - product purpose and browser constraints → `docs/PROJECT_CONTEXT.md`
   - data flow and measurement architecture → `docs/ARCHITECTURE.md`
   - intentional design choices → `docs/DECISIONS.md`
   - validation → `docs/TESTING.md`
   - known work / technical debt → `docs/TODO.md`
   - visual identity / UI work → `DESIGN.md` (and `docs/UI_REVAMP_PLAN.md` when redesigning)
4. Open only the source files required for the task.
5. Expand context only when a dependency cannot be established from the selected files.

## Active implementation

### Main application page
`index.html`

Contains the diagnostic UI, metadata, navigation, educational links, and script/style loading.

### Diagnostic controller
`assets/js/app.js`

Owns:
- browser/device information
- browser-visible security assessment
- configured service checks
- same-origin latency probe
- automatic FAST/Netflix throughput selection
- Cloudflare throughput fallback
- quality scoring
- use-case verdicts
- history/charts
- settings/localStorage
- sharing/report generation
- diagnostic orchestration

### Measurement module
`assets/js/metrics.js`

Owns the isolated/testable measurement math:
- probe profile
- median
- jitter
- measured-request loss summary
- connectivity evidence
- sequential probe runner

### FAST throughput adapter
`assets/js/fast.js`

Owns the direct, browser-visible FAST/Netflix Open Connect integration:
- discovery and HTTPS OCA target validation
- adaptive 1–8 worker transfers
- moving-average progress and stability checks
- target failure handling
- cumulative 1 GB FAST-attempt data cap

The discovery endpoint is an undocumented third-party dependency. If it is
unavailable, unstable, or blocked by CORS, `app.js` must use Cloudflare without
requiring a user provider selection.

### Styling
`assets/css/site.css`

### Runtime configuration
`assets/js/config.js`

Contains:
- site identity
- canonical site URL
- AdSense client/slot
- ads enable flag

### PWA
- `manifest.webmanifest`
- `service-worker.js`
- `assets/js/pwa.js`
- `assets/icons/**`

### Hosting/cache rules
`_headers`

### Latency target
`ping.txt`

This file must contain exactly `ok` and must remain uncached.

### Tests
- `tests/metrics.test.js`
- `tests/fast.test.js`
- `tests/app.test.js`
- `tests/validate_site.py`

## Measurement truth — do not misrepresent

NetVitals does **not** perform ICMP ping, raw packet capture, Wi-Fi security inspection, router inspection, DNS integrity testing, LAN scanning, port scanning, malware detection, or true network-layer packet-loss testing.

Current measurements are:

- **Latency:** median of successful samples timed against same-origin `/ping.txt`; each sample prefers Resource Timing `responseStart - requestStart` and falls back to wall-clock fetch duration.
- **Jitter:** mean absolute difference between consecutive successful measured latency samples.
- **Request loss:** percentage of measured `/ping.txt` requests that fail.
- **Download/upload:** FAST/Netflix Open Connect browser transfers when discovery, CORS, target health, progress, and stability checks succeed; otherwise Cloudflare browser transfers are used automatically as a fallback. The selected provider is recorded and reported.
- **Service checks:** browser `no-cors` fetch reachability checks to configured HTTPS endpoints.
- **Security score:** only browser-visible page/context signals.

Do not rename these into stronger claims.

## Probe profile

Defined in `metrics.js`:

- warm-ups: 2
- Quick Check measured samples: 8
- Full Diagnostic measured samples: 16
- spacing: 100 ms
- latency request timeout: 2000 ms

Warm-up probes are discarded from latency, jitter, and request-loss calculations.

Measured probes run sequentially.

### Speed profile

The Cloudflare fallback profile is defined in `metrics.js` as `SPEED_PROFILE`:

- Quick throughput window: 4000 ms
- Full throughput window: 8000 ms
- ramp discard: adaptive, `clamp(2 × measured median latency, 500, 2000)` ms, passed into both directions as `rampDiscardMs`
- minimum steady-state window: 1000 ms (shorter windows fall back to the post-first-byte average)
- settle pause before download and between download/upload: 600 ms
- download streams: 4 parallel streamed requests sharing one cumulative byte timeline and data cap
- download chunk: 50 MB per request; upload chunk: 32 MB per XHR POST
- data caps: 250 MB (Quick) and 250 MB (Full) — whichever limit ends the phase first
- one warm-up transfer per direction, discarded from the result

Download measures a fixed-duration window across parallel streams; the clock starts at the first received byte on any stream, so connection setup is excluded. The reported value is the median of per-second sustained rates across those streams, not single-flow throughput. Upload streams via `XMLHttpRequest` `upload.onprogress` into the same cumulative byte timeline, aborts the in-flight body when the window or cap elapses, and reports the median of per-second sustained rates; it falls back to `aggregateThroughput` when progress events never fire.

Steady-state math (`steadyStateThroughput`, `medianThroughput`, `aggregateThroughput`) lives in `metrics.js` and is unit-tested in `tests/metrics.test.js`.

### FAST/Netflix primary profile

Defined in `fast.js`:

- discovery: `api.fast.com/netflix/speedtest/v2`, five target URLs
- connections: start at 1 and grow to at most 8 from aggregate-speed thresholds
- progress snapshots: 150 ms
- moving average: latest 5 snapshots
- stability: six recent measurements within 2%, after at least 7 seconds
- maximum duration: 12 seconds Quick, 30 seconds Full
- request size: 25 MB range requests with an inclusive-byte correction
- cumulative FAST attempt cap: 1 GB across download and upload
- requests use only validated HTTPS `*.nflxvideo.net` targets

FAST results are accepted only when both directions produce finite, stable
progress-based estimates. A failed or sketchy attempt is discarded and the
Cloudflare fallback runs automatically. FAST and Cloudflare values remain
provider-labelled so history deltas do not compare different routes.

## Quality score

Implemented in `app.js`.

Base score = 100.

If internet access is not established, score = 10.

Otherwise penalties are applied:

### Request loss
`min(lossPercent × 2.4, 35)`

### Latency
For finite latency:
`clamp((latencyMs - 50) / 8, 0, 20)`

Unavailable latency:
`-20`

### Jitter
For finite jitter:
`clamp((jitterMs - 8) / 3, 0, 15)`

Unavailable jitter:
`-15`

### Download
- ≥ 50 Mbps: 0
- ≥ 25: -3
- ≥ 10: -7
- ≥ 5: -12
- < 5: -20
- unavailable: -15

### Upload
- ≥ 20 Mbps: 0
- ≥ 10: -3
- ≥ 5: -7
- ≥ 2: -12
- < 2: -15
- unavailable: -12

Final score is rounded and clamped to 0–100.

Labels:
- 90–100: Excellent
- 78–89: Good
- 60–77: Fair
- <60: Poor

Do not change scoring silently. Treat score changes as product/measurement behavior requiring tests and documentation.

## Security score

Only six browser-visible checks are valid in the current design:

1. encrypted page transport — 30 points
2. secure browser context — 20
3. mixed-content exposure — 15
4. configured endpoint transport — 15
5. page embedding — 10
6. Web Crypto availability — 10

Total = 100.

Do not reintroduce removed pseudo-checks such as:
- Wi-Fi encryption
- router security
- DNS integrity
- open ports / LAN threats

A normal browser cannot reliably inspect these.

## Architecture constraints

Preserve unless deliberately redesigning:

- Static site; no backend required for core diagnostics.
- Latency probe is same-origin `/ping.txt`.
- `ping.txt` must bypass the service worker.
- `ping.txt` must have no-store cache headers.
- Service-check timings must not feed latency/jitter/loss.
- Metrics module loads before `app.js`.
- `fast.js` loads after `metrics.js` and before `app.js`.
- Browser restrictions must degrade to `Unavailable` rather than fake data.
- Do not present a CLI or server-side FAST measurement as the visitor's browser
  throughput; using one requires an explicit architecture decision.
- Speed tests remain user-triggered.
- History/settings remain local to the browser.
- HTTPS is the production assumption.
- Canonical production origin is `https://netvitals.net`.
- The Vitals Monitor visual system is defined in `DESIGN.md`; its ECG progress
  trace is decorative, and UI work must avoid AI-dashboard clichés such as blue
  gradients, glassmorphism blur, neon glows, and floating drop-shadow cards.

## Cache/version discipline

`site.css` uses asset version `v=6`, `metrics.js` uses `v=6`, `fast.js` uses `v=1`, `app.js` uses `v=9`, and the service-worker cache is `netvitals-v10`. Bump versions per changed file; do not let a changed file keep an old query string.

When changing cached core CSS/JS:

1. update relevant asset query versions,
2. update service-worker `CACHE`,
3. update precache URLs consistently,
4. run the site validator.

Do not allow old/new core JS to mix across service-worker upgrades.

## Change discipline

Before editing:
- identify the requested behavior,
- route through `docs/FILE_MAP.md`,
- inspect only affected active files,
- check tests protecting that behavior.

After editing:
- run `node --test tests/app.test.js tests/metrics.test.js tests/fast.test.js`,
- run `python3 tests/validate_site.py`,
- perform browser/manual tests when behavior is browser-dependent,
- state what was actually tested,
- synchronize documentation with the validated repository state using the rules below.

## Documentation synchronization — required

Documentation is part of the implementation contract. **After every code/configuration change, explicitly determine whether the repository documentation is still accurate.** Do not finish, commit, merge, or push a task with documentation that describes superseded behavior.

Update the relevant files in the **same change** when implementation changes affect them:

- product purpose, browser/platform constraints, deployment assumptions → `docs/PROJECT_CONTEXT.md`
- measurement architecture, data flow, endpoints, storage, PWA/cache behavior → `docs/ARCHITECTURE.md`
- accepted measurement/design choices and rationale → `docs/DECISIONS.md`
- active files, renamed/moved files, task routing → `docs/FILE_MAP.md`
- test commands, browser matrix, regression expectations → `docs/TESTING.md`
- completed items, newly discovered defects, technical debt, priorities → `docs/TODO.md`
- user-facing capabilities, setup, measurement definitions, deployment → `README.md`
- permanent agent rules, active implementation pointers, measurement truth → `AGENTS.md`

Rules:

1. **Code plus validated runtime behavior/tests are the source of truth.** Documentation must describe the current validated implementation.
2. If code and docs disagree, first determine whether the code change is intentional and validate it. Then update stale docs. Do not change working code merely to satisfy outdated documentation.
3. When a TODO is completed, update/remove that TODO in the same change. Add newly discovered actionable debt when it materially affects future work.
4. When measurement formulas, thresholds, sample counts, endpoints, cache versions, localStorage keys, filenames, browser requirements, security signals, or deployment behavior change, search the relevant docs for stale references and update all affected occurrences.
5. Measurement wording is correctness-critical: keep latency, jitter, request loss, throughput, service checks, and browser-visible security claims synchronized with what the browser actually measures.
6. Do not rewrite unrelated documentation or create doc churn. If a change has no documentation impact, leave docs unchanged.
7. Do not place secrets, private values, or sensitive configuration into documentation.
8. Before completion, review the final diff and explicitly report one of:
   - `Documentation impact: Updated — <files>`
   - `Documentation impact: Not required — <reason>`

A task is not complete when its documentation impact has not been assessed.

## High-risk areas

Require regression tests:

- latency probe target/cache behavior
- sample count/warmups/sequencing
- jitter formula
- request-loss formula
- quality score
- use-case classifications
- Cloudflare transfer sizing/timing
- FAST discovery, target validation, worker scaling, cap, and stability
- security score
- service worker fetch policy
- localStorage schema keys
- report wording
- AdSense/config changes
- canonical/SEO metadata

## Preferred completion format

### Changed
- file + concise change

### Validation
- command/manual test + result

### Measurement impact
- state whether latency/jitter/loss/speed/score semantics changed

### Documentation impact
- `Updated — <files>` or `Not required — <reason>`

### Risks / follow-up
- remaining issues only
