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

  const SPEED_PROFILE = Object.freeze({
    warmupTransfers: 1,
    quickDurationMs: 4000,
    fullDurationMs: 8000,
    rampDiscardMs: 500,
    minWindowMs: 1000,
    settleMs: 600,
    downloadChunkBytes: 25000000,
    uploadChunkBytes: 2000000,
    maxQuickBytes: 60000000,
    maxFullBytes: 250000000
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

  function steadyStateThroughput(chunks, options = {}) {
    const rampMs = Number.isFinite(options.rampDiscardMs)
      ? options.rampDiscardMs
      : SPEED_PROFILE.rampDiscardMs;
    const minWindowMs = Number.isFinite(options.minWindowMs)
      ? options.minWindowMs
      : SPEED_PROFILE.minWindowMs;
    if (!Array.isArray(chunks)) return NaN;
    const points = chunks
      .filter(point => point && Number.isFinite(point.atMs) && Number.isFinite(point.bytes))
      .sort((a, b) => a.atMs - b.atMs);
    if (points.length < 2) return NaN;
    const startAtMs = points[0].atMs;
    const last = points[points.length - 1];
    if (last.bytes <= points[0].bytes) return NaN;

    let baseline = null;
    for (const point of points) {
      if (point.atMs - startAtMs <= rampMs) baseline = point;
      else break;
    }
    if (baseline === null) baseline = points[0];
    const windowBytes = last.bytes - baseline.bytes;
    const windowMs = last.atMs - baseline.atMs;
    if (windowMs >= minWindowMs && windowBytes > 0) {
      return windowBytes * 8 / (windowMs / 1000) / 1e6;
    }
    const totalSec = (last.atMs - startAtMs) / 1000;
    if (totalSec <= 0) return NaN;
    return (last.bytes - points[0].bytes) * 8 / totalSec / 1e6;
  }

  function aggregateThroughput(transfers) {
    if (!Array.isArray(transfers)) return NaN;
    const ok = transfers.filter(transfer =>
      transfer &&
      Number.isFinite(transfer.sec) &&
      transfer.sec > 0 &&
      Number.isFinite(transfer.bytes) &&
      transfer.bytes > 0);
    if (!ok.length) return NaN;
    const bytes = ok.reduce((total, transfer) => total + transfer.bytes, 0);
    const seconds = ok.reduce((total, transfer) => total + transfer.sec, 0);
    if (seconds <= 0) return NaN;
    return bytes * 8 / seconds / 1e6;
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
    SPEED_PROFILE,
    median,
    calculateJitter,
    summarizeProbeResults,
    hasInternetAccess,
    runProbeSequence,
    steadyStateThroughput,
    aggregateThroughput
  });
});
