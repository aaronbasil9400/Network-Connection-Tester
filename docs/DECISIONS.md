# Architecture Decisions

## ADR-001 — Keep the core diagnostic static
**Status:** Accepted

Run the diagnostic in the browser and deploy static assets through CDN hosting.

Do not introduce a framework/backend unless a concrete feature requires it.

---

## ADR-002 — Use a dedicated same-origin HTTP latency target
**Status:** Accepted

Latency uses `/ping.txt`, not configurable service endpoints.

Reason:
- consistent endpoint class,
- avoids mixing third-party geography/server behavior,
- allows explicit cache control.

Consequence:
The result is an HTTP RTT approximation to the NetVitals hosting path, not ICMP ping.

---

## ADR-003 — Warm up before measured latency samples
**Status:** Accepted

Run two warm-up requests and exclude them from latency, jitter, and loss.

Reason:
Reduce first-request effects such as connection establishment.

---

## ADR-004 — Probe sequentially
**Status:** Accepted

Latency requests run one after another with 100 ms spacing.

Reason:
Parallel requests would measure contention/concurrency differently and would make jitter semantics less interpretable.

---

## ADR-005 — Latency is the median
**Status:** Accepted

Use median successful request timing rather than arithmetic mean.

Reason:
Reduce sensitivity to occasional large HTTP outliers.

---

## ADR-006 — Jitter is adjacent successful-sample variation
**Status:** Accepted

Jitter = mean absolute difference between consecutive successful measured timings.

This is an application-level approximation; do not present it as RFC-style RTP jitter unless the implementation is deliberately redesigned.

---

## ADR-007 — Request loss is application-layer failure rate
**Status:** Accepted

Loss = failed measured `/ping.txt` requests / total measured requests.

Never call this raw packet loss.

---

## ADR-008 — Service checks do not contribute to latency/jitter/loss
**Status:** Accepted

Configured external services are reachability signals only.

Reason:
Different endpoints have different routes, server processing times, CORS behavior, and geography.

---

## ADR-009 — Use Cloudflare transfer endpoints for browser throughput
**Status:** Accepted/current implementation

Download/upload use `speed.cloudflare.com` with adaptive payload sizes.

Consequence:
Results depend on the user's route to Cloudflare and browser transfer behavior, so they can differ from Ookla/Fast.com/native tests.

---

## ADR-010 — Quality score is deterministic and transparent
**Status:** Accepted

The scoring formula is hard-coded and documented.

Do not tune thresholds casually because score changes alter product meaning and historical comparability.

---

## ADR-011 — Browser restrictions produce Unavailable, not inferred/fake values
**Status:** Accepted

If battery/network/device APIs are hidden, report the limitation.

---

## ADR-012 — Security assessment is strictly browser-visible
**Status:** Accepted

Only page/context signals are scored.

Removed capabilities must stay removed:
- Wi-Fi encryption status
- router security
- DNS integrity
- LAN threat/open-port inspection

A website cannot reliably provide these from standard browser APIs.

---

## ADR-013 — `/ping.txt` must never be cached
**Status:** Accepted / critical

Protection exists in:
- request cache-busting/no-store,
- Cloudflare `_headers`,
- service-worker bypass.

All three should be preserved.

---

## ADR-014 — User history/settings remain local
**Status:** Accepted

Use localStorage. No server telemetry database is required for core operation.

---

## ADR-015 — PWA cache version and asset versions move together
**Status:** Accepted

When core cached files change, increment query/cache versions consistently to avoid mixed releases.

---

## ADR-016 — Speed tests remain explicit user actions
**Status:** Accepted

Do not run large throughput transfers automatically on page load.

Reason:
Bandwidth/data usage and user expectations.

---

## ADR-017 — NetVitals wording must distinguish measurements from claims
**Status:** Accepted

Reports and UI should continue describing:
- latency as browser HTTP RTT approximation,
- loss as application-layer request loss,
- security as browser-visible signals.

This wording is part of correctness, not just marketing copy.

---

## ADR-018 — Disable unneeded device-location permissions
**Status:** Accepted

`Permissions-Policy` disables camera, microphone, and geolocation.

Reason:
- NetVitals has no current feature that needs these capabilities.
- Keeping them disabled reduces permission surface and prevents accidental dependence on browser/device data outside the product's diagnostic scope.

Consequence:
Any future feature requiring one of these capabilities must justify it, update privacy documentation, and deliberately revise the policy with browser validation.
