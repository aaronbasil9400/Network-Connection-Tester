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
- Cloudflare throughput tests
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
- `tests/app.test.js`
- `tests/validate_site.py`

## Measurement truth — do not misrepresent

NetVitals does **not** perform ICMP ping, raw packet capture, Wi-Fi security inspection, router inspection, DNS integrity testing, LAN scanning, port scanning, malware detection, or true network-layer packet-loss testing.

Current measurements are:

- **Latency:** median browser HTTP request timing to same-origin `/ping.txt`.
- **Jitter:** mean absolute difference between consecutive successful measured latency samples.
- **Request loss:** percentage of measured `/ping.txt` requests that fail.
- **Download/upload:** browser transfers against `speed.cloudflare.com`.
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
- Browser restrictions must degrade to `Unavailable` rather than fake data.
- Speed tests remain user-triggered.
- History/settings remain local to the browser.
- HTTPS is the production assumption.
- Canonical production origin is `https://netvitals.net`.

## Cache/version discipline

The app currently uses asset version `v=3` and service-worker cache `netvitals-v3`.

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
- run `node --test tests/app.test.js tests/metrics.test.js`,
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
