'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fast = require('../assets/js/fast.js');

test('FAST profile protects the adaptive run and cumulative data budget', () => {
  assert.deepEqual(fast.FAST_PROFILE, {
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
});

test('FAST discovery URL uses the current public endpoint parameters', () => {
  const url = new URL(fast.buildDiscoveryUrl());
  assert.equal(url.origin, 'https://api.fast.com');
  assert.equal(url.pathname, '/netflix/speedtest/v2');
  assert.equal(url.searchParams.get('https'), 'true');
  assert.equal(url.searchParams.get('token'), fast.FAST_PROFILE.token);
  assert.equal(url.searchParams.get('urlCount'), '5');
});

test('FAST range URLs preserve target query parameters and use HTTPS', () => {
  const url = fast.toRangeUrl(
    'https://ipv4-c001.example.oca.nflxvideo.net/speedtest?c=my&t=token',
    26214400
  );
  assert.equal(url, 'https://ipv4-c001.example.oca.nflxvideo.net/speedtest/range/0-26214399?c=my&t=token');
  assert.throws(() => fast.toRangeUrl('http://example.com/speedtest', 1024), /HTTPS/);
  assert.throws(() => fast.toRangeUrl('https://example.oca.nflxvideo.net/other', 1024), /speedtest path/);
});

test('FAST discovery filters invalid and duplicate targets without exposing client metadata', () => {
  const targets = fast.parseDiscoveryTargets({
    client: { ip: '192.0.2.1' },
    targets: [
      { url: 'https://one.oca.nflxvideo.net/speedtest?c=my', name: 'One' },
      { url: 'https://one.oca.nflxvideo.net/speedtest?c=my', name: 'Duplicate' },
      { url: 'http://two.oca.nflxvideo.net/speedtest?c=my', name: 'Insecure' },
      { url: 'https://three.oca.nflxvideo.net/other', name: 'Wrong path' },
      { url: 'https://four.oca.nflxvideo.net/speedtest?c=my', location: { city: 'Test' } }
    ]
  });
  assert.equal(targets.length, 2);
  assert.equal(targets[0].name, 'One');
  assert.equal(targets[1].location.city, 'Test');
  assert.equal(Object.hasOwn(targets[0], 'ip'), false);
});

test('FAST discovery requests CORS JSON without credentials or cache reuse', async () => {
  let request;
  const result = await fast.discoverTargets({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ targets: [{ url: 'https://one.oca.nflxvideo.net/speedtest?c=my' }] })
      };
    }
  });
  assert.equal(result.targets.length, 1);
  assert.equal(request.options.mode, 'cors');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.credentials, 'omit');
});

test('FAST discovery timeout rejects even if a fetch implementation ignores abort', async () => {
  const profile = { ...fast.FAST_PROFILE, discoveryTimeoutMs: 5 };
  await assert.rejects(
    fast.discoverTargets({ profile, fetchImpl: async () => new Promise(() => {}) }),
    error => error.code === 'discovery-timeout'
  );
});

test('FAST moving average uses the latest five byte/time snapshots', () => {
  const snapshots = Array.from({ length: 6 }, () => ({ bytes: 1250000, time: 100 }));
  assert.equal(fast.movingAverage(snapshots), 100);
  assert.equal(Number.isNaN(fast.movingAverage([])), true);
  assert.equal(Number.isNaN(fast.movingAverage(null)), true);
});

test('FAST stability requires six close measurements and does not accept a fresh peak', () => {
  assert.equal(fast.isStableSpeed([100, 100, 100, 100, 100, 100]), true);
  assert.equal(fast.isStableSpeed([100, 100, 100, 100, 100]), false);
  assert.equal(fast.isStableSpeed([100, 100, 100, 100, 100, 110]), false);
  assert.equal(fast.isStableSpeed([100, 100, 130, 100, 100, 100]), false);
  assert.equal(fast.isStableSpeed([100, 101, 99, 100, 100, 101]), true);
});

test('FAST worker scaling follows the intended aggregate-speed thresholds', () => {
  assert.equal(fast.desiredConnections(0), 1);
  assert.equal(fast.desiredConnections(0.75), 3);
  assert.equal(fast.desiredConnections(2), 3);
  assert.equal(fast.desiredConnections(20), 5);
  assert.equal(fast.desiredConnections(50), 5);
  assert.equal(fast.desiredConnections(50.1), 8);
});

test('FAST credibility rejects partial, unstable, and provider-mismatched results', () => {
  const result = {
    provider: 'fast',
    stable: true,
    bytes: 100000000,
    download: 100,
    upload: 20,
    downloadResult: { stable: true },
    uploadResult: { stable: true }
  };
  assert.equal(fast.isCredible(result), true);
  assert.equal(fast.isCredible({ ...result, stable: false }), false);
  assert.equal(fast.isCredible({ ...result, provider: 'cloudflare' }), false);
  assert.equal(fast.isCredible({ ...result, bytes: 1000000001 }), false);
});

test('FAST discovery failure is explicit so the app can switch providers', async () => {
  await assert.rejects(
    fast.runFastTest({ fetchImpl: async () => { throw new Error('blocked'); } }),
    error => error.code === 'discovery-failed'
  );
});

test('FAST transfer runner stays under its cumulative cap and reaches a stable result with progress XHRs', async () => {
  const profile = {
    ...fast.FAST_PROFILE,
    minConnections: 1,
    maxConnections: 3,
    progressFrequencyMs: 5,
    settleMs: 1,
    quickMinDurationMs: 40,
    quickStableAfterMs: 40,
    quickMaxDurationMs: 300,
    fullMinDurationMs: 40,
    fullStableAfterMs: 40,
    fullMaxDurationMs: 300,
    stabilityDeltaPercent: 100,
    minStableMeasurements: 1,
    requestTimeoutMs: 100,
    requestBytes: 1000,
    maxBytes: 100000,
    minMeasuredBytes: 100
  };
  const requests = [];
  const xhrFactory = () => {
    const xhr = { upload: {}, status: 0, response: null };
    let timer;
    let aborted = false;
    xhr.open = (method, url) => { xhr.method = method; xhr.url = url; };
    xhr.setRequestHeader = () => {};
    xhr.send = body => {
      const size = xhr.method === 'POST' ? body.size : Number(xhr.url.match(/\/range\/0-(\d+)/)?.[1]) + 1;
      requests.push({ method: xhr.method, size });
      let loaded = 0;
      timer = setInterval(() => {
        loaded = Math.min(size, loaded + 200);
        const event = { loaded, lengthComputable: true };
        if (xhr.method === 'POST') xhr.upload.onprogress?.(event);
        else xhr.onprogress?.(event);
        if (loaded >= size) {
          clearInterval(timer);
          xhr.status = 200;
          xhr.response = { size };
          xhr.onload?.();
        }
      }, 2);
    };
    xhr.abort = () => {
      if (aborted) return;
      aborted = true;
      clearInterval(timer);
      xhr.onabort?.();
    };
    return xhr;
  };
  const result = await fast.runFastTest({
    profile,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ targets: [
        { url: 'https://one.oca.nflxvideo.net/speedtest?c=test' },
        { url: 'https://two.oca.nflxvideo.net/speedtest?c=test' }
      ] })
    }),
    xhrFactory
  });
  assert.equal(result.stable, true);
  assert.ok(result.download > 0);
  assert.ok(result.upload > 0);
  assert.ok(result.downloadResult.progressEvents > 0);
  assert.ok(result.uploadResult.progressEvents > 0);
  assert.ok(result.bytes <= profile.maxBytes);
  assert.ok(requests.length > 0);
  assert.ok(requests.reduce((total, request) => total + request.size, 0) <= profile.maxBytes);
});

test('FAST quarantines targets that complete without browser progress events', async () => {
  const profile = {
    ...fast.FAST_PROFILE,
    minConnections: 1,
    maxConnections: 1,
    progressFrequencyMs: 5,
    settleMs: 1,
    quickMinDurationMs: 20,
    quickStableAfterMs: 20,
    quickMaxDurationMs: 80,
    requestTimeoutMs: 100,
    requestBytes: 100,
    maxBytes: 100000,
    minMeasuredBytes: 100,
    minStableMeasurements: 1,
    stabilityDeltaPercent: 100
  };
  const xhrFactory = () => {
    const xhr = { upload: {}, status: 0, response: null };
    let timer;
    let aborted = false;
    xhr.open = (method, url) => { xhr.method = method; xhr.url = url; };
    xhr.setRequestHeader = () => {};
    xhr.send = body => {
      const size = xhr.method === 'POST' ? body.size : Number(xhr.url.match(/\/range\/0-(\d+)/)?.[1]) + 1;
      timer = setTimeout(() => {
        xhr.status = 200;
        xhr.response = { size };
        xhr.onload?.();
      }, 1);
    };
    xhr.abort = () => {
      if (aborted) return;
      aborted = true;
      clearTimeout(timer);
      xhr.onabort?.();
    };
    return xhr;
  };
  await assert.rejects(
    fast.runFastTest({
      profile,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ targets: [
          { url: 'https://one.oca.nflxvideo.net/speedtest?c=test' },
          { url: 'https://two.oca.nflxvideo.net/speedtest?c=test' }
        ] })
      }),
      xhrFactory
    }),
    error => error.code === 'download-unstable'
  );
});

test('FAST quarantines a failed target after partial progress and uses the next target', async () => {
  const profile = {
    ...fast.FAST_PROFILE,
    minConnections: 1,
    maxConnections: 1,
    progressFrequencyMs: 5,
    settleMs: 1,
    quickMinDurationMs: 30,
    quickStableAfterMs: 30,
    quickMaxDurationMs: 180,
    requestTimeoutMs: 100,
    requestBytes: 1000,
    maxBytes: 100000,
    minMeasuredBytes: 100,
    minStableMeasurements: 1,
    stabilityDeltaPercent: 100
  };
  const requests = [];
  const xhrFactory = () => {
    const xhr = { upload: {}, status: 0, response: null };
    let timer;
    let aborted = false;
    xhr.open = (method, url) => { xhr.method = method; xhr.url = url; };
    xhr.setRequestHeader = () => {};
    xhr.send = body => {
      const size = xhr.method === 'POST' ? body.size : Number(xhr.url.match(/\/range\/0-(\d+)/)?.[1]) + 1;
      requests.push({ method: xhr.method, url: xhr.url });
      if (xhr.url.includes('//one.')) {
        timer = setTimeout(() => {
          const event = { loaded: Math.min(200, size), lengthComputable: true };
          if (xhr.method === 'POST') xhr.upload.onprogress?.(event);
          else xhr.onprogress?.(event);
          xhr.status = 503;
          xhr.response = { size: event.loaded };
          xhr.onload?.();
        }, 1);
        return;
      }
      let loaded = 0;
      timer = setInterval(() => {
        loaded = Math.min(size, loaded + 200);
        const event = { loaded, lengthComputable: true };
        if (xhr.method === 'POST') xhr.upload.onprogress?.(event);
        else xhr.onprogress?.(event);
        if (loaded >= size) {
          clearInterval(timer);
          xhr.status = 200;
          xhr.response = { size };
          xhr.onload?.();
        }
      }, 2);
    };
    xhr.abort = () => {
      if (aborted) return;
      aborted = true;
      clearTimeout(timer);
      clearInterval(timer);
      xhr.onabort?.();
    };
    return xhr;
  };
  const result = await fast.runFastTest({
    profile,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ targets: [
        { url: 'https://one.oca.nflxvideo.net/speedtest?c=test' },
        { url: 'https://two.oca.nflxvideo.net/speedtest?c=test' }
      ] })
    }),
    xhrFactory
  });
  assert.equal(result.stable, true);
  assert.equal(result.downloadResult.failedTargets, 1);
  assert.equal(result.uploadResult.failedTargets, 1);
  assert.ok(result.downloadResult.progressEvents > 0);
  assert.ok(result.uploadResult.progressEvents > 0);
  assert.ok(requests.some(request => request.url.includes('//two.')));
});
