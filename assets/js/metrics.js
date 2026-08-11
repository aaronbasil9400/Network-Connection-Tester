(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NetVitalsMetrics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PROBE_PROFILE = Object.freeze({
    warmups: 2,
    quickSamples: 8,
    fullSamples: 16,
    spacingMs: 100,
    timeoutMs: 2000
  });

  function median(values) {
    if (!values.length) return NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function calculateJitter(samples) {
    if (samples.length < 2) return NaN;
    let totalDifference = 0;
    for (let i = 1; i < samples.length; i += 1) {
      totalDifference += Math.abs(samples[i] - samples[i - 1]);
    }
    return totalDifference / (samples.length - 1);
  }

  function summarizeProbeResults(results) {
    const samples = results
      .filter(result => result?.ok && Number.isFinite(result.ms))
      .map(result => result.ms);
    const total = results.length;
    const successes = samples.length;
    const failures = total - successes;
    return {
      samples,
      latency: median(samples),
      jitter: calculateJitter(samples),
      failures,
      successes,
      total,
      loss: total ? (failures / total) * 100 : 100
    };
  }

  function hasInternetAccess(browserOnline, probeSuccesses, reachableServices) {
    return browserOnline !== false && (probeSuccesses > 0 || reachableServices > 0);
  }

  async function runProbeSequence({ probe, full = false, wait, onMeasured } = {}) {
    if (typeof probe !== 'function') throw new TypeError('probe must be a function');
    const sleep = wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const measuredCount = full ? PROBE_PROFILE.fullSamples : PROBE_PROFILE.quickSamples;

    const totalCalls = PROBE_PROFILE.warmups + measuredCount;
    const results = [];
    for (let callIndex = 0; callIndex < totalCalls; callIndex += 1) {
      const isWarmup = callIndex < PROBE_PROFILE.warmups;
      const index = isWarmup ? callIndex : callIndex - PROBE_PROFILE.warmups;
      let result;
      try {
        result = await probe({
          phase: isWarmup ? 'warmup' : 'measured',
          index,
          total: isWarmup ? PROBE_PROFILE.warmups : measuredCount
        });
      } catch (error) {
        result = { ok: false, timeout: false, ms: NaN, error: error?.message || 'Request failed' };
      }
      if (!isWarmup) {
        results.push(result);
        onMeasured?.({ index, total: measuredCount, result });
      }
      if (callIndex < totalCalls - 1) await sleep(PROBE_PROFILE.spacingMs);
    }

    return summarizeProbeResults(results);
  }

  return Object.freeze({
    PROBE_PROFILE,
    median,
    calculateJitter,
    summarizeProbeResults,
    hasInternetAccess,
    runProbeSequence
  });
});
