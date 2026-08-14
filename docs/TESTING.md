# Testing Strategy

## Existing automated checks

The repository already has useful dependency-light tests.

Run from repository root:

```bash
node --test tests/app.test.js tests/metrics.test.js
python tests/validate_site.py
```

`validate_site.py` also invokes Node syntax checks and the test files, so it is the main repository validation gate.

## Metric tests

`tests/metrics.test.js` protects:

- exact probe profile
- median behavior
- jitter formula
- exclusion of failed/non-finite samples
- loss calculation
- internet-access evidence
- two warm-up probes
- Quick = 8 measured probes
- Full = 16 measured probes
- sequential operation
- continuation after a failed/rejected probe

Any change to measurement semantics must update tests intentionally.

## App contract tests

`tests/app.test.js` protects:

- exactly six browser-visible security checks
- security weights total 100
- removed unsupported security checks stay removed
- latency-quality probe remains separate from service checks
- latency remains same-origin `/ping.txt`
- no-store/cache-busting behavior
- non-OK/body validation
- report wording remains accurate

## Static/site validator

`tests/validate_site.py` checks:

- HTML duplicate IDs
- title/meta description
- author metadata
- canonical URL
- branding
- visible developer credit
- AdSense script/client consistency
- manifest JSON
- sitemap XML
- icon presence
- `ads.txt`
- core script order/version
- `ping.txt` content
- `_headers` no-store rule
- service-worker ping bypass
- service-worker precache
- legacy/removed behavior
- JS syntax
- Node tests

## Manual browser matrix

For diagnostic releases, test where available:

### Mobile
- iPhone Safari
- Android Chrome

### Desktop
- Chrome
- Edge
- Firefox
- Safari/macOS

Expected differences:
- Battery may be unavailable.
- Network Information API may be unavailable.
- device memory may be unavailable.
- install/PWA behavior differs.

Unavailable APIs are not failures if the UI handles them clearly.

## Viewport validation

At minimum check:
- 320
- 350
- 375
- 390
- 430
- 768
- 1024+ px

Verify:
- no horizontal page overflow,
- settings remain usable,
- controls are tappable,
- charts fit,
- long endpoint URLs do not break layout,
- ad containers do not obscure controls.

## Latency correctness test

Use production HTTPS or localhost.

Verify DevTools Network for every `/ping.txt` request:
- unique query string
- status OK
- transfer is from network
- not service-worker cache
- not memory cache
- not disk cache

Verify:
- Quick has 2 warmups + 8 measured calls,
- Full has 2 warmups + 16 measured calls.

Only the measured calls should affect reported latency/loss.

## Jitter validation

With controlled test samples, expected:

```text
samples: 10, 14, 11, 15
differences: 4, 3, 4
jitter: 11 / 3 = 3.666...
```

Failures are removed before sequential-successful-sample variation is calculated.

## Request-loss validation

Examples:

- 8/8 successes → 0%
- 7/8 → 12.5%
- 12/16 → 25%
- 0 successes → 100%

Do not compare this directly with ICMP packet-loss tools as if they are equivalent.

## Throughput validation

Test:
- Quick download/upload
- Full adaptive transfer
- slow connection
- fast connection
- blocked `speed.cloudflare.com`
- request timeout/failure

Verify the UI reports `Unavailable/Failed` cleanly when the external endpoint cannot be used.

Compare against a conventional speed test only as a sanity check; different endpoint geography, connection reuse, payload sizing and methodology can produce different results.

## Service-check validation

Test:
- all defaults reachable
- one bad URL
- timeout
- browser offline
- user-added endpoint
- invalid/non-HTTPS endpoint

Configured service results must not change latency/jitter/loss sample statistics.

## Quality-score regression

Use fixture-like values and verify exact score.

Example dimensions to cover:
- excellent all-round
- high latency only
- high jitter only
- request loss
- poor download
- poor upload
- unavailable speed test
- internet false → score 10

Any score formula change should be treated as a documented behavior change.

## Security regression

Validate:
- HTTPS production
- localhost
- insecure HTTP dev host
- iframe embedding
- mixed HTTP resource where browser permits observation
- no configured endpoints
- non-HTTPS configured endpoint input handling

Do not add tests for browser-invisible router/Wi-Fi properties.

## PWA/cache regression

After changing core assets:
- bump cache/asset versions together,
- unregister old worker or test upgrade from previous version,
- verify new worker activates,
- verify offline shell still works,
- verify `/ping.txt` remains network-only.

## Definition of Done

A diagnostic change is complete when:
- targeted automated tests pass,
- site validator passes,
- relevant browser scenarios are checked,
- measurement semantics are documented,
- no unsupported security/network claims are introduced,
- PWA cache versions are coherent,
- UI works on mobile widths.
