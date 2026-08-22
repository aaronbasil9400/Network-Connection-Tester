# NetVitals

NetVitals is a static, mobile-first browser diagnostic for internet reachability, HTTP latency, jitter, application-layer request loss, fixed-duration download/upload throughput windows against Cloudflare, browser-visible connection information, device information, and browser-visible security signals.

Production site:

`https://netvitals.net`

## Architecture

```text
GitHub
  |
  v
Cloudflare Pages
  |
  v
NetVitals in browser
  |
  +--> same-origin /ping.txt
  +--> speed.cloudflare.com
  +--> configured HTTPS service checks
```

The core diagnostic runs entirely in the visitor's browser. No application backend or database is required.

## What it measures

### Latency
Median successful browser HTTP request timing to same-origin `/ping.txt`.

This is **not ICMP ping**.

### Jitter
Mean absolute difference between consecutive successful measured latency timings.

### Request loss
Percentage of measured `/ping.txt` requests that fail.

This is **application-layer request loss**, not raw packet loss.

### Download / upload
Fixed-duration streamed transfers using Cloudflare speed-test endpoints.

Each direction runs a 4 s (Quick) or 8 s (Full) measurement window after one discarded warm-up transfer. The download clock starts at the first received byte (connection setup excluded) and the first 500 ms of the window is discarded as TCP ramp-up, so the reported value is a steady-state rate rather than an average that includes connection startup.

### Security
Only signals visible to a normal web page, such as HTTPS/secure context, mixed content, endpoint transport, embedding, and Web Crypto availability.

NetVitals cannot directly inspect Wi-Fi encryption, router configuration, LAN devices, open ports, DNS integrity, or malware.

## Quick and Full modes

Measurement profile:

| | Quick | Full |
|---|---:|---:|
| Warm-up latency probes | 2 | 2 |
| Measured latency probes | 8 | 16 |
| Probe spacing | 100 ms | 100 ms |
| Probe timeout | 2000 ms | 2000 ms |
| Download window | 4 s | 8 s |
| Upload window | 4 s | 8 s |
| Throughput data cap | 60 MB | 250 MB |

Warm-ups are discarded from latency, jitter and request-loss calculations. Each throughput direction discards one warm-up transfer, and the download result excludes the first 500 ms ramp-up of the measured window.

## Project structure

```text
.
├── AGENTS.md
├── README.md
├── index.html
├── assets/
│   ├── css/site.css
│   ├── js/
│   │   ├── app.js
│   │   ├── metrics.js
│   │   ├── config.js
│   │   ├── ads.js
│   │   └── pwa.js
│   └── icons/
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── FILE_MAP.md
│   ├── RELEASE_CHECKLIST.md
│   ├── TESTING.md
│   └── TODO.md
├── tests/
│   ├── app.test.js
│   ├── metrics.test.js
│   └── validate_site.py
├── manifest.webmanifest
├── service-worker.js
├── ping.txt
├── _headers
├── robots.txt
├── sitemap.xml
└── ads.txt
```

## Development

Run locally:

```bash
python3 -m http.server 8080
```

Then open:

`http://localhost:8080`

## Automated validation

```bash
node --test tests/app.test.js tests/metrics.test.js
python3 tests/validate_site.py
```

The validator checks site structure, JavaScript syntax, PWA/probe cache rules, metadata, AdSense consistency, and the Node tests.

## Critical accuracy rule

`/ping.txt` must always be fetched from the network.

The project protects this through:
- cache-busting query strings,
- browser `cache: no-store`,
- Cloudflare `_headers`,
- explicit service-worker bypass.

Do not cache the latency probe.

## PWA release rule

Core assets currently use versioned `?v=` URLs and a matching service-worker cache version.

When changing cached core CSS/JS, update the asset and service-worker cache versions consistently.

## Deployment

The project is designed for static deployment from GitHub to Cloudflare Pages.

No framework build step is required for the current architecture.

## AI agent workflow

Agents should start at:

`AGENTS.md`

Then use `docs/FILE_MAP.md` to inspect only the source files relevant to the task.

This is intentionally designed to reduce unnecessary repository rereading and token consumption.

## Documentation

- `docs/PROJECT_CONTEXT.md` — product and browser constraints
- `docs/ARCHITECTURE.md` — measurement/data flow
- `docs/DECISIONS.md` — why the system works this way
- `docs/FILE_MAP.md` — task-to-file routing
- `docs/RELEASE_CHECKLIST.md` — pre-release verification
- `docs/TESTING.md` — validation strategy
- `docs/TODO.md` — technical debt and roadmap

## Ownership

Developed by Aaron Basil Raj.

Add/confirm the desired software license before granting reuse rights.
