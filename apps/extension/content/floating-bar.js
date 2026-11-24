(() => {
  const ASS = window.__ASS__;
  if (!ASS) return;

  const DEFAULT_CONFIG = {
    floatingBar: true,
    siteScope: 'ai_only',
  };

  const AI_HOSTS = [
    'gemini.google.com',
    'grok.com',
    'x.com',
    'twitter.com',
    'chatgpt.com',
    'chat.openai.com',
    'claude.ai',
    'perplexity.ai',
  ];

  const TARGET_LABELS = {
    example_en: 'Example (EN)',
    example_vi: 'Example (Tiếng Việt)',
    word: 'Từ vựng (Word)',
  };

  let config = { ...DEFAULT_CONFIG };
  let lastSelectionText = '';
  let lastSelectionBoldText = '';

  function loadConfig() {
    chrome.storage.sync.get(DEFAULT_CONFIG, (stored) => {
      config = { ...DEFAULT_CONFIG, ...stored };
    });
  }

  loadConfig();
  chrome.storage.onChanged.addListener(() => loadConfig());

  function isSiteAllowed() {
    if (config.siteScope === 'all') return true;
    const host = window.location.hostname.toLowerCase();
    return AI_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  }

  function hideBar() {
    ASS.barEl.classList.remove('visible');
  }

  function getPlainSelectedText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return '';
    return sel.toString().replace(/\u00a0/g, ' ').trim();
  }

  function isBoldElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = el.tagName.toUpperCase();
    if (tag === 'B' || tag === 'STRONG') return true;
    const fw = el.style?.fontWeight;
    return fw === 'bold' || fw === '600' || fw === '700' || fw === '800' || fw === '900';
  }

  function serializeSelectionFragment(node, inBold) {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').replace(/\u00a0/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return '';
    }
    const isEl = node.nodeType === Node.ELEMENT_NODE;
    const tag = isEl ? node.tagName.toUpperCase() : '';
    if (tag === 'BR') return '\n';

    const boldSelf = isEl && isBoldElement(node);
    const nextBold = inBold || boldSelf;
    let inner = '';
    node.childNodes.forEach((child) => {
      inner += serializeSelectionFragment(child, nextBold);
    });
    if (boldSelf && !inBold && inner.trim()) {
      inner = `<b>${inner}</b>`;
    }
    if (tag === 'DIV' || tag === 'P' || tag === 'LI') {
      return `\n${inner}`;
    }
    return inner;
  }

  function stripWholeSentenceBold(text) {
    const plain = text.replace(/<\/?b>/gi, '').trim();
    if (!plain) return '';
    // If all non-punctuation text is inside <b>...</b> (i.e. the entire sentence was bolded on source site),
    // strip bold tags so Studio can cleanly auto-bold only the target vocabulary word.
    const outsideBold = text
      .replace(/<b>[\s\S]*?<\/b>/gi, '')
      .replace(/[\s.,;:!?"'“”‘’()[\]{}…—–\-]+/g, '');
    if (!outsideBold) {
      return plain;
    }
    return text;
  }

  function getSelectedTextPreservingBold() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return '';
    try {
      const range = sel.getRangeAt(0);
      const frag = range.cloneContents();
      const out = serializeSelectionFragment(frag, false)
        .replace(/<\/b><b>/g, '')
        .replace(/<b>(\s*)<\/b>/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return stripWholeSentenceBold(out) || getPlainSelectedText();
    } catch {
      return getPlainSelectedText();
    }
  }

  function sendSelection(target, explicitText) {
    const preserveBold = target === 'example_en' || target === 'example_vi';
    const text = (
      explicitText ||
      (preserveBold
        ? getSelectedTextPreservingBold() || lastSelectionBoldText || lastSelectionText
        : getPlainSelectedText() || lastSelectionText)
    ).trim();
    if (!text) return;

    hideBar();
    chrome.runtime.sendMessage({ type: 'ASS_SEND', target, text }, (response) => {
      if (chrome.runtime.lastError) {
        ASS.showToast(`✗ Lỗi extension: ${chrome.runtime.lastError.message}`, false);
        return;
      }
      if (response?.ok) {
        ASS.showToast(`✓ Đã gửi vào ${TARGET_LABELS[target]}`, true);
      } else {
        ASS.showToast(
          `✗ Không gửi được: hãy mở AnkiSuperSupporter Server (${response?.error || 'offline'})`,
          false,
        );
      }
    });
  }

  ASS.barEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  ASS.barEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
    const target = btn.getAttribute('data-target');
    const preserveBold = target === 'example_en' || target === 'example_vi';
    sendSelection(target, preserveBold ? lastSelectionBoldText || lastSelectionText : lastSelectionText);
  });

  function positionBarForSelection() {
    if (!config.floatingBar || !isSiteAllowed()) {
      hideBar();
      return;
    }

    const sel = window.getSelection();
    const text = getPlainSelectedText();
    if (!sel || !text || sel.rangeCount === 0) {
      hideBar();
      return;
    }

    const anchorTag = sel.anchorNode?.parentElement?.tagName;
    if (anchorTag === 'INPUT' || anchorTag === 'TEXTAREA') {
      hideBar();
      return;
    }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hideBar();
      return;
    }

    lastSelectionText = text;
    lastSelectionBoldText = getSelectedTextPreservingBold();
    ASS.barEl.classList.add('visible');

    const barRect = ASS.barEl.getBoundingClientRect();
    const margin = 8;
    let top = rect.top - barRect.height - margin;
    if (top < 8) {
      top = rect.bottom + margin;
    }
    let left = rect.left + rect.width / 2 - barRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - barRect.width - 8));

    ASS.barEl.style.top = `${Math.round(top)}px`;
    ASS.barEl.style.left = `${Math.round(left)}px`;
  }

  document.addEventListener('mouseup', () => {
    setTimeout(positionBarForSelection, 15);
  });

  document.addEventListener('keyup', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === '1' && getPlainSelectedText()) {
        e.preventDefault();
        sendSelection('example_en');
        return;
      }
      if (e.key === '2' && getPlainSelectedText()) {
        e.preventDefault();
        sendSelection('example_vi');
        return;
      }
      if (e.key === '3' && getPlainSelectedText()) {
        e.preventDefault();
        sendSelection('word');
        return;
      }
    }
    setTimeout(positionBarForSelection, 15);
  });

  document.addEventListener('scroll', hideBar, true);
  document.addEventListener('mousedown', (e) => {
    if (!ASS.hostEl.contains(e.target)) {
      hideBar();
    }
  });
})();
