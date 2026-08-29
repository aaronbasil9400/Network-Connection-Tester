#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import json, re, subprocess, sys, xml.etree.ElementTree as ET


class SiteHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=[]
        self.in_title=False
        self.title=[]
        self.has_description=False
        self.has_author=False
        self.canonical=''

    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        if tag == 'title': self.in_title=True
        if tag == 'meta' and attrs.get('name') == 'description': self.has_description=True
        if tag == 'meta' and attrs.get('name') == 'author' and attrs.get('content') == 'Aaron Basil Raj': self.has_author=True
        if tag == 'link' and attrs.get('rel') == 'canonical': self.canonical=attrs.get('href','')

    def handle_endtag(self, tag):
        if tag == 'title': self.in_title=False

    def handle_data(self, data):
        if self.in_title: self.title.append(data)


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ORIGIN = 'https://netvitals.net'
ADSENSE_CLIENT = 'ca-pub-4936629245103906'
errors=[]
homepage=(ROOT/'index.html').read_text(encoding='utf-8')
for p in ROOT.rglob('*.html'):
    if 'graphify-out' in p.parts: continue
    source=p.read_text(encoding='utf-8')
    parser=SiteHTMLParser()
    parser.feed(source)
    ids=parser.ids
    dup=sorted({x for x in ids if ids.count(x)>1})
    if dup: errors.append(f'{p.relative_to(ROOT)} duplicate IDs: {dup}')
    title=''.join(parser.title).strip()
    if not title: errors.append(f'{p.relative_to(ROOT)} missing title')
    if not parser.has_description: errors.append(f'{p.relative_to(ROOT)} missing meta description')
    if not parser.has_author: errors.append(f'{p.relative_to(ROOT)} missing developer metadata')
    if not parser.canonical.startswith(EXPECTED_ORIGIN): errors.append(f'{p.relative_to(ROOT)} has invalid canonical URL')
    if 'NetVitals' not in title: errors.append(f'{p.relative_to(ROOT)} title is not branded NetVitals')
    if 'Developed by Aaron Basil Raj' not in source: errors.append(f'{p.relative_to(ROOT)} missing visible developer credit')
    if 'Connection Health' in source or 'example.com' in source: errors.append(f'{p.relative_to(ROOT)} contains legacy branding or domain')
    adsense_url=f'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}'
    if source.count(adsense_url) != 1: errors.append(f'{p.relative_to(ROOT)} must contain exactly one Auto ads script')
json.loads((ROOT/'manifest.webmanifest').read_text())
ET.parse(ROOT/'sitemap.xml')
for icon in ['favicon.svg','favicon.ico','apple-touch-icon.png','icon-192.png','icon-512.png']:
    if not (ROOT/'assets'/'icons'/icon).is_file(): errors.append(f'missing icon: {icon}')
expected_ads_txt=f'google.com, pub-{ADSENSE_CLIENT.removeprefix("ca-pub-")}, DIRECT, f08c47fec0942fa0'
if (ROOT/'ads.txt').read_text(encoding='utf-8').strip() != expected_ads_txt: errors.append('ads.txt does not contain exactly one matching AdSense publisher entry')

metrics_script='<script src="/assets/js/metrics.js?v=6"></script>'
fast_script='<script src="/assets/js/fast.js?v=1"></script>'
app_script='<script src="/assets/js/app.js?v=8"></script>'
if homepage.count(metrics_script) != 1: errors.append('homepage must load metrics.js exactly once')
if homepage.count(fast_script) != 1: errors.append('homepage must load fast.js exactly once')
if homepage.count(app_script) != 1: errors.append('homepage must load app.js exactly once')
if homepage.find(metrics_script) > homepage.find(app_script): errors.append('metrics.js must load before app.js')
if homepage.find(metrics_script) > homepage.find(fast_script) or homepage.find(fast_script) > homepage.find(app_script): errors.append('metrics.js and fast.js must load before app.js')
if 'id="jitterDetail"' not in homepage: errors.append('homepage is missing the dynamic jitter detail element')

ping=(ROOT/'ping.txt')
if not ping.is_file() or ping.read_text(encoding='utf-8').strip() != 'ok': errors.append('ping.txt must exist and contain only "ok"')
headers=(ROOT/'_headers').read_text(encoding='utf-8')
ping_headers=re.search(r'(?ms)^/ping\.txt\s*\n((?:[ \t]+[^\n]*\n?)+)',headers)
if not ping_headers or 'Cache-Control: no-store' not in ping_headers.group(1): errors.append('_headers must give /ping.txt a no-store Cache-Control policy')

worker=(ROOT/'service-worker.js').read_text(encoding='utf-8')
assets_match=re.search(r'const ASSETS=\[(.*?)\];',worker,re.S)
for asset in ['/assets/css/site.css?v=4','/assets/js/metrics.js?v=6','/assets/js/fast.js?v=1','/assets/js/app.js?v=8']:
    if not assets_match or asset not in assets_match.group(1): errors.append(f'service worker must precache {asset}')
if assets_match and '/ping.txt' in assets_match.group(1): errors.append('service worker must not precache ping.txt')
ping_bypass="url.pathname==='/ping.txt'"
if ping_bypass not in worker or worker.find(ping_bypass) > worker.find('respondWith'): errors.append('service worker must bypass /ping.txt before respondWith')

app=(ROOT/'assets/js/app.js').read_text(encoding='utf-8')
if "HISTORY_KEY='phone-status-history-v4'" not in app: errors.append('app must use the v4 history key')
if 'runProbeRounds' in app: errors.append('obsolete multi-service latency runner remains in app.js')
for removed in ['Wi-Fi encryption','Router security','DNS integrity','Open ports / LAN threats','UNKNOWN']:
    if removed in app: errors.append(f'app.js still renders removed security item: {removed}')
if 'Security scoring covers browser-visible signals only.' not in app: errors.append('share report is missing the browser-visible security limitation')
quality_runner=re.search(r'async function runNetworkQualityProbe\(.*?(?=async function runServiceChecks)',app,re.S)
if not quality_runner or 'latencyProbe' not in quality_runner.group(0) or 'state.settings.services' in quality_runner.group(0): errors.append('network quality runner must use only latencyProbe, not configured services')

for js in list((ROOT/'assets/js').glob('*.js'))+[ROOT/'service-worker.js']:
    cp=subprocess.run(['node','--check',str(js)],capture_output=True,text=True)
    if cp.returncode: errors.append(f'{js.relative_to(ROOT)} JS syntax: {cp.stderr.strip()}')
test_files=[str(p) for p in sorted((ROOT/'tests').glob('*.test.js'))]
unit=subprocess.run(['node','--test',*test_files],capture_output=True,text=True)
if unit.returncode: errors.append(f'Node unit tests failed:\n{unit.stdout}\n{unit.stderr}'.strip())
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('PASS: site structure, branding, AdSense, probe endpoint/cache rules, JavaScript syntax and Node unit tests.')
