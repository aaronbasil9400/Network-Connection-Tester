(() => {
  const cfg = window.CONNECTION_HEALTH_CONFIG || {};
  if (!cfg.enableAds || !/^ca-pub-\d+$/.test(cfg.adsenseClient || '')) return;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.adsenseClient)}`;
  document.head.appendChild(s);
  document.querySelectorAll('.ad-slot').forEach(slot => {
    slot.dataset.enabled = 'true';
    const ins = slot.querySelector('ins.adsbygoogle');
    if (ins) {
      ins.dataset.adClient = cfg.adsenseClient;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
    }
  });
})();
