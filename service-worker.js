const CACHE='netvitals-v2';
const ASSETS=['/','/assets/css/site.css','/assets/js/app.js','/assets/js/config.js','/assets/js/ads.js','/assets/js/pwa.js','/manifest.webmanifest','/assets/icons/favicon.svg','/assets/icons/favicon.ico','/assets/icons/apple-touch-icon.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))))});
