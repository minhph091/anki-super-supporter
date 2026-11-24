(() => {
  const bridgeToken = `ass_bridge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  document.documentElement.dataset.assExtAutosync = '1';
  document.documentElement.dataset.assExtBridgeToken = bridgeToken;

  chrome.runtime.onMessage.addListener((msg) => {
    if (document.documentElement.dataset.assExtBridgeToken !== bridgeToken) return;
    if (msg?.type === 'ASS_AUTO_SYNC_STATUS') {
      window.postMessage(
        {
          type: 'ASS_WEB_AUTO_SYNC_STATUS',
          site: msg.site || 'cambridge',
          requestId: msg.requestId,
          word: msg.word,
          status: msg.status,
        },
        '*',
      );
    }
  });

  const onStudioMessage = (event) => {
    if (event.source !== window) return;
    if (document.documentElement.dataset.assExtBridgeToken !== bridgeToken) {
      window.removeEventListener('message', onStudioMessage);
      return;
    }

    const data = event.data;
    if (!data) return;

    if (data.type === 'ASS_WEB_BRIDGE_PING') {
      try {
        chrome.runtime.sendMessage({ type: 'ASS_BRIDGE_PING' }, (res) => {
          const err = chrome.runtime.lastError?.message;
          window.postMessage(
            {
              type: 'ASS_WEB_BRIDGE_PONG',
              ok: !err && Boolean(res?.ok),
              autoSyncCambridge: Boolean(res?.autoSyncCambridge),
            },
            '*',
          );
        });
      } catch {
        window.postMessage(
          { type: 'ASS_WEB_BRIDGE_PONG', ok: false, status: 'context_invalidated' },
          '*',
        );
      }
      return;
    }

    if (
      data.type !== 'ASS_WEB_AUTO_SYNC_CAMBRIDGE' &&
      data.type !== 'ASS_WEB_AUTO_SYNC_OXFORD'
    ) {
      return;
    }

    const site = data.type === 'ASS_WEB_AUTO_SYNC_OXFORD' ? 'oxford' : 'cambridge';
    const runtimeType = site === 'oxford' ? 'ASS_AUTO_SYNC_OXFORD' : 'ASS_AUTO_SYNC_CAMBRIDGE';

    try {
      chrome.runtime.sendMessage(
        {
          type: runtimeType,
          word: data.word,
          url: data.url,
          requestId: data.requestId,
        },
        (res) => {
          const err = chrome.runtime.lastError?.message;
          window.postMessage(
            {
              type: 'ASS_WEB_AUTO_SYNC_STATUS',
              site,
              requestId: data.requestId,
              word: data.word,
              status: err ? 'error' : res?.status || (res?.ok ? 'started' : 'error'),
              ok: !err && Boolean(res?.ok),
              error: err || res?.error,
            },
            '*',
          );
        },
      );
    } catch (err) {
      window.postMessage(
        {
          type: 'ASS_WEB_AUTO_SYNC_STATUS',
          site,
          requestId: data.requestId,
          word: data.word,
          status: 'context_invalidated',
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
        '*',
      );
    }
  };

  window.addEventListener('message', onStudioMessage);
  window.postMessage({ type: 'ASS_WEB_BRIDGE_READY' }, '*');
})();
