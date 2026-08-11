'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PROBE_PROFILE,
  median,
  calculateJitter,
  summarizeProbeResults,
  hasInternetAccess,
  runProbeSequence
} = require('../assets/js/metrics.js');

test('probe profile matches the approved mobile-first sampling limits', () => {
  assert.deepEqual(PROBE_PROFILE, {
    warmups: 2,
    quickSamples: 8,
    fullSamples: 16,
    spacingMs: 100,
    timeoutMs: 2000
  });
});

test('median handles empty, odd, even, and outlier-heavy samples', () => {
  assert.equal(Number.isNaN(median([])), true);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([16, 16, 17, 17, 18, 18, 19, 92]), 17.5);
  const original = [3, 1, 2];
  median(original);
  assert.deepEqual(original, [3, 1, 2]);
});

test('jitter uses sequential successful sample differences', () => {
  assert.equal(Number.isNaN(calculateJitter([])), true);
  assert.equal(Number.isNaN(calculateJitter([10])), true);
  assert.equal(calculateJitter([10, 14, 11, 15]), 11 / 3);
});

test('probe summary excludes failures from latency and jitter', () => {
  const summary = summarizeProbeResults([
    { ok: true, ms: 10 },
    { ok: false, ms: 2000 },
    { ok: true, ms: 14 },
    { ok: true, ms: 12 }
  ]);
  assert.deepEqual(summary.samples, [10, 14, 12]);
  assert.equal(summary.latency, 12);
  assert.equal(summary.jitter, 3);
  assert.equal(summary.successes, 3);
  assert.equal(summary.failures, 1);
  assert.equal(summary.total, 4);
  assert.equal(summary.loss, 25);
});

test('probe summary excludes failed and non-finite timings across gaps', () => {
  const summary = summarizeProbeResults([
    { ok: true, ms: 10 },
    { ok: false, ms: 11 },
    { ok: true, ms: Number.NaN },
    { ok: true, ms: 16 }
  ]);
  assert.deepEqual(summary.samples, [10, 16]);
  assert.equal(summary.latency, 13);
  assert.equal(summary.jitter, 6);
  assert.equal(summary.failures, 2);
});

test('connectivity requires no explicit offline signal plus probe or service evidence', () => {
  assert.equal(hasInternetAccess(false, 8, 3), false);
  assert.equal(hasInternetAccess(true, 1, 0), true);
  assert.equal(hasInternetAccess(true, 0, 1), true);
  assert.equal(hasInternetAccess(true, 0, 0), false);
});

test('request-loss formula covers the acceptance cases', () => {
  const results = (successes, total) => Array.from(
    { length: total },
    (_, index) => index < successes ? { ok: true, ms: 10 } : { ok: false, ms: 2000 }
  );
  assert.equal(summarizeProbeResults(results(24, 24)).loss, 0);
  assert.ok(Math.abs(summarizeProbeResults(results(23, 24)).loss - (100 / 24)) < 1e-12);
  assert.equal(summarizeProbeResults(results(18, 24)).loss, 25);
  assert.equal(summarizeProbeResults(results(0, 24)).loss, 100);
});

test('quick sequence discards two warm-ups and runs eight measured probes sequentially', async () => {
  const phases = [];
  const progress = [];
  const waits = [];
  let active = 0;
  let maxActive = 0;
  const summary = await runProbeSequence({
    full: false,
    probe: async meta => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      phases.push(meta.phase);
      await Promise.resolve();
      active -= 1;
      return { ok: true, ms: meta.phase === 'warmup' ? 999 : 10 + meta.index };
    },
    wait: async ms => { waits.push(ms); },
    onMeasured: update => { progress.push(update.index); }
  });

  assert.equal(PROBE_PROFILE.warmups, 2);
  assert.equal(phases.filter(phase => phase === 'warmup').length, 2);
  assert.equal(phases.filter(phase => phase === 'measured').length, 8);
  assert.deepEqual(phases, ['warmup', 'warmup', ...Array(8).fill('measured')]);
  assert.equal(summary.total, 8);
  assert.equal(summary.samples.includes(999), false);
  assert.equal(maxActive, 1);
  assert.deepEqual(progress, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(waits, Array(9).fill(100));
});

test('full sequence records sixteen measured probes', async () => {
  let calls = 0;
  let waits = 0;
  const summary = await runProbeSequence({
    full: true,
    probe: async () => {
      calls += 1;
      return { ok: true, ms: 20 };
    },
    wait: async () => { waits += 1; }
  });
  assert.equal(calls, PROBE_PROFILE.warmups + PROBE_PROFILE.fullSamples);
  assert.equal(waits, calls - 1);
  assert.equal(summary.total, 16);
  assert.equal(summary.loss, 0);
});

test('all measured probe failures produce unavailable latency/jitter and 100% loss', async () => {
  const summary = await runProbeSequence({
    probe: async () => ({ ok: false, timeout: true, ms: 2000 }),
    wait: async () => {}
  });
  assert.equal(Number.isNaN(summary.latency), true);
  assert.equal(Number.isNaN(summary.jitter), true);
  assert.equal(summary.loss, 100);
});

test('a rejected measured probe becomes a failed result and the sequence continues', async () => {
  let measured = 0;
  const summary = await runProbeSequence({
    probe: async meta => {
      if (meta.phase === 'warmup') return { ok: true, ms: 1000 };
      measured += 1;
      if (meta.index === 3) throw new Error('simulated failure');
      return { ok: true, ms: 20 + meta.index };
    },
    wait: async () => {}
  });
  assert.equal(measured, PROBE_PROFILE.quickSamples);
  assert.equal(summary.successes, PROBE_PROFILE.quickSamples - 1);
  assert.equal(summary.failures, 1);
  assert.equal(summary.loss, 12.5);
});
