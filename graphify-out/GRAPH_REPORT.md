# Graph Report - Network-Connection-Tester  (2026-08-29)

## Corpus Check
- 18 files · ~17,938 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 283 nodes · 323 edges · 18 communities (16 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `84e4e8b8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- Architecture
- TODO / Technical Debt
- AGENTS.md
- File Map
- Architecture Decisions
- Testing Strategy
- Project Context
- NetVitals
- metrics.test.js
- Active implementation
- app.test.js
- SiteHTMLParser
- Release Checklist
- service-worker.js

## God Nodes (most connected - your core abstractions)
1. `Architecture Decisions` - 22 edges
2. `runChecks()` - 18 edges
3. `Architecture` - 17 edges
4. `Testing Strategy` - 16 edges
5. `NetVitals` - 13 edges
6. `Project Context` - 13 edges
7. `Active implementation` - 10 edges
8. `File Map` - 9 edges
9. `setPill()` - 8 edges
10. `runSpeedTests()` - 8 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (18 total, 2 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.08
Nodes (45): browserName(), buildReport(), clamp(), classForStatus(), classifyUseCase(), clone(), defaults, detectDevice() (+37 more)

### Community 1 - "Architecture"
Cohesion: 0.07
Nodes (27): `app.test.js`, Architecture, Browser storage, Cache protection, Device/network information, Diagnostic orchestration, Download, Hosting headers (+19 more)

### Community 2 - "TODO / Technical Debt"
Cohesion: 0.07
Nodes (27): [ ] Add browser end-to-end tests, [ ] Add CI, [ ] Add deployment health monitoring, [ ] Add direct tests for use-case verdict thresholds, [ ] Add direct unit coverage for the quality-score formula, [ ] Add explicit test metadata to shared report, [ ] Add loaded-latency / responsiveness testing, [ ] Add multi-reference latency as a separate metric, not a replacement (+19 more)

### Community 3 - "AGENTS.md"
Cohesion: 0.08
Nodes (23): Architecture constraints, Cache/version discipline, Change discipline, Changed, Context-loading rule, Documentation impact, Documentation synchronization — required, Download (+15 more)

### Community 4 - "File Map"
Cohesion: 0.08
Nodes (24): `assets/css/site.css`, `assets/js/ads.js`, `assets/js/app.js`, `assets/js/config.js`, `assets/js/metrics.js`, `assets/js/pwa.js`, Configuration / integrations, Content pages (+16 more)

### Community 5 - "Architecture Decisions"
Cohesion: 0.09
Nodes (22): ADR-001 — Keep the core diagnostic static, ADR-002 — Use a dedicated same-origin HTTP latency target, ADR-003 — Warm up before measured latency samples, ADR-004 — Probe sequentially, ADR-005 — Latency is the median, ADR-006 — Jitter is adjacent successful-sample variation, ADR-007 — Request loss is application-layer failure rate, ADR-008 — Service checks do not contribute to latency/jitter/loss (+14 more)

### Community 6 - "Testing Strategy"
Cohesion: 0.10
Nodes (19): App contract tests, Definition of Done, Desktop, Existing automated checks, Jitter validation, Latency correctness test, Manual browser matrix, Metric tests (+11 more)

### Community 7 - "Project Context"
Cohesion: 0.11
Nodes (18): Browser API variability, Content/SEO surface, Core principle, Deployment model, Jitter, Latency, Local state, Measurement definitions (+10 more)

### Community 8 - "NetVitals"
Cohesion: 0.11
Nodes (18): AI agent workflow, Architecture, Automated validation, Critical accuracy rule, Deployment, Development, Documentation, Download / upload (+10 more)

### Community 9 - "metrics.test.js"
Cohesion: 0.32
Nodes (10): aggregateThroughput(), calculateJitter(), hasInternetAccess(), median(), runProbeSequence(), steadyStateThroughput(), summarizeProbeResults(), assert (+2 more)

### Community 10 - "Active implementation"
Cohesion: 0.20
Nodes (10): Active implementation, Diagnostic controller, Hosting/cache rules, Latency target, Main application page, Measurement module, PWA, Runtime configuration (+2 more)

### Community 11 - "app.test.js"
Cohesion: 0.25
Nodes (6): appPath, assert, fs, path, source, test

### Community 13 - "Release Checklist"
Cohesion: 0.33
Nodes (5): Before merge, Browser and responsive checks, Production smoke checks, Release Checklist, Release handoff

## Knowledge Gaps
- **177 isolated node(s):** `defaults`, `state`, `ids`, `els`, `ASSETS` (+172 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Active implementation` connect `Active implementation` to `AGENTS.md`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `defaults`, `state`, `ids` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `TODO / Technical Debt` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `AGENTS.md` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `File Map` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._