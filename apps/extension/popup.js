const DEFAULT_CFG = {
  serverUrl: 'http://127.0.0.1:3847',
  studioUrl: 'http://localhost:5173',
  floatingBar: true,
  siteScope: 'ai_only',
  insertMode: 'replace',
  cleanWrapper: true,
  autoSyncCambridge: true,
};

const els = {
  status: document.getElementById('status'),
  floatingBar: document.getElementById('floatingBar'),
  cleanWrapper: document.getElementById('cleanWrapper'),
  autoSyncCambridge: document.getElementById('autoSyncCambridge'),
  insertMode: document.getElementById('insertMode'),
  siteScope: document.getElementById('siteScope'),
  serverUrl: document.getElementById('serverUrl'),
  openStudio: document.getElementById('openStudio'),
};

function checkHealth() {
  chrome.runtime.sendMessage({ type: 'ASS_HEALTH' }, (res) => {
    if (res?.ok) {
      els.status.textContent = 'Server Online';
      els.status.className = 'badge ok';
    } else {
      els.status.textContent = 'Server Offline';
      els.status.className = 'badge err';
    }
  });
}

chrome.storage.sync.get(DEFAULT_CFG, (cfg) => {
  els.floatingBar.checked = Boolean(cfg.floatingBar);
  els.cleanWrapper.checked = Boolean(cfg.cleanWrapper);
  els.autoSyncCambridge.checked = Boolean(cfg.autoSyncCambridge);
  els.insertMode.value = cfg.insertMode;
  els.siteScope.value = cfg.siteScope;
  els.serverUrl.value = cfg.serverUrl;
  els.openStudio.href = cfg.studioUrl || DEFAULT_CFG.studioUrl;
  checkHealth();
});

function persist() {
  chrome.storage.sync.set(
    {
      floatingBar: els.floatingBar.checked,
      cleanWrapper: els.cleanWrapper.checked,
      autoSyncCambridge: els.autoSyncCambridge.checked,
      insertMode: els.insertMode.value,
      siteScope: els.siteScope.value,
      serverUrl: els.serverUrl.value.trim() || DEFAULT_CFG.serverUrl,
    },
    () => checkHealth(),
  );
}

els.floatingBar.addEventListener('change', persist);
els.cleanWrapper.addEventListener('change', persist);
els.autoSyncCambridge.addEventListener('change', persist);
els.insertMode.addEventListener('change', persist);
els.siteScope.addEventListener('change', persist);
els.serverUrl.addEventListener('change', persist);
