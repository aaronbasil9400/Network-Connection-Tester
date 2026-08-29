# Project Context

Reviewed baseline: `main` commit `1de4c4c2c713100de7cbf37556a34476e19aeb3f`.

## Project

**NetVitals** is a mobile-first static web application that measures browser-visible internet connection characteristics without requiring an installed native application or custom backend.

Production identity:
`https://netvitals.net`

## Product objective

Give users a practical diagnostic view of:

- internet reachability
- browser HTTP latency
- jitter
- application-layer request loss
- download throughput
- upload throughput
- browser-visible network information
- device/browser information
- browser-visible security signals
- service endpoint reachability
- practical gaming/calling/streaming/browsing verdicts

The product must be clear about the limits of browser-based measurement.

## Deployment model

Recommended/current architecture:

```text
GitHub repository
      |
      v
Cloudflare Pages
      |
      v
https://netvitals.net
      |
      v
Visitor's browser
       |
       +--> /ping.txt on NetVitals origin
       |
       +--> api.fast.com discovery and validated Netflix OCA targets
       |
       +--> speed.cloudflare.com
      |
      +--> configured HTTPS service endpoints
```

Core diagnostics execute in the browser.

No application server or database is required. FAST discovery and transfer
requests are attempted directly by the browser; the app does not proxy them.
The current production FAST discovery response does not grant CORS access to
`https://netvitals.net`, so Cloudflare fallback remains essential unless the
upstream policy changes.
The community Node.js/Puppeteer `fast-cli` is a separate local tool; running it
on a backend would measure that backend's connection rather than the visitor's.

## Why static hosting fits

The project mainly consists of:
- HTML
- CSS
- JavaScript
- static educational pages
- icons/PWA metadata
- service worker
- static probe asset

This keeps:
- hosting cost low,
- origin architecture simple,
- deployment Git-based,
- server-side attack surface small,
- CDN delivery straightforward.

A backend should only be introduced when a specific feature genuinely requires server-side processing.

## Measurement definitions

### Latency

Sequential HTTP GET timings to:

`/ping.txt`

Each sample prefers Resource Timing (`responseStart - requestStart`) over wall-clock fetch duration; wall clock is the fallback when no timing entry is available.

The result is the **median of successful measured requests**.

This represents browser HTTP round-trip behavior to the NetVitals hosting edge/origin path. It is not ICMP ping.

### Jitter

Mean absolute difference between consecutive successful measured latency timings.

This reflects variation in the successful HTTP probe sequence.

### Request loss

Percentage of measured `/ping.txt` requests that fail.

This is an application-layer request-failure estimate and must not be called raw packet loss.

### Throughput

The browser first attempts FAST/Netflix Open Connect using the public discovery
endpoint `https://api.fast.com/netflix/speedtest/v2`. It validates HTTPS
`*.nflxvideo.net` targets, starts with one worker, scales to at most eight,
aggregates 150 ms progress snapshots with a five-snapshot moving average, and
accepts only stable progress-based estimates. Quick runs stop no later than 12
seconds; Full runs stop no later than 30 seconds. The cumulative FAST attempt
cap is 1 GB across download and upload.

If discovery, CORS, target health, browser progress, or stability checks fail,
the same run uses the Cloudflare fallback. Cloudflare measures fixed-duration
4 s Quick / 8 s Full windows with one discarded warm-up transfer per direction,
four parallel download streams, streamed upload progress, and the adaptive
ramp-up discard (`clamp(2 × median latency, 500, 2000)` ms).

### Service checks

Configured HTTPS endpoints are fetched independently using browser `no-cors` requests.

Their reachability contributes to determining whether internet access exists, but their timings/failures do **not** feed latency, jitter, or request-loss calculations.

## Quick vs Full

Both modes run:
- browser/network state collection,
- latency/jitter/loss sequence,
- service reachability,
- download,
- upload,
- scoring and verdicts.

Difference in latency sampling:
- Quick: 8 measured probes
- Full: 16 measured probes

Both discard 2 initial warm-up probes.

Throughput windows are longer in Full mode for the Cloudflare fallback. FAST
uses its stability-based duration profile in both modes.

## Local state

The browser stores:
- settings
- endpoint configuration
- diagnostic history

in `localStorage`.

History is limited to the last 20 recorded results.

No repository/backend database stores user diagnostic history.

## Browser API variability

Some APIs are intentionally optional:

- Network Information API
- Battery Status API
- device memory
- user-agent client hints

Safari and other browsers may expose less information.

The correct behavior is to show an honest restricted/unavailable state.

## PWA

The site includes:
- manifest
- installable icons
- service worker

The worker caches same-origin application assets for resilience but explicitly bypasses `/ping.txt`, preserving latency-measurement integrity.

## Content/SEO surface

The repository includes:
- About
- How it works
- Privacy
- Terms
- Contact
- educational network guides
- sitemap
- robots.txt

This means code changes can affect both the diagnostic application and a search-indexed content site.

## Monetization

The repository includes Google AdSense integration/configuration.

Advertising must remain separate from diagnostic controls and must not distort measurement behavior or user interpretation.

## Core principle

**Prefer accurate, limited browser-visible measurements over impressive-looking but unsupported claims.**
