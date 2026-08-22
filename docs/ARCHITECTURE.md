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
           +--> app.js
           |
           +--> config.js / ads.js / pwa.js
           |
           +---------------------------------------------+
           |                      |                      |
           v                      v                      v
same-origin latency       speed.cloudflare.com   service endpoints
    HTTP probes            download / upload       no-cors fetch
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

Throughput is duration-based, not size-based. Both directions measure a fixed time window against Cloudflare and report a steady-state rate. The profile is defined in `metrics.js` as `SPEED_PROFILE`:

| Constant | Value |
|---|---:|
| quickDurationMs | 4000 |
| fullDurationMs | 8000 |
| rampDiscardMs | 500 |
| minWindowMs | 1000 |
| settleMs | 600 |
| downloadChunkBytes | 25 MB |
| uploadChunkBytes | 2 MB |
| maxQuickBytes / maxFullBytes | 60 MB / 250 MB |

### Download

Endpoint:

```text
https://speed.cloudflare.com/__down
```

Sequence per run:
1. one discarded warm-up request (1 MB) establishes the connection/route,
2. repeated streamed requests (`res.body.getReader()`, 25 MB chunks) until the window elapses or the data cap is reached,
3. the measurement clock starts at the **first received byte**, so DNS/TCP/TLS setup is excluded by construction,
4. the first 500 ms of the window is discarded as TCP slow-start ramp-up.

Mbps (steady state):

`(bytesAfterRamp × 8) / secondsAfterRamp / 1e6`

If the measured window is shorter than `minWindowMs` (1000 ms), the result falls back to the post-first-byte average over the whole received stream; if no usable data was received, the phase reports `Failed`.

### Upload

Endpoint:

```text
https://speed.cloudflare.com/__up
```

The browser cannot observe upload progress mid-request, so upload measures repeated fixed-size POSTs (2 MB each):

1. one discarded warm-up POST,
2. sequential POSTs until the window elapses or the cap is reached,
3. aggregate Mbps = summed POST bytes × 8 / summed elapsed seconds.

### Stability controls

- 600 ms settle pause before the download phase and between download/upload phases.
- A watchdog abort timer (`window + 20 s`) bounds the whole phase; partial data is still reported when the abort lands after enough bytes were transferred.
- Data caps keep mobile usage bounded even on very fast connections.

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
 +--> download
 |
 +--> upload
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

## Quality scoring

Base: 100.

Maximum penalty categories:
- request loss: 35
- latency: 20
- jitter: 15
- download: 20
- upload: 15

Because category penalties can sum above 100, final score is clamped to 0–100.

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
`netvitals-v4`

Core versioned assets:
- `site.css?v=4`
- `metrics.js?v=4`
- `app.js?v=4`

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
Source-contract tests protecting critical browser-visible security and probe architecture/report wording.

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
