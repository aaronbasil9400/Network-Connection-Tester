# NetVitals

NetVitals is a static, mobile-first browser diagnostic for internet reachability, HTTP latency, jitter, application-layer request loss, browser throughput, browser-visible connection information, device information, and browser-visible security signals. Throughput uses FAST/Netflix Open Connect as the primary browser path when available and switches automatically to Cloudflare when the primary path is unavailable or unstable.

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
  +--> api.fast.com and validated *.nflxvideo.net targets
  +--> speed.cloudflare.com
  +--> configured HTTPS service checks
```

The core diagnostic runs entirely in the visitor's browser. No application backend or database is required.

### FAST CLI distinction

The community [`fast-cli`](https://github.com/sindresorhus/fast-cli) project is
not a drop-in browser library. It uses Node.js and Puppeteer to run FAST.com
from the machine where the command is installed:

```bash
npm install --global fast-cli
fast --upload --json
```

Running that command on a server would measure the server's connection, not the
visitor's. A static browser page cannot invoke a visitor's local CLI, and the
CLI does not grant `https://netvitals.net` permission to read the separate
`api.fast.com` response. NetVitals therefore keeps its direct browser adapter
and automatic Cloudflare fallback. A server-side relay would be a deliberate
architecture change and would need separate operational and third-party-policy
review.

## What it measures

### Latency
Median successful sample timing to same-origin `/ping.txt`. Samples prefer Resource Timing (`responseStart - requestStart`) over wall-clock fetch duration.

This is **not ICMP ping**.

### Jitter
Mean absolute difference between consecutive successful measured latency timings.

### Request loss
Percentage of measured `/ping.txt` requests that fail.

This is **application-layer request loss**, not raw packet loss.

### Download / upload
The diagnostic first attempts direct browser transfers to validated Netflix Open Connect targets discovered through `api.fast.com`. The primary path starts with one worker, grows to at most eight workers from aggregate-speed thresholds, samples progress every 150 ms, and stops after a stable estimate or its bounded duration. It requires stable progress-based estimates in both directions and caps the combined FAST attempt at 1 GB.

If discovery, CORS, target health, browser progress, or stability checks fail, the same user action continues automatically with the Cloudflare fallback. Cloudflare uses a 4 s (Quick) or 8 s (Full) fixed-duration window, four parallel download streams, streamed upload progress, an adaptive ramp discard (`clamp(2 × median latency, 500, 2000)` ms), and a 250 MB cap per direction. The selected provider is shown in the result and report; values from different providers are not compared as if they used the same route.

The current `api.fast.com` discovery response does not grant CORS access to `https://netvitals.net`, so the production site currently exercises the Cloudflare fallback. No proxy is used; FAST becomes active only if the upstream browser-access policy permits the deployed origin.

For the browser path, CORS means Cross-Origin Resource Sharing. Because
`netvitals.net` and `api.fast.com` are different origins, the FAST discovery
response must include an `Access-Control-Allow-Origin` header for
`https://netvitals.net`. This is controlled by the FAST endpoint, not by the
NetVitals static files.

### Security
Only signals visible to a normal web page, such as HTTPS/secure context, mixed content, endpoint transport, embedding, and Web Crypto availability.

NetVitals cannot directly inspect Wi-Fi encryption, router configuration, LAN devices, open ports, DNS integrity, or malware.

## Quick and Full modes

Measurement profile:

The fixed-window rows below describe the Cloudflare fallback. FAST uses its
stability-based profile shown in the additional rows.

| | Quick | Full |
|---|---:|---:|
| Warm-up latency probes | 2 | 2 |
| Measured latency probes | 8 | 16 |
| Probe spacing | 100 ms | 100 ms |
| Probe timeout | 2000 ms | 2000 ms |
| Download window | 4 s | 8 s |
| Upload window | 4 s | 8 s |
| Parallel download streams | 4 | 4 |
| FAST maximum duration | 12 s | 30 s |
| FAST stable-after threshold | 7 s | 7 s |
| FAST worker range | 1–8 | 1–8 |
| FAST cumulative attempt cap | 1 GB | 1 GB |
| Cloudflare fallback cap | 250 MB per direction | 250 MB per direction |

Warm-ups are discarded from latency, jitter and request-loss calculations. The FAST path uses progress-driven stability; the Cloudflare fallback uses one discarded warm-up transfer per direction and excludes the adaptive ramp-up period (`clamp(2 × median latency, 500, 2000)` ms) from its measured window.

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
│   │   ├── fast.js
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
│   ├── fast.test.js
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
node --test tests/app.test.js tests/metrics.test.js tests/fast.test.js
python3 tests/validate_site.py
```

The validator checks site structure, JavaScript syntax, PWA/probe cache rules, metadata, AdSense consistency, and all Node tests, including the FAST adapter tests.

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
