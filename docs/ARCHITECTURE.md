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

### Download

Endpoint:

```text
https://speed.cloudflare.com/__down
```

First transfer:
2 MB.

Quick mode remains 2 MB.

Full-mode adaptive transfer:
- first ≥150 Mbps → 25 MB
- ≥60 → 10 MB
- ≥20 → 5 MB
- otherwise 2 MB

Mbps:
`receivedBytes × 8 / elapsedSeconds / 1e6`

### Upload

Endpoint:

```text
https://speed.cloudflare.com/__up
```

First transfer:
1 MB.

Quick mode remains 1 MB.

Full-mode adaptive transfer:
- first ≥80 Mbps → 10 MB
- ≥25 → 5 MB
- ≥8 → 2 MB
- otherwise 1 MB

The browser measures client-side elapsed time for the transfer request.

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
`netvitals-v3`

Core versioned assets:
- `site.css?v=3`
- `metrics.js?v=3`
- `app.js?v=3`

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
