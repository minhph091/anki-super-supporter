(() => {
  const ASS = window.__ASS__;
  if (!ASS) return;

  function findElevenLabsTextbox() {
    const textareas = Array.from(document.querySelectorAll('textarea')).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width >= 180 && rect.height >= 50 && !el.disabled && !el.readOnly;
    });
    if (textareas.length > 0) {
      textareas.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      });
      return { kind: 'textarea', el: textareas[0] };
    }

    const editables = Array.from(
      document.querySelectorAll(
        '[contenteditable="true"][role="textbox"], .ProseMirror[contenteditable="true"], [data-lexical-editor="true"], [contenteditable="true"]',
      ),
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width >= 180 && rect.height >= 40;
    });
    if (editables.length > 0) {
      editables.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      });
      return { kind: 'contenteditable', el: editables[0] };
    }

    return null;
  }

  function fillElevenLabsTextbox(target, text) {
    const { kind, el } = target;
    el.focus();

    if (kind === 'textarea') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        }),
      );
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);

      const inserted = document.execCommand('insertText', false, text);
      if (!inserted) {
        el.textContent = text;
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text,
          }),
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  let checking = false;
  let lastAppliedId = '';

  const checkAndFill = () => {
    if (checking || document.visibilityState !== 'visible') return;
    checking = true;

    chrome.runtime.sendMessage({ type: 'ASS_GET_ELEVENLABS_HANDOFF' }, (res) => {
      checking = false;
      if (chrome.runtime.lastError || !res?.ok || !res.data?.pending) return;

      const { id, text } = res.data;
      if (!text || id === lastAppliedId) return;

      const box = findElevenLabsTextbox();
      if (!box) {
        setTimeout(checkAndFill, 500);
        return;
      }

      const filled = fillElevenLabsTextbox(box, text);
      if (filled) {
        lastAppliedId = id;
        chrome.runtime.sendMessage({ type: 'ASS_ACK_ELEVENLABS_HANDOFF', id });
        ASS.showToast('✓ Đã tự điền câu ví dụ từ AnkiSuperSupporter!', true);
      }
    });
  };

  setTimeout(checkAndFill, 500);
  window.addEventListener('focus', checkAndFill);
  document.addEventListener('visibilitychange', checkAndFill);
  setInterval(checkAndFill, 1200);
})();
