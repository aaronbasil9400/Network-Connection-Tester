(() => {
  const cfg = window.NETVITALS_CONFIG || {};
  if (!cfg.enableAds || !/^ca-pub-\d+$/.test(cfg.adsenseClient || '')) return;

  // Loading this once on every page is enough for AdSense site verification
  // and Auto ads. Manual units below are initialized only when a slot ID exists.
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.adsenseClient)}`;
  document.head.appendChild(s);

  if (!/^\d+$/.test(cfg.adsenseSlot || '')) return;
  document.querySelectorAll('.ad-slot').forEach(slot => {
    slot.dataset.enabled = 'true';
    const ins = slot.querySelector('ins.adsbygoogle');
    if (ins) {
      ins.dataset.adClient = cfg.adsenseClient;
      ins.dataset.adSlot = cfg.adsenseSlot;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
    }
  });
})();
