const DEFAULT_EXT_CONFIG = {
  serverUrl: 'http://127.0.0.1:3847',
  studioUrl: 'http://localhost:5173',
  floatingBar: true,
  siteScope: 'ai_only', // 'ai_only' | 'all'
  insertMode: 'replace', // 'replace' | 'append'
  cleanWrapper: true,
  autoSyncCambridge: true,
};

const AUTO_SYNC_STORAGE_KEY = 'ass_active_cambridge_sync';

const AUTO_SYNC_SITES = {
  cambridge: {
    timeoutMs: 45000,
    allowedPrefixes: [
      'https://dictionary.cambridge.org/dictionary/english/',
      'https://dictionary.cambridge.org/dictionary/learner-english/',
      'https://dictionary.cambridge.org/us/dictionary/english/',
      'https://dictionary.cambridge.org/us/dictionary/learner-english/',
      'https://dictionary.cambridge.org/vi/dictionary/english/',
      'https://dictionary.cambridge.org/vi/dictionary/learner-english/',
    ],
  },
  oxford: {
    timeoutMs: 45000,
    allowedPrefixes: [
      'https://www.oxfordlearnersdictionaries.com/definition/american_english/',
      'https://www.oxfordlearnersdictionaries.com/definition/english/',
      'https://www.oxfordlearnersdictionaries.com/search/american_english/',
      'https://www.oxfordlearnersdictionaries.com/search/english/',
    ],
  },
};

const TARGET_LABELS = {
  example_en: 'Example (EN)',
  example_vi: 'Example (Tiếng Việt)',
  word: 'Từ vựng (Word)',
  definition: 'Định nghĩa (Definition)',
  ipa: 'Phiên âm (IPA)',
};

let autoSyncTimerId = null;
let activeDictSyncMem = null;

async function getConfig() {
  const stored = await chrome.storage.sync.get(DEFAULT_EXT_CONFIG);
  return { ...DEFAULT_EXT_CONFIG, ...stored };
}

async function getActiveDictSync() {
  if (activeDictSyncMem) {
    if (Date.now() - activeDictSyncMem.createdAt > 120000) {
      activeDictSyncMem = null;
      chrome.storage.session?.remove?.(AUTO_SYNC_STORAGE_KEY).catch?.(() => {});
      return null;
    }
    return activeDictSyncMem;
  }
  try {
    const res = await chrome.storage.session.get(AUTO_SYNC_STORAGE_KEY);
    const job = res?.[AUTO_SYNC_STORAGE_KEY] || null;
    if (job && Date.now() - job.createdAt > 120000) {
      await chrome.storage.session.remove(AUTO_SYNC_STORAGE_KEY);
      return null;
    }
    activeDictSyncMem = job;
    return job;
  } catch {
    return activeDictSyncMem;
  }
}

async function setActiveDictSync(job) {
  activeDictSyncMem = job || null;
  try {
    if (job) {
      await chrome.storage.session.set({ [AUTO_SYNC_STORAGE_KEY]: job });
    } else {
      await chrome.storage.session.remove(AUTO_SYNC_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors; activeDictSyncMem still holds state
  }
}

function clearAutoSyncTimer() {
  if (autoSyncTimerId !== null) {
    clearTimeout(autoSyncTimerId);
    autoSyncTimerId = null;
  }
}

function notifyStudioTab(studioTabId, payload) {
  if (!studioTabId) return;
  chrome.tabs.sendMessage(studioTabId, { type: 'ASS_AUTO_SYNC_STATUS', ...payload }).catch(() => {});
}

function arrayBufferToBase64Bg(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function enrichCambridgeAudiosInBackground(payload) {
  if (!payload || !Array.isArray(payload.audios) || payload.audios.length === 0) {
    return payload;
  }
  const enriched = await Promise.all(
    payload.audios.slice(0, 2).map(async (item) => {
      if (!item?.url || item.dataBase64) return item;
      if (!item.url.startsWith('https://dictionary.cambridge.org/')) return item;
      try {
        const resp = await fetch(item.url, { credentials: 'include' });
        if (!resp.ok) return item;
        const buf = await resp.arrayBuffer();
        if (!buf || buf.byteLength === 0) return item;
        const dataBase64 = arrayBufferToBase64Bg(buf);
        return dataBase64 ? { ...item, dataBase64 } : item;
      } catch {
        return item;
      }
    }),
  );
  return { ...payload, audios: enriched };
}

async function startBackgroundDictSync({ site, word, url, requestId, studioTabId }) {
  const cfg = await getConfig();
  if (!cfg.autoSyncCambridge) {
    return { ok: false, site, status: 'disabled' };
  }

  const normalizedSite = site === 'oxford' ? 'oxford' : 'cambridge';
  const siteConfig = AUTO_SYNC_SITES[normalizedSite];
  const cleanWord = (word || '').trim();
  const safeUrl = (url || '').trim();
  const isAllowedUrl = siteConfig.allowedPrefixes.some((prefix) => safeUrl.startsWith(prefix));

  if (!cleanWord || !isAllowedUrl) {
    return { ok: false, site: normalizedSite, status: 'invalid_url' };
  }

  clearAutoSyncTimer();

  const prev = await getActiveDictSync();
  if (prev?.tabId && !prev.awaitingUserVerification) {
    chrome.tabs.remove(prev.tabId).catch(() => {});
  }

  const createdTab = await chrome.tabs.create({
    url: safeUrl,
    active: false,
  });

  if (!createdTab?.id) {
    return { ok: false, site: normalizedSite, status: 'tab_failed' };
  }

  const job = {
    site: normalizedSite,
    tabId: createdTab.id,
    studioTabId: studioTabId || null,
    word: cleanWord,
    url: safeUrl,
    requestId: requestId || '',
    createdAt: Date.now(),
    awaitingUserVerification: false,
  };
  await setActiveDictSync(job);

  autoSyncTimerId = setTimeout(async () => {
    const current = await getActiveDictSync();
    if (!current || current.tabId !== job.tabId || current.awaitingUserVerification) return;
    await setActiveDictSync(null);
    chrome.tabs.remove(job.tabId).catch(() => {});
    notifyStudioTab(job.studioTabId, {
      site: job.site,
      requestId: job.requestId,
      word: job.word,
      status: 'timeout',
    });
  }, siteConfig.timeoutMs);

  return { ok: true, site: normalizedSite, status: 'started', tabId: createdTab.id };
}

chrome.tabs.onRemoved.addListener(async (closedTabId) => {
  const current = await getActiveDictSync();
  if (current && current.tabId === closedTabId) {
    clearAutoSyncTimer();
    await setActiveDictSync(null);
  }
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ass_root',
      title: 'AnkiSuperSupporter (Plain Text)',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'ass_send_example_en',
      parentId: 'ass_root',
      title: '→ Gửi vào Example (EN)',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'ass_send_example_vi',
      parentId: 'ass_root',
      title: '→ Gửi vào Example (Tiếng Việt)',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'ass_send_word',
      parentId: 'ass_root',
      title: '→ Gửi vào Từ vựng (Word)',
      contexts: ['selection'],
    });
  });
}

async function reinjectStudioTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: ['http://localhost/*', 'http://127.0.0.1/*'],
    });
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ['content/studio-bridge.js'],
        })
        .catch(() => {});
    }
  } catch {
    // ignore if scripting unavailable
  }
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
  void reinjectStudioTabs();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

async function postJsonToServer(path, body) {
  const cfg = await getConfig();
  const baseUrl = cfg.serverUrl.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Server trả về lỗi ${response.status}`);
  }
  return data;
}

async function sendToLocalServer({ target, text, sourceUrl, sourceTitle }) {
  const cfg = await getConfig();
  return postJsonToServer('/api/inbox', {
    target,
    text,
    mode: cfg.insertMode,
    cleanWrapper: cfg.cleanWrapper,
    sourceUrl,
    sourceTitle,
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuTargetMap = {
    ass_send_example_en: 'example_en',
    ass_send_example_vi: 'example_vi',
    ass_send_word: 'word',
  };

  const target = menuTargetMap[info.menuItemId];
  if (!target || !info.selectionText) return;

  try {
    const res = await sendToLocalServer({
      target,
      text: info.selectionText,
      sourceUrl: tab?.url || info.pageUrl,
      sourceTitle: tab?.title,
    });
    if (tab?.id) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: 'ASS_TOAST',
          ok: true,
          message:
            res.deliveredToClients > 0
              ? `✓ Đã gửi vào ${TARGET_LABELS[target]}`
              : `✓ Đã gửi (mở Studio để xem ngay)`,
        })
        .catch(() => {});
    }
  } catch (err) {
    if (tab?.id) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: 'ASS_TOAST',
          ok: false,
          message: `✗ Không kết nối được AnkiSuperSupporter Server (${err.message})`,
        })
        .catch(() => {});
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ASS_SEND') {
    sendToLocalServer({
      target: message.target,
      text: message.text,
      sourceUrl: sender.tab?.url,
      sourceTitle: sender.tab?.title,
    })
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === 'ASS_SYNC_CAMBRIDGE') {
    enrichCambridgeAudiosInBackground(message.payload)
      .then((enriched) => postJsonToServer('/api/dictionary/cambridge/import', enriched))
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === 'ASS_SYNC_OXFORD') {
    postJsonToServer('/api/dictionary/oxford/import', message.payload)
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === 'ASS_SYNC_WEBLIO') {
    postJsonToServer('/api/dictionary/weblio/import', message.payload)
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === 'ASS_BRIDGE_PING') {
    getConfig()
      .then((cfg) => sendResponse({ ok: true, autoSyncCambridge: Boolean(cfg.autoSyncCambridge) }))
      .catch(() => sendResponse({ ok: true, autoSyncCambridge: true }));
    return true;
  }

  if (message?.type === 'ASS_AUTO_SYNC_CAMBRIDGE' || message?.type === 'ASS_AUTO_SYNC_OXFORD') {
    const site = message.type === 'ASS_AUTO_SYNC_OXFORD' ? 'oxford' : 'cambridge';
    startBackgroundDictSync({
      site,
      word: message.word,
      url: message.url,
      requestId: message.requestId,
      studioTabId: sender.tab?.id,
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, site, status: 'error', error: err.message }));
    return true;
  }

  if (message?.type === 'ASS_CHECK_AUTO_SYNC_TAB') {
    const tabId = sender.tab?.id;
    getActiveDictSync()
      .then((job) => {
        if (job && tabId && job.tabId === tabId) {
          sendResponse({
            isAutoSyncTab: true,
            site: job.site || 'cambridge',
            word: job.word,
            requestId: job.requestId,
          });
        } else {
          sendResponse({ isAutoSyncTab: false });
        }
      })
      .catch(() => sendResponse({ isAutoSyncTab: false }));
    return true;
  }

  if (message?.type === 'ASS_AUTO_SYNC_COMPLETE') {
    const tabId = sender.tab?.id;
    getActiveDictSync()
      .then(async (job) => {
        if (job && tabId && job.tabId === tabId) {
          clearAutoSyncTimer();
          await setActiveDictSync(null);
          notifyStudioTab(job.studioTabId, {
            site: job.site || 'cambridge',
            requestId: job.requestId,
            word: job.word,
            status: 'completed',
          });
          setTimeout(() => {
            chrome.tabs.remove(tabId).catch(() => {});
          }, 150);
        }
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'ASS_AUTO_SYNC_NEEDS_USER') {
    const tabId = sender.tab?.id;
    const reason = message.reason || 'not_found';
    getActiveDictSync()
      .then(async (job) => {
        if (job && tabId && job.tabId === tabId) {
          clearAutoSyncTimer();
          if (reason === 'verification') {
            await setActiveDictSync({ ...job, awaitingUserVerification: true });
            chrome.tabs.update(tabId, { active: true }).catch(() => {});
            notifyStudioTab(job.studioTabId, {
              site: job.site || 'cambridge',
              requestId: job.requestId,
              word: job.word,
              status: 'verification',
            });
          } else {
            await setActiveDictSync(null);
            chrome.tabs.remove(tabId).catch(() => {});
            notifyStudioTab(job.studioTabId, {
              site: job.site || 'cambridge',
              requestId: job.requestId,
              word: job.word,
              status: reason,
            });
          }
        }
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'ASS_GET_ELEVENLABS_HANDOFF') {
    getConfig()
      .then(async (cfg) => {
        const baseUrl = cfg.serverUrl.replace(/\/+$/, '');
        const r = await fetch(`${baseUrl}/api/handoff/elevenlabs`);
        const data = await r.json();
        sendResponse({ ok: r.ok, data });
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === 'ASS_ACK_ELEVENLABS_HANDOFF') {
    postJsonToServer('/api/handoff/elevenlabs/ack', { id: message.id })
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === 'ASS_HEALTH') {
    getConfig()
      .then(async (cfg) => {
        const baseUrl = cfg.serverUrl.replace(/\/+$/, '');
        const r = await fetch(`${baseUrl}/api/health`);
        const data = await r.json();
        sendResponse({ ok: r.ok, data });
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
});
