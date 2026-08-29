# Architecture

Reviewed baseline: `main` commit `1de4c4c2c713100de7cbf37556a34476e19aeb3f`.

## Runtime architecture

```text
                         NetVitals static site
                     Cloudflare Pages / HTTPS
                              |
           +------------------+------------------+
           |                  |                  |
           v                  v                  v
       index.html       service-worker.js    /ping.txt
           |
            +--> metrics.js
            |
            +--> fast.js
            |
            +--> app.js
           |
           +--> config.js / ads.js / pwa.js
           |
           +---------------------------------------------+
           |                      |                      |
           v                      v                      v
same-origin latency       speed.cloudflare.com   service endpoints
     HTTP probes            fallback transfers       no-cors fetch
                               ^
                               |
                    api.fast.com + Netflix OCA
```

## `metrics.js`

This is the measurement-core module and intentionally works in both:
- browser global context,
- Node CommonJS tests.

Exports:

- `PROBE_PROFILE`
- `median`
- `calculateJitter`
- `summarizeProbeResults`
- `hasInternetAccess`
- `runProbeSequence`

### Probe profile

```text
warmups      2
quick        8 measured samples
full         16 measured samples
spacing      100 ms
timeout      2000 ms
```

### Probe sequence

Calls are sequential, not parallel.

```text
warmup
warmup
    ↓ discarded
measured #1
100 ms
measured #2
...
```

Only measured requests enter the returned summary.

### Summary

Successful finite timings become `samples`.

Latency:
median(samples)

Jitter:
mean absolute difference between adjacent successful sample values.

Failures:
measured results that are failed or do not contain a finite successful timing.

Loss:
`failures / total × 100`

## Same-origin latency probe

Implemented in `app.js`.

Each measurement requests:

```text
/ping.txt?_=<unique-cache-buster>
```

with:
- GET
- `cache: no-store`
- timeout
- omitted credentials

Response requirements:
- HTTP OK
- body trimmed exactly to `ok`

Sample capture prefers Resource Timing: after a successful probe, `resourceTimingRtt()` reads `responseStart - requestStart` from the matching resource entry (same-origin requests expose full detail). If no finite entry exists, the sample falls back to wall-clock fetch duration and records its timing source (`timing` or `clock`). The resource-timing buffer is raised once at startup so entries survive page activity. See ADR-020.

This deliberately isolates the network-quality probe from configurable third-party service checks.

The displayed value is specific to the route between the visitor's browser and the NetVitals hosting path. It can differ substantially from ICMP ping, a game server, an Ookla server, or an ISP gateway, which use different routes and/or measurement methods.

## Cache protection

`_headers` gives `/ping.txt`:

```text
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
CDN-Cache-Control: no-store
```

`service-worker.js` also returns before `respondWith()` when path is `/ping.txt`.

Both controls matter. Browser/service-worker/CDN caching would corrupt latency results.

## Service reachability

Default configured services:
- Cloudflare
- Google
- Microsoft

`serviceProbe()` performs a cache-busted `no-cors` GET.

The check is a pragmatic browser reachability signal, not an HTTP status/content validation.

Service checks are kept separate from the dedicated latency sequence.

## Internet-access determination

`hasInternetAccess()` requires:

- browser is not explicitly offline, and
- at least one successful latency probe **or** at least one reachable configured service.

This avoids relying solely on `navigator.onLine`.

## Throughput

The app attempts FAST/Netflix Open Connect first and automatically uses
Cloudflare if the FAST attempt is unavailable or sketchy. The provider is
recorded on the result and report. Provider values are not treated as the same
route for history deltas.

### Cloudflare fallback profile

Cloudflare throughput remains duration-based, not size-based. The profile is
defined in `metrics.js` as `SPEED_PROFILE`:

| Constant | Value |
|---|---:|
| quickDurationMs | 4000 |
| fullDurationMs | 8000 |
| rampDiscardMs | 500 (lower bound) |
| minWindowMs | 1000 |
| settleMs | 600 |
| downloadStreams | 4 |
| downloadChunkBytes | 50 MB |
| uploadChunkBytes | 32 MB |
| maxQuickBytes / maxFullBytes | 250 MB / 250 MB |

### Download

Endpoint:

```text
https://speed.cloudflare.com/__down
```

Sequence per run:
1. one discarded warm-up request (1 MB) establishes the connection/route,
2. `SPEED_PROFILE.downloadStreams` (4) parallel stream loops each issue repeated streamed requests (`res.body.getReader()`, 50 MB chunks) until the shared window elapses or the shared data cap is reached,
3. all streams append into one cumulative byte timeline; the measurement clock starts at the **first received byte on any stream**, so DNS/TCP/TLS setup is excluded by construction,
4. an adaptive ramp-up period (`clamp(2 × measured median latency, 500, 2000)` ms) is discarded as TCP slow-start.

Mbps (steady state):

The post-ramp timeline is bucketed into per-second rates and the **median** of those rates is reported:

`median((bytesSecond_k × 8) / 1e6)`

The reported value is the **median sustained rate across the parallel streams**, not single-flow throughput. A single sequential transfer systematically underestimates fast or high-latency paths and leaves drain gaps between chunk requests; parallel streams match how mainstream testers behave. If the measured window is shorter than `minWindowMs` (1000 ms), the result falls back to the post-first-byte average over the whole received stream; if no usable data was received, the phase reports `Failed`.

### Upload

Endpoint:

```text
https://speed.cloudflare.com/__up
```

Upload streams a continuous body via `XMLHttpRequest` and reads `upload.onprogress` to build the same cumulative byte timeline:

1. one discarded warm-up POST,
2. sequential 32 MB `xhr.send` bodies whose `upload.onprogress` deltas append into the timeline until the window elapses or the cap is reached (the in-flight body is aborted mid-stream when either bound is hit),
3. the same adaptive ramp discard and per-second median as download.

If progress events never fire (e.g., a browser/environment that suppresses them), upload falls back to `aggregateThroughput` over the completed POSTs.

### Stability controls

- 600 ms settle pause before the download phase and between download/upload phases.
- A watchdog abort timer (`window + 20 s`) bounds the whole phase; partial data is still reported when the abort lands after enough bytes were transferred.
- Data caps keep mobile usage bounded even on very fast connections.

### FAST/Netflix primary profile

`fast.js` uses the browser-visible flow observed in the current FAST.com client,
without loading FAST.com code or telemetry:

1. Fetch `https://api.fast.com/netflix/speedtest/v2` with the public client
   parameters and parse only HTTPS `*.nflxvideo.net` targets containing a
   speedtest path.
2. Convert each target to an inclusive-corrected `/speedtest/range/0-N`
   request path while preserving its query parameters.
3. Start one XHR worker and add workers up to eight as aggregate progress
   crosses the configured speed thresholds.
4. Record progress every 150 ms and calculate a moving average over the latest
   five byte/time snapshots.
5. Stop after at least seven seconds when six recent estimates remain within
   2%, or at the Quick 12-second / Full 30-second maximum.
6. Accept the result only when both download and upload are finite, stable,
   and progress-based. A cumulative 1 GB cap covers both directions of the
   FAST attempt.

Each request is limited to 25 MiB, active request sizes reserve the remaining
FAST budget before starting, and progress is fed into the estimator as it
arrives. Failed HTTP/timeout transfers roll back provisional bytes; failed or
progress-free targets are quarantined for the rest of the attempt. Discovery
has a nine-second timeout.

The endpoint is undocumented and currently does not return an
`Access-Control-Allow-Origin` header for `https://netvitals.net`; therefore a
production browser normally reaches the Cloudflare fallback. No proxy is part
of the current static architecture.

### CLI versus browser execution

The community `sindresorhus/fast-cli` project uses Node.js and Puppeteer to
drive FAST.com from the machine running the command. It is useful as a local
CLI, but it cannot be invoked by a static page on a visitor's device. Running
it in a backend would measure that backend's network rather than the visitor's
and would introduce a different architecture. It also does not change browser
CORS rules for NetVitals' direct `api.fast.com` request.

CORS (Cross-Origin Resource Sharing) is the browser policy that controls
whether JavaScript from one origin may read a response from another. The FAST
discovery response must grant `https://netvitals.net` with
`Access-Control-Allow-Origin`; NetVitals cannot add that response header from
its own static files.

## Diagnostic orchestration

`runChecks(full)` sequence:

```text
start
 |
 +--> browser/device/network state
 |
 +--> security assessment
 |
 +--> dedicated latency/jitter/loss probes
 |
 +--> configured service checks
 |
  +--> FAST/Netflix download and upload attempt
  |       |
  |       +--> Cloudflare download/upload fallback when needed
 |
 +--> internet-access decision
 |
 +--> quality score
 |
 +--> use-case verdicts
 |
 +--> history/charts
 |
 +--> report-ready state
```

If the browser reports offline, transfer work is skipped.

If the browser reports online but FAST discovery or either FAST direction is
unavailable, the Cloudflare fallback runs without an additional user choice.

## Quality scoring

Base: 100.

Maximum penalty categories:
- request loss: 35
- latency: 20
- jitter: 15
- download: 20
- upload: 15

Because category penalties can sum above 100, final score is clamped to 0–100.

Download and upload penalties use the selected provider's accepted result. The
formula is unchanged when the provider changes; the provider label is retained
so results remain interpretable.

If internet access is false, score is directly set to 10.

See `AGENTS.md` for exact thresholds.

## Use-case classifications

The UI separately classifies:
- gaming
- video calls
- streaming
- browsing

These are threshold-based and are not the same as the global quality score.

Gaming emphasizes latency/jitter/loss.

Video calls include latency/jitter plus upstream/downstream bandwidth.

Streaming emphasizes download and loss.

Browsing emphasizes download and loss.

## Security assessment

Browser-visible only.

Signals:
- HTTPS/local trusted context
- `isSecureContext`
- observed HTTP subresources
- configured endpoint HTTPS usage
- top-level versus embedded page
- Web Crypto availability

It does not assess the user's router or Wi-Fi encryption.

## Device/network information

Best-effort browser APIs:
- user agent/platform
- hardware concurrency
- device memory where exposed
- screen/viewport
- pixel ratio
- orientation
- Network Information API where exposed
- Battery API where exposed

Missing APIs degrade gracefully.

## Browser storage

Settings key:
`phone-status-app-v3`

History key:
`phone-status-history-v4`

History retains the last 20 records.

The storage-key names are legacy implementation identifiers; changing them can reset users' stored settings/history.

## PWA cache

Current cache:
`netvitals-v8`

Core versioned assets:
- `site.css?v=4`
- `metrics.js?v=6`
- `fast.js?v=1`
- `app.js?v=8`

A release that changes these files should update cache/versioning consistently.

## Hosting headers

`_headers` currently sets:
- `X-Content-Type-Options: nosniff`
- strict-origin referrer policy
- camera/microphone/geolocation disabled
- one-day cache for assets
- no-cache for service worker
- no-store for latency probe

### Permissions Policy rationale

The `Permissions-Policy` disables camera, microphone, and geolocation. NetVitals has no feature requiring those capabilities, and disabling them reduces unnecessary permission surface for a browser-based diagnostic. Do not relax this policy unless a new, documented feature requires the corresponding capability and its privacy implications have been reviewed.

## Testing architecture

### `metrics.test.js`
Behavioral unit tests for measurement math and sequence semantics.

### `app.test.js`
Source-contract tests protecting critical browser-visible security, probe
architecture, provider fallback, and report wording.

### `fast.test.js`
Behavioral tests for FAST discovery/target validation, range construction,
moving-average and stability math, worker thresholds, cumulative cap behavior,
and credible result requirements.

### `validate_site.py`
Repository/site validator covering:
- HTML metadata
- duplicate IDs
- canonical URL
- AdSense consistency
- manifest/sitemap/icons
- ping/cache requirements
- service-worker behavior
- JS syntax
- Node tests
