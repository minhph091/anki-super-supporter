(() => {
  // Clean up stale Shadow DOM host if Extension was reloaded and re-injected
  const existingHost = document.getElementById('ass-extension-root');
  if (existingHost) {
    existingHost.remove();
  }

  const hostEl = document.createElement('div');
  hostEl.id = 'ass-extension-root';
  hostEl.style.position = 'fixed';
  hostEl.style.zIndex = '2147483647';
  hostEl.style.top = '0';
  hostEl.style.left = '0';
  hostEl.style.pointerEvents = 'none';
  document.documentElement.appendChild(hostEl);

  const shadow = hostEl.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .bar {
        position: fixed;
        display: none;
        align-items: center;
        gap: 4px;
        padding: 4px 6px;
        border-radius: 10px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.3);
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.35);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        pointer-events: auto;
        user-select: none;
      }
      .bar.visible { display: inline-flex; }
      .label {
        font-size: 10px;
        font-weight: 700;
        color: #94a3b8;
        padding: 0 4px;
        letter-spacing: 0.03em;
      }
      button {
        border: none;
        border-radius: 7px;
        padding: 5px 9px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s ease, transform 0.08s ease;
        white-space: nowrap;
      }
      button:active { transform: scale(0.97); }
      .btn-en { background: #4f46e5; color: #ffffff; }
      .btn-en:hover { background: #4338ca; }
      .btn-vi { background: #059669; color: #ffffff; }
      .btn-vi:hover { background: #047857; }
      .btn-word { background: #334155; color: #f1f5f9; }
      .btn-word:hover { background: #475569; }
      .toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        padding: 10px 14px;
        border-radius: 10px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.3);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.16s ease, transform 0.16s ease;
        pointer-events: none;
      }
      .toast.show { opacity: 1; transform: translateY(0); }
      .toast.ok { background: #059669; }
      .toast.err { background: #dc2626; }
      .sync-fab {
        position: fixed;
        right: 18px;
        bottom: 64px;
        display: none;
        align-items: center;
        gap: 6px;
        padding: 9px 14px;
        border-radius: 999px;
        background: #1d2a57;
        color: #ffffff;
        border: 1px solid rgba(251, 191, 36, 0.55);
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.35);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        pointer-events: auto;
      }
      .sync-fab:hover { background: #283c7a; }
      .sync-fab.visible { display: inline-flex; }
    </style>
    <div class="bar" id="ass-bar">
      <span class="label">ANKI</span>
      <button class="btn-en" data-target="example_en" title="Alt+1 · Gửi thuần text vào Example (EN)">→ Example EN</button>
      <button class="btn-vi" data-target="example_vi" title="Alt+2 · Gửi thuần text vào Example (Tiếng Việt)">→ Example VI</button>
      <button class="btn-word" data-target="word" title="Alt+3 · Gửi vào trường Word &amp; tra từ điển">→ Word</button>
    </div>
    <button class="sync-fab" id="ass-sync-fab"></button>
    <div class="toast" id="ass-toast"></div>
  `;

  const barEl = shadow.getElementById('ass-bar');
  const syncFabEl = shadow.getElementById('ass-sync-fab');
  const toastEl = shadow.getElementById('ass-toast');
  let toastTimer = null;

  function showToast(message, ok = true) {
    toastEl.textContent = message;
    toastEl.className = `toast show ${ok ? 'ok' : 'err'}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.className = 'toast';
    }, 2600);
  }

  function cleanText(str) {
    return (str || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function isHumanVerificationPage() {
    if (
      document.querySelector(
        '#challenge-running, #challenge-stage, #cf-challenge-running, .cf-turnstile, iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]',
      )
    ) {
      return true;
    }
    const visibleCaptchaIframe = Array.from(
      document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'),
    ).some((el) => {
      const src = (el.getAttribute('src') || '').toLowerCase();
      if (src.includes('recaptcha/api2/aframe')) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 10 && rect.height > 10;
    });
    if (visibleCaptchaIframe) return true;
    const title = (document.title || '').toLowerCase();
    return (
      title.includes('just a moment') ||
      title.includes('attention required') ||
      title.includes('verify you are human') ||
      title.includes('checking your browser')
    );
  }

  function showSyncFab(label, onClick) {
    syncFabEl.textContent = label;
    syncFabEl.classList.add('visible');
    syncFabEl.onclick = onClick;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'ASS_TOAST') {
      showToast(msg.message, msg.ok);
    }
  });

  window.__ASS__ = {
    hostEl,
    barEl,
    syncFabEl,
    showToast,
    cleanText,
    arrayBufferToBase64,
    isHumanVerificationPage,
    showSyncFab,
  };
})();
