#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import json, re, subprocess, sys, xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
errors=[]
for p in ROOT.rglob('*.html'):
    soup=BeautifulSoup(p.read_text(encoding='utf-8'),'html.parser')
    ids=[x['id'] for x in soup.find_all(attrs={'id':True})]
    dup=sorted({x for x in ids if ids.count(x)>1})
    if dup: errors.append(f'{p.relative_to(ROOT)} duplicate IDs: {dup}')
    if not soup.title: errors.append(f'{p.relative_to(ROOT)} missing title')
    if not soup.find('meta',attrs={'name':'description'}): errors.append(f'{p.relative_to(ROOT)} missing meta description')
json.loads((ROOT/'manifest.webmanifest').read_text())
ET.parse(ROOT/'sitemap.xml')
for js in list((ROOT/'assets/js').glob('*.js'))+[ROOT/'service-worker.js']:
    cp=subprocess.run(['node','--check',str(js)],capture_output=True,text=True)
    if cp.returncode: errors.append(f'{js.relative_to(ROOT)} JS syntax: {cp.stderr.strip()}')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('PASS: HTML structure, duplicate IDs, metadata, manifest JSON, sitemap XML and JavaScript syntax.')
