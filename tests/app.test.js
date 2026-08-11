'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'assets', 'js', 'app.js');
const source = fs.readFileSync(appPath, 'utf8');

function section(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('security rendering contains only the six scored browser-visible checks', () => {
  const security = section('function renderSecurityAssessment()', 'function renderServices(');
  const checkLines = security.split(/\r?\n/).filter(line => line.trim().startsWith('add('));
  const weights = checkLines.map(line => Number(line.match(/,(\d+),[^,]+\);\s*$/)?.[1]));
  assert.equal(checkLines.length, 6);
  assert.deepEqual(weights, [30, 20, 15, 15, 10, 10]);
  assert.equal(weights.reduce((total, weight) => total + weight, 0), 100);
  for (const removed of ['Wi-Fi encryption', 'Router security', 'DNS integrity', 'Open ports / LAN threats', 'UNKNOWN']) {
    assert.equal(security.includes(removed), false);
  }
});

test('quality probing and service reachability are isolated and ordered', () => {
  const quality = section('async function runNetworkQualityProbe(', 'async function runServiceChecks(');
  const services = section('async function runServiceChecks(', 'function latencyStatus(');
  const checks = section('async function runChecks(', 'function drawChart(');
  assert.match(quality, /runProbeSequence/);
  assert.match(quality, /latencyProbe/);
  assert.doesNotMatch(quality, /state\.settings\.services|serviceProbe/);
  assert.match(services, /Promise\.all\(state\.settings\.services\.map\(service=>serviceProbe/);
  assert.ok(checks.indexOf('runNetworkQualityProbe') < checks.indexOf('runServiceChecks'));
  assert.ok(checks.indexOf('runServiceChecks') < checks.indexOf('runSpeedTests'));
  assert.match(checks, /hasInternetAccess\(browserOnline,probe\.successes,services\.reachable\)/);
});

test('latency probe is same-origin, cache-busted, no-store, and rejects non-OK HTTP', () => {
  const probe = section('async function latencyProbe(', 'async function runNetworkQualityProbe(');
  assert.match(probe, /\/ping\.txt\?_=/);
  assert.match(probe, /cache:'no-store'/);
  assert.match(probe, /PROBE_PROFILE\.timeoutMs/);
  assert.match(probe, /if\(!response\.ok\)throw new Error/);
  assert.match(probe, /\(await response\.text\(\)\)\.trim\(\)/);
  assert.match(probe, /if\(body!=='ok'\)throw new Error\('Unexpected probe response'\)/);
});

test('generated report uses the revised measurement and security wording', () => {
  const reportSource = section('function buildReport()', 'async function shareReport(');
  const text = value => ({ textContent: value });
  const els = {
    overallStatus: text('Connection healthy'),
    internetMetric: text('Online'),
    latencyMetric: text('18 ms'),
    jitterMetric: text('2.1 ms'),
    lossMetric: text('0%'),
    downloadMetric: text('100 Mbps'),
    uploadMetric: text('20 Mbps'),
    batteryMetric: text('Unavailable'),
    deviceMetric: text('Desktop'),
    gamingVerdict: text('GOOD'),
    callsVerdict: text('GOOD'),
    streamVerdict: text('EXCELLENT'),
    browseVerdict: text('EXCELLENT')
  };
  const state = {
    lastResult: { score: 90 },
    securityResult: { score: 100, label: 'Low visible risk' },
    settings: { services: [{ name: 'Example', url: 'https://example.com/' }] },
    results: [{ ok: true, ms: 25 }]
  };
  const navigator = { connection: null, mozConnection: null, webkitConnection: null };
  const build = new Function('els', 'state', 'navigator', 'nowLabel', `${reportSource}; return buildReport();`);
  const report = build(els, state, navigator, () => 'now');
  assert.match(report, /Browsing: EXCELLENT/);
  assert.match(report, /Latency is a median browser HTTP RTT approximation\./);
  assert.match(report, /Request loss is an application-layer approximation\./);
  assert.match(report, /Security scoring covers browser-visible signals only\./);
  assert.doesNotMatch(report, /Wi-Fi encryption|Router security|DNS integrity|Open ports \/ LAN threats/);
});
