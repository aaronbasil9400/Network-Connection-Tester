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
for p in ROOT.rglob('*.html'):
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
for js in list((ROOT/'assets/js').glob('*.js'))+[ROOT/'service-worker.js']:
    cp=subprocess.run(['node','--check',str(js)],capture_output=True,text=True)
    if cp.returncode: errors.append(f'{js.relative_to(ROOT)} JS syntax: {cp.stderr.strip()}')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('PASS: HTML structure, NetVitals branding/domain/ownership metadata, icons, manifest JSON, sitemap XML and JavaScript syntax.')
