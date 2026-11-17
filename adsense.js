
  // Configure these two values after creating a display ad unit in AdSense.
  // Example publisher ID: ca-pub-1234567890123456
  const ADSENSE_PUBLISHER_ID = "";
  // Example ad slot ID: 1234567890
  const ADSENSE_SLOT_ID = "";

  (function initializeBottomAd() {
    const publisherId = ADSENSE_PUBLISHER_ID.trim();
    const slotId = ADSENSE_SLOT_ID.trim();

    // Do not load AdSense or show an empty ad box until both IDs are configured.
    if (!/^ca-pub-\\d+$/.test(publisherId) || !/^\\d+$/.test(slotId)) return;

    const container = document.getElementById("bottomAdContainer");
    const slot = document.getElementById("bottomAdSlot");
    if (!container || !slot) return;

    slot.setAttribute("data-ad-client", publisherId);
    slot.setAttribute("data-ad-slot", slotId);
    container.hidden = false;

    const adsScript = document.createElement("script");
    adsScript.async = true;
    adsScript.crossOrigin = "anonymous";
    adsScript.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(publisherId);
    adsScript.onload = function () {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.warn("AdSense ad could not be initialized:", error);
      }
    };
    document.head.appendChild(adsScript);
  })();
