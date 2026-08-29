# Release Checklist

Use this checklist before each public NetVitals release. Record the release date, commit, and any browser checks performed in the pull request or release notes.

## Before merge

- [ ] Review the final diff and confirm measurement wording remains accurate: latency is same-origin browser HTTP RTT; request loss is application-layer request failure; security signals are browser-visible only.
- [ ] Run `node --test tests/app.test.js tests/metrics.test.js`.
- [ ] Run `python3 tests/validate_site.py`.
- [ ] Update tests and documentation for intentional behavior, endpoint, storage, scoring, cache, or user-facing wording changes.
- [ ] If cached core CSS or JavaScript changed, update matching `?v=` asset references, the `netvitals-v*` service-worker cache name, and every related precache URL.
- [ ] Review canonical URLs, metadata, robots rules, and `sitemap.xml` when changing public URLs or indexable content.
- [ ] Confirm the AdSense enablement flag, approval status, consent flow, and privacy disclosures are appropriate for the release.

## Browser and responsive checks

- [ ] Check the affected flow in available mobile browsers: iPhone Safari and Android Chrome.
- [ ] Check the affected flow in available desktop browsers: Chrome, Edge, Firefox, and Safari/macOS.
- [ ] Check relevant widths from 320 px through desktop; ensure controls remain tappable and no horizontal overflow occurs.
- [ ] If PWA or cached assets changed, verify service-worker upgrade, offline-shell behavior, and that `/ping.txt` remains network-only.

## Production smoke checks

- [ ] Confirm `https://netvitals.net/ping.txt` returns HTTP 200, body exactly `ok`, no redirect, and `Cache-Control`/`CDN-Cache-Control` no-store behavior.
- [ ] In browser DevTools, confirm diagnostic `/ping.txt` requests have unique query strings and do not come from the service-worker, memory, or disk cache.
- [ ] Run one Quick check and one Full diagnostic; verify measured-probe counts and clear unavailable/failure states.
- [ ] Smoke-test Cloudflare download and upload transfers, including a clean failure state if the endpoint is unavailable.
- [ ] Smoke-test FAST discovery from the deployed origin; verify automatic Cloudflare fallback when CORS, target health, progress, or stability evidence is unavailable.
- [ ] Confirm the FAST attempt's cumulative 1 GB cap and provider label/report wording.
- [ ] Confirm production pages, canonical links, navigation, manifest, and icons load without console errors.

## Release handoff

- [ ] Record any intentionally deferred risks or browser-specific behavior in `docs/TODO.md`.
- [ ] Verify the deployed commit is the reviewed commit.
