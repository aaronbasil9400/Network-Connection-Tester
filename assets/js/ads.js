(() => {
  const cfg = window.NETVITALS_CONFIG || {};
  if (!cfg.enableAds || !/^ca-pub-\d+$/.test(cfg.adsenseClient || '')) return;

  // The Auto ads script is included directly in every page head. Manual ad
  // units are initialized here only when a numeric ad-unit ID is configured.
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
