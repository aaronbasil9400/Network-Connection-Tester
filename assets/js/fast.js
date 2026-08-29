(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NetVitalsFast = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FAST_PROFILE = Object.freeze({
    discoveryEndpoint: 'https://api.fast.com/netflix/speedtest/v2',
    token: 'YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm',
    urlCount: 5,
    minConnections: 1,
    maxConnections: 8,
    progressFrequencyMs: 150,
    settleMs: 600,
    discoveryTimeoutMs: 9000,
    quickMinDurationMs: 5000,
    quickStableAfterMs: 7000,
    quickMaxDurationMs: 12000,
    fullMinDurationMs: 7000,
    fullStableAfterMs: 7000,
    fullMaxDurationMs: 30000,
    stabilityDeltaPercent: 2,
    minStableMeasurements: 6,
    movingAverageWindow: 5,
    requestTimeoutMs: 9000,
    requestBytes: 26214400,
    maxBytes: 1000000000,
    minMeasuredBytes: 1048576
  });

  function errorWithCode(message, code, details = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
  }

  function buildDiscoveryUrl(profile = FAST_PROFILE) {
    const url = new URL(profile.discoveryEndpoint);
    url.searchParams.set('https', 'true');
    url.searchParams.set('token', profile.token);
    url.searchParams.set('urlCount', String(profile.urlCount));
    return url.href;
  }

  function isOcaHostname(hostname) {
    const host = String(hostname || '').toLowerCase();
    return host === 'nflxvideo.net' || host.endsWith('.nflxvideo.net');
  }

  function toRangeUrl(rawUrl, bytes) {
    if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new TypeError('bytes must be a positive safe integer');
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || !isOcaHostname(url.hostname)) throw new Error('FAST targets must use HTTPS on an OCA host');
    const marker = '/speedtest';
    const markerIndex = url.pathname.indexOf(marker);
    const suffix = markerIndex < 0 ? '' : url.pathname.slice(markerIndex + marker.length);
    if (markerIndex < 0 || (suffix && !suffix.startsWith('/'))) {
      throw new Error('FAST target does not contain a speedtest path');
    }
    url.pathname = `${url.pathname.slice(0, markerIndex + marker.length)}/range/0-${bytes - 1}`;
    return url.href;
  }

  function parseDiscoveryTargets(payload, profile = FAST_PROFILE) {
    if (!payload || !Array.isArray(payload.targets)) return [];
    const seen = new Set();
    const targets = [];
    payload.targets.forEach(target => {
      if (!target || typeof target.url !== 'string') return;
      try {
        const url = new URL(target.url);
        if (url.protocol !== 'https:' || !isOcaHostname(url.hostname) || !url.pathname.includes('/speedtest')) return;
        toRangeUrl(url.href, profile.requestBytes);
        const key = url.href;
        if (seen.has(key)) return;
        seen.add(key);
        targets.push({
          url: key,
          name: typeof target.name === 'string' ? target.name : url.hostname,
          location: target.location || null
        });
      } catch {}
    });
    return targets;
  }

  async function discoverTargets({ fetchImpl, profile = FAST_PROFILE } = {}) {
    const request = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (typeof request !== 'function') throw errorWithCode('Fetch is unavailable', 'fetch-unavailable');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeoutId;
    const deadline = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller?.abort();
        reject(errorWithCode('FAST discovery request timed out', 'discovery-timeout'));
      }, profile.discoveryTimeoutMs);
    });
    let response;
    try {
      response = await Promise.race([
        request(buildDiscoveryUrl(profile), {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          credentials: 'omit',
          signal: controller?.signal
        }),
        deadline
      ]);
    } catch (error) {
      throw errorWithCode(error?.code === 'discovery-timeout' || controller?.signal.aborted ? 'FAST discovery request timed out' : 'FAST discovery request failed', error?.code === 'discovery-timeout' || controller?.signal.aborted ? 'discovery-timeout' : 'discovery-failed', { cause: error });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response || !response.ok) throw errorWithCode(`FAST discovery returned HTTP ${response?.status || 0}`, 'discovery-http');
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw errorWithCode('FAST discovery returned invalid JSON', 'discovery-json', { cause: error });
    }
    const targets = parseDiscoveryTargets(payload, profile);
    if (!targets.length) throw errorWithCode('FAST discovery returned no usable targets', 'discovery-targets');
    return { targets };
  }

  function movingAverage(snapshots, windowSize = FAST_PROFILE.movingAverageWindow) {
    if (!Array.isArray(snapshots) || !Number.isSafeInteger(windowSize) || windowSize <= 0) return NaN;
    const recent = snapshots.slice(-windowSize).filter(snapshot =>
      snapshot && Number.isFinite(snapshot.bytes) && snapshot.bytes > 0 && Number.isFinite(snapshot.time) && snapshot.time > 0);
    if (!recent.length) return NaN;
    const bytes = recent.reduce((total, snapshot) => total + snapshot.bytes, 0);
    const time = recent.reduce((total, snapshot) => total + snapshot.time, 0);
    return time > 0 ? bytes * 8 / (time / 1000) / 1e6 : NaN;
  }

  function isStableSpeed(speeds, { minMeasurements = FAST_PROFILE.minStableMeasurements, deltaPercent = FAST_PROFILE.stabilityDeltaPercent } = {}) {
    if (!Array.isArray(speeds) || speeds.length < minMeasurements) return false;
    const recent = speeds.slice(-minMeasurements).filter(Number.isFinite);
    if (recent.length < minMeasurements) return false;
    const current = recent[recent.length - 1];
    if (!(current > 0)) return false;
    const peak = Math.max(...recent);
    const peakIndex = recent.reduce((best, value, index, values) => value > values[best] ? index : best, 0);
    if (peak > current && recent.length - 1 - peakIndex < Math.ceil(minMeasurements / 2)) return false;
    return recent.every(value => Math.abs(value - current) / current * 100 <= deltaPercent);
  }

  function desiredConnections(mbps, profile = FAST_PROFILE) {
    if (!Number.isFinite(mbps) || mbps <= 0) return profile.minConnections;
    if (mbps > 50) return profile.maxConnections;
    if (mbps > 10) return Math.min(profile.maxConnections, 5);
    if (mbps > 1) return Math.min(profile.maxConnections, 3);
    if (mbps > 0.5) return Math.min(profile.maxConnections, 3);
    return profile.minConnections;
  }

  function isCredible(result, profile = FAST_PROFILE) {
    return !!result &&
      result.provider === 'fast' &&
      result.stable === true &&
      result.bytes > 0 && result.bytes <= profile.maxBytes &&
      Number.isFinite(result.download) && result.download > 0 &&
      Number.isFinite(result.upload) && result.upload > 0 &&
      result.downloadResult?.stable === true &&
      result.uploadResult?.stable === true;
  }

  function defaultClock() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now();
  }

  function defaultXhrFactory() {
    if (typeof XMLHttpRequest !== 'function') throw errorWithCode('XMLHttpRequest is unavailable', 'xhr-unavailable');
    return new XMLHttpRequest();
  }

  function requestTransfer({ direction, target, size, profile, clock, xhrFactory, onBytes, onRollback, onFailure, signal, registerXhr, unregisterXhr }) {
    return new Promise(resolve => {
      let xhr;
      let registered = false;
      try {
        xhr = xhrFactory();
        registerXhr?.(xhr);
        registered = true;
        xhr.open(direction === 'upload' ? 'POST' : 'GET', toRangeUrl(target.url, size), true);
        if (direction === 'download') xhr.responseType = 'blob';
        if (direction === 'upload') {
          xhr.upload.onprogress = event => {
            const loaded = Number(event.loaded);
            if (Number.isFinite(loaded)) record(loaded, true);
            resetTimeout();
          };
          try { xhr.setRequestHeader('Content-Type', 'application/octet-stream'); } catch {}
        } else {
          xhr.onprogress = event => {
            const loaded = Number(event.loaded);
            if (Number.isFinite(loaded)) record(loaded, true);
            resetTimeout();
          };
        }
      } catch (error) {
        if (registered) unregisterXhr?.(xhr);
        resolve({ ok: false, bytes: 0, progressEvents: 0, reason: 'setup', error });
        return;
      }

      let settled = false;
      let lastLoaded = 0;
      let progressEvents = 0;
      let committedBytes = 0;
      let timeoutId;
      let timeoutFired = false;
      let externallyAborted = false;
      const startedAt = clock();

      const cleanup = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener?.('abort', abortFromSignal);
        unregisterXhr?.(xhr);
      };
      const finish = (result, finalBytes = 0) => {
        if (settled) return;
        settled = true;
        if (finalBytes > lastLoaded) record(finalBytes, false);
        const acceptsBytes = (result.ok && progressEvents > 0) ||
          ((result.reason === 'network' || result.reason === 'stopped') && lastLoaded > 0 && progressEvents > 0);
        if (!acceptsBytes && committedBytes > 0) onRollback?.(committedBytes);
        if (!acceptsBytes && result.reason !== 'stopped' && committedBytes > 0) onFailure?.(result);
        cleanup();
        resolve({
          ...result,
          bytes: acceptsBytes ? lastLoaded : 0,
          progressEvents,
          elapsedSec: Math.max(0, (clock() - startedAt) / 1000)
        });
      };
      const abortFromSignal = () => {
        externallyAborted = true;
        try { xhr.abort(); } catch {}
      };
      const resetTimeout = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          timeoutFired = true;
          try { xhr.abort(); } catch {}
        }, profile.requestTimeoutMs);
      };
      const record = (loaded, isProgressEvent) => {
        if (!Number.isFinite(loaded) || loaded <= lastLoaded) return;
        const previous = lastLoaded;
        lastLoaded = loaded;
        if (isProgressEvent) progressEvents += 1;
        const accepted = onBytes?.(loaded - previous, clock());
        if (Number.isFinite(accepted) && accepted > 0) committedBytes += accepted;
      };

      xhr.onload = () => {
        const status = Number(xhr.status);
        const ok = (status >= 200 && status < 300) || status === 304;
        if (!ok) {
          finish({ ok: false, reason: `http-${status}` });
          return;
        }
        const responseBytes = direction === 'upload' ? size : Number(xhr.response?.size);
        finish({ ok: true, reason: 'complete' }, responseBytes);
      };
      xhr.onerror = () => finish({ ok: false, reason: 'network' });
      xhr.ontimeout = () => finish({ ok: false, reason: 'timeout' });
      xhr.onabort = () => finish({ ok: false, reason: externallyAborted ? 'stopped' : timeoutFired ? 'timeout' : 'aborted' });
      signal?.addEventListener?.('abort', abortFromSignal, { once: true });
      if (signal?.aborted) {
        abortFromSignal();
        return;
      }
      resetTimeout();
      try {
        if (direction === 'upload') {
          if (typeof Blob !== 'function' || typeof Uint8Array !== 'function') throw errorWithCode('Upload body APIs are unavailable', 'upload-unavailable');
          xhr.send(new Blob([new Uint8Array(size)], { type: 'application/octet-stream' }));
        } else {
          xhr.send();
        }
      } catch (error) {
        finish({ ok: false, reason: 'send', error });
      }
    });
  }

  async function runDirection({ direction, targets, maxBytes, profile, onProgress, clock = defaultClock() , xhrFactory = defaultXhrFactory }) {
    if (!Array.isArray(targets) || !targets.length) throw errorWithCode('FAST has no usable targets', 'targets-unavailable');
    const startedAt = clock();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const activeXhrs = new Set();
    const activeReservations = new Map();
    const badTargets = new Set();
    const snapshots = [];
    const speeds = [];
    const workers = [];
    let nextTargetIndex = 0;
    let activeWorkers = 0;
    let maxWorkers = 0;
    let totalBytes = 0;
    let firstByteAt = null;
    let lastSnapshotAt = null;
    let lastSnapshotBytes = 0;
    let stopped = false;
    let stopReason = 'max-duration';
    let stable = false;
    let progressEvents = 0;
    let ticker;
    let resolveComplete;

    const complete = new Promise(resolve => { resolveComplete = resolve; });
    const emit = update => { try { onProgress?.(update); } catch {} };
    const stop = reason => {
      if (stopped) return;
      stopped = true;
      stopReason = reason;
      clearInterval(ticker);
      controller?.abort();
      activeXhrs.forEach(xhr => { try { xhr.abort(); } catch {} });
    };
    const recordBytes = (delta, timestamp = clock()) => {
      if (stopped || !Number.isFinite(delta) || delta <= 0) return 0;
      const before = totalBytes;
      totalBytes = Math.min(maxBytes, totalBytes + delta);
      if (firstByteAt === null) {
        firstByteAt = timestamp;
        lastSnapshotAt = firstByteAt;
        lastSnapshotBytes = 0;
      }
      return totalBytes - before;
    };
    const rollbackBytes = bytes => {
      if (!Number.isFinite(bytes) || bytes <= 0) return;
      totalBytes = Math.max(0, totalBytes - bytes);
      lastSnapshotBytes = Math.min(lastSnapshotBytes, totalBytes);
    };
    const resetMeasurement = () => {
      snapshots.length = 0;
      speeds.length = 0;
      stable = false;
      firstByteAt = null;
      lastSnapshotAt = null;
      lastSnapshotBytes = totalBytes;
    };
    const pickTarget = () => {
      for (let attempts = 0; attempts < targets.length; attempts += 1) {
        const target = targets[nextTargetIndex % targets.length];
        nextTargetIndex += 1;
        if (!badTargets.has(target.url)) return target;
      }
      return null;
    };
    const maybeComplete = () => {
      if (activeWorkers !== 0 || !stopped) return;
      clearInterval(ticker);
      const durationMs = firstByteAt === null ? 0 : Math.max(0, clock() - firstByteAt);
      const mbps = movingAverage(snapshots, profile.movingAverageWindow);
      resolveComplete({
        ok: stable && progressEvents > 0 && Number.isFinite(mbps) && totalBytes >= profile.minMeasuredBytes,
        stable,
        mbps,
        bytes: totalBytes,
        durationSec: durationMs / 1000,
        samples: speeds.length,
        progressEvents,
        workers: maxWorkers,
        failedTargets: badTargets.size,
        reason: stopReason
      });
    };
    const workerLoop = async () => {
      while (!stopped) {
        const target = pickTarget();
        if (!target) {
          stop('targets');
          break;
        }
        const remaining = maxBytes - totalBytes;
        const available = remaining - [...activeReservations.values()].reduce((total, reserved) => total + reserved, 0);
        if (available <= 0) {
          stop('cap');
          break;
        }
        const size = Math.min(profile.requestBytes, available);
        if (size <= 0) {
          stop('cap');
          break;
        }
        const result = await requestTransfer({
          direction,
          target,
          size,
          profile,
          clock,
          xhrFactory,
          onBytes: recordBytes,
          onRollback: rollbackBytes,
          onFailure: resetMeasurement,
          signal: controller?.signal,
          registerXhr: xhr => { activeXhrs.add(xhr); activeReservations.set(xhr, size); },
          unregisterXhr: xhr => { activeXhrs.delete(xhr); activeReservations.delete(xhr); }
        });
        if (stopped || result.reason === 'stopped') break;
        if (result.ok || (result.reason === 'network' && result.bytes > 0)) {
          progressEvents += result.progressEvents;
        }
        if (result.progressEvents === 0 || (!result.ok && result.bytes === 0)) {
          badTargets.add(target.url);
          if (badTargets.size >= targets.length) stop('targets');
        }
      }
    };
    const addWorker = () => {
      if (stopped) return;
      activeWorkers += 1;
      maxWorkers = Math.max(maxWorkers, activeWorkers);
      const worker = workerLoop().catch(() => stop('worker')).finally(() => {
        activeWorkers -= 1;
        maybeComplete();
      });
      workers.push(worker);
    };
    const tick = () => {
      if (stopped) return;
      const now = clock();
      if (now - startedAt >= profile.maxDurationMs) {
        stop('max-duration');
        maybeComplete();
        return;
      }
      if (totalBytes >= maxBytes) {
        stop('cap');
        maybeComplete();
        return;
      }
      if (firstByteAt === null || lastSnapshotAt === null) return;
      const elapsedMs = now - firstByteAt;
      const elapsedSinceSnapshot = now - lastSnapshotAt;
      const deltaBytes = totalBytes - lastSnapshotBytes;
      if (elapsedSinceSnapshot <= 0 || deltaBytes <= 0) return;
      const snapshot = { atMs: elapsedMs, bytes: deltaBytes, time: elapsedSinceSnapshot };
      snapshots.push(snapshot);
      lastSnapshotAt = now;
      lastSnapshotBytes = totalBytes;
      const mbps = movingAverage(snapshots, profile.movingAverageWindow);
      speeds.push(mbps);
      const desired = desiredConnections(mbps, profile);
      while (!stopped && activeWorkers < desired) addWorker();
      stable = elapsedMs >= Math.max(profile.minDurationMs, profile.stableAfterMs) && isStableSpeed(speeds, {
        minMeasurements: profile.minStableMeasurements,
        deltaPercent: profile.stabilityDeltaPercent
      });
      emit({ phase: direction, mbps, bytes: totalBytes, elapsedMs, workers: activeWorkers, stable });
      if (stable) stop('stable');
    };

    addWorker();
    ticker = setInterval(tick, profile.progressFrequencyMs);
    await complete;
    return complete;
  }

  async function runFastTest({ full = false, onProgress, fetchImpl, xhrFactory, clock, profile = FAST_PROFILE } = {}) {
    const phaseProfile = Object.freeze({
      ...profile,
      minDurationMs: full ? profile.fullMinDurationMs : profile.quickMinDurationMs,
      stableAfterMs: full ? profile.fullStableAfterMs : profile.quickStableAfterMs,
      maxDurationMs: full ? profile.fullMaxDurationMs : profile.quickMaxDurationMs
    });
    const discovered = await discoverTargets({ fetchImpl, profile: phaseProfile });
    let remaining = phaseProfile.maxBytes;
    const progress = update => onProgress?.({ ...update, provider: 'fast' });
    const downloadResult = await runDirection({
      direction: 'download',
      targets: discovered.targets,
      maxBytes: remaining,
      profile: phaseProfile,
      onProgress: progress,
      clock,
      xhrFactory
    });
    remaining -= downloadResult.bytes;
    if (!downloadResult.ok) {
      throw errorWithCode('FAST download result was unavailable or unstable', 'download-unstable', { bytesUsed: phaseProfile.maxBytes - remaining, downloadResult });
    }
    await new Promise(resolve => setTimeout(resolve, phaseProfile.settleMs));
    const uploadResult = await runDirection({
      direction: 'upload',
      targets: discovered.targets,
      maxBytes: remaining,
      profile: phaseProfile,
      onProgress: progress,
      clock,
      xhrFactory
    });
    remaining -= uploadResult.bytes;
    const result = {
      provider: 'fast',
      download: downloadResult.mbps,
      upload: uploadResult.mbps,
      downloadResult,
      uploadResult,
      bytes: phaseProfile.maxBytes - remaining,
      stable: downloadResult.ok && uploadResult.ok
    };
    if (!isCredible(result, phaseProfile)) {
      throw errorWithCode('FAST result was unavailable or unstable', 'result-unstable', { bytesUsed: result.bytes, result });
    }
    return result;
  }

  return Object.freeze({
    FAST_PROFILE,
    buildDiscoveryUrl,
    toRangeUrl,
    parseDiscoveryTargets,
    discoverTargets,
    movingAverage,
    isStableSpeed,
    desiredConnections,
    isCredible,
    runFastTest
  });
});
