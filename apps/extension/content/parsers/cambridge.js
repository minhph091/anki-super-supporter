(() => {
  const ASS = window.__ASS__;
  if (!ASS) return;
  const { cleanText, arrayBufferToBase64, isHumanVerificationPage, showToast, showSyncFab } = ASS;

  function getCleanCambridgeDefText(defEl) {
    if (!defEl) return '';
    const clone = defEl.cloneNode(true);
    clone.querySelectorAll('.ass-pick-def-btn').forEach((n) => n.remove());
    return cleanText(clone.textContent)
      .replace(/\s*\+\s*Chọn vào Anki\s*$/i, '')
      .replace(/\s*[:：]\s*$/, '')
      .trim();
  }

  function extractCambridgeFromDom() {
    const entryEls = Array.from(document.querySelectorAll('.entry-body__el, .pr.entry-body__el'));
    const diEntries = Array.from(document.querySelectorAll('.di-body .entry'));
    const targets =
      entryEls.length > 0
        ? entryEls
        : diEntries.length > 0
          ? diEntries
          : Array.from(document.querySelectorAll('.entry-body, .di-body'));

    let detectedWord = '';
    const entries = [];
    const stripSlashes = (v) => (v ? v.trim().replace(/^\/+|\/+$/g, '').trim() : undefined);

    const extractCambridgePronunciations = (entryEl) => {
      const directHeader = entryEl.querySelector(':scope > .pos-header, :scope > .dpos-h');
      const fallbackHeader = Array.from(entryEl.querySelectorAll('.pos-header, .dpos-h')).find(
        (el) => !el.closest('.runon, .drunon'),
      );
      const header = directHeader || fallbackHeader || entryEl;
      const dprons = Array.from(header.querySelectorAll('.dpron-i')).filter(
        (dp) => !dp.closest('.runon, .drunon'),
      );
      let usIpa;
      let ukIpa;

      const readDpronIpa = (dp) => {
        const ipaTexts = Array.from(dp.querySelectorAll('.ipa, .dipa'))
          .map((el) => stripSlashes(cleanText(el.textContent)))
          .filter(Boolean);
        const unique = Array.from(new Set(ipaTexts));
        return unique.length > 0 ? unique.join(', ') : undefined;
      };

      for (const dp of dprons) {
        const regionText = cleanText(dp.querySelector('.region, .dreg')?.textContent).toLowerCase();
        const isUs = dp.classList.contains('us') || regionText === 'us';
        const isUk = dp.classList.contains('uk') || regionText === 'uk';
        const val = readDpronIpa(dp);
        if (!val) continue;
        if (isUs && !usIpa) usIpa = val;
        else if (isUk && !ukIpa) ukIpa = val;
      }

      if (!usIpa) {
        const usEl = header.querySelector('.us .ipa, .us .dipa');
        if (usEl && !usEl.closest('.runon, .drunon')) {
          usIpa = stripSlashes(cleanText(usEl.textContent));
        }
      }
      if (!ukIpa) {
        const ukEl = header.querySelector('.uk .ipa, .uk .dipa');
        if (ukEl && !ukEl.closest('.runon, .drunon')) {
          ukIpa = stripSlashes(cleanText(ukEl.textContent));
        }
      }

      return { usIpa, ukIpa };
    };

    targets.forEach((entryEl, entryIdx) => {
      const headword =
        cleanText(
          entryEl.querySelector(
            '.pos-header .hw.dhw, .dpos-h .hw.dhw, .di-title .hw, .di-title .dhw, .hw.dhw, .hw',
          )?.textContent,
        ) ||
        cleanText(
          entryEl
            .closest('.di, .superentry, .entry-body')
            ?.querySelector('.di-title .hw, .di-title .dhw, .di-title')?.textContent,
        );
      if (headword && !detectedWord) detectedWord = headword;
      const pos = cleanText(
        entryEl.querySelector(
          '.pos-header .pos.dpos, .dpos-h .pos.dpos, .posgram .pos.dpos, .pos.dpos',
        )?.textContent,
      ).toLowerCase();
      const { usIpa, ukIpa } = extractCambridgePronunciations(entryEl);

      const blocks = [];
      const dsenses = Array.from(entryEl.querySelectorAll('.pr.dsense, .dsense'));
      const blockContainers = dsenses.length > 0 ? dsenses : [entryEl];

      blockContainers.forEach((blkEl, blockIdx) => {
        const guideword = cleanText(
          blkEl.querySelector(
            '.dsense_h .guideword span, .dsense_h .guideword, .guideword span, .guideword',
          )?.textContent,
        ).replace(/^\(|\)$/g, '');

        const senses = [];
        blkEl
          .querySelectorAll('.def-block.ddef_block, .def-block, .ddef_block')
          .forEach((senseEl, senseIdx) => {
            const definition = getCleanCambridgeDefText(
              senseEl.querySelector('.def.ddef_d, .def, .ddef_d'),
            );
            if (!definition) return;
            const level =
              cleanText(senseEl.querySelector('.def-info .epp-xref')?.textContent) || undefined;
            const examples = [];
            senseEl
              .querySelectorAll('.examp.dexamp .eg.deg, .examp .eg, .dexamp .deg')
              .forEach((exEl) => {
                const t = cleanText(exEl.textContent);
                if (t && !examples.includes(t)) examples.push(t);
              });
            senses.push({
              id: `cam_ext_${entryIdx}_${blockIdx}_${senseIdx}`,
              level,
              definition,
              examples,
            });
          });

        if (senses.length > 0) {
          blocks.push({
            id: `cam_ext_blk_${entryIdx}_${blockIdx}`,
            guideword: guideword || undefined,
            senses,
          });
        }
      });

      if (blocks.length > 0) {
        entries.push({
          id: `cam_ext_entry_${entryIdx}`,
          headword: headword || detectedWord,
          pos,
          usIpa,
          ukIpa,
          blocks,
        });
      }
    });

    const audios = [];
    const seenAudioUrls = new Set();
    const collectAudio = (audioEl) => {
      if (audios.length >= 2) return;
      if (audioEl.closest('.runon, .drunon')) return;
      const srcEl =
        audioEl.querySelector('source[type="audio/mpeg"]') ||
        audioEl.querySelector('source[src$=".mp3"]') ||
        audioEl.querySelector('source');
      const rawSrc = srcEl?.getAttribute('src') || '';
      if (!rawSrc) return;
      const fullUrl = rawSrc.startsWith('http')
        ? rawSrc
        : `${window.location.origin}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`;
      if (seenAudioUrls.has(fullUrl)) return;
      seenAudioUrls.add(fullUrl);
      const dp = audioEl.closest('.dpron-i');
      const regText = cleanText(dp?.querySelector('.region, .dreg')?.textContent).toLowerCase();
      const region =
        dp?.classList.contains('us') || regText === 'us' || fullUrl.includes('/us_pron/')
          ? 'us'
          : dp?.classList.contains('uk') || regText === 'uk' || fullUrl.includes('/uk_pron/')
            ? 'uk'
            : 'other';
      const posText = cleanText(
        audioEl.closest('.entry-body__el')?.querySelector('.pos-header .pos.dpos')?.textContent,
      ).toLowerCase();
      audios.push({
        region,
        url: fullUrl,
        ...(posText ? { pos: posText } : {}),
      });
    };

    document
      .querySelectorAll(
        '.entry-body__el .dpron-i audio, .dpron-i audio, .entry-body__el .dpron-i amp-audio, .dpron-i amp-audio',
      )
      .forEach(collectAudio);
    if (audios.length < 2) {
      document.querySelectorAll('audio, amp-audio').forEach(collectAudio);
    }

    const wordFromTitle = cleanText(document.querySelector('.di-title, h1')?.textContent);
    const word = detectedWord || wordFromTitle;
    return {
      word,
      sourceUrl: window.location.href,
      entries,
      audios,
    };
  }

  async function attachCambridgeAudioData(payload) {
    if (!payload || !Array.isArray(payload.audios) || payload.audios.length === 0) {
      return payload;
    }

    const enriched = await Promise.all(
      payload.audios.slice(0, 2).map(async (item) => {
        if (!item?.url) return item;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(item.url, {
            credentials: 'include',
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!resp.ok) return item;
          const buf = await resp.arrayBuffer();
          if (!buf || buf.byteLength === 0) return item;
          const dataBase64 = arrayBufferToBase64(buf);
          return dataBase64 ? { ...item, dataBase64 } : item;
        } catch {
          return item;
        }
      }),
    );

    return { ...payload, audios: enriched };
  }

  const payload = extractCambridgeFromDom();

  // Check if this Cambridge tab was opened in the background by Extension for auto-sync
  chrome.runtime.sendMessage({ type: 'ASS_CHECK_AUTO_SYNC_TAB' }, (job) => {
    if (chrome.runtime.lastError || !job?.isAutoSyncTab || job.site === 'oxford') return;

    const runAutoSync = async () => {
      const fresh = extractCambridgeFromDom();
      if (fresh.entries.length > 0) {
        const withAudios = await attachCambridgeAudioData(fresh);
        const syncPayload = {
          ...withAudios,
          word: job.word || fresh.word,
        };
        chrome.runtime.sendMessage(
          { type: 'ASS_SYNC_CAMBRIDGE', payload: syncPayload },
          (response) => {
            if (response?.ok) {
              chrome.runtime.sendMessage({ type: 'ASS_AUTO_SYNC_COMPLETE' });
            } else {
              chrome.runtime.sendMessage({
                type: 'ASS_AUTO_SYNC_NEEDS_USER',
                reason: 'server_offline',
              });
            }
          },
        );
        return;
      }

      if (isHumanVerificationPage()) {
        chrome.runtime.sendMessage({
          type: 'ASS_AUTO_SYNC_NEEDS_USER',
          reason: 'verification',
        });
        return;
      }

      chrome.runtime.sendMessage({
        type: 'ASS_AUTO_SYNC_NEEDS_USER',
        reason: 'not_found',
      });
    };

    if (payload.entries.length > 0 || document.readyState === 'complete') {
      void runAutoSync();
    } else {
      window.addEventListener('load', () => void runAutoSync(), { once: true });
    }
  });

  if (payload.entries.length > 0) {
    showSyncFab(`⟳ Đồng bộ Cambridge "${payload.word}" → Studio`, async () => {
      const fresh = extractCambridgeFromDom();
      const withAudios = await attachCambridgeAudioData(fresh);
      chrome.runtime.sendMessage({ type: 'ASS_SYNC_CAMBRIDGE', payload: withAudios }, (response) => {
        if (response?.ok) {
          showToast(`✓ Đã đồng bộ ${fresh.entries.length} mục từ Cambridge sang Studio!`, true);
        } else {
          showToast(`✗ Không đồng bộ được (${response?.error || 'Server offline'})`, false);
        }
      });
    });

    document.querySelectorAll('.def-block.ddef_block').forEach((block) => {
      if (block.querySelector('.ass-pick-def-btn')) return;
      const defEl = block.querySelector('.def.ddef_d');
      if (!defEl) return;
      const defText = getCleanCambridgeDefText(defEl);
      if (!defText) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ass-pick-def-btn';
      btn.textContent = '+ Chọn vào Anki';
      btn.style.cssText =
        'margin-left:8px;padding:2px 8px;border-radius:6px;border:1px solid #4f46e5;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:700;cursor:pointer;vertical-align:middle;';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        chrome.runtime.sendMessage({ type: 'ASS_SEND', target: 'definition', text: defText }, (response) => {
          if (response?.ok) {
            showToast('✓ Đã gửi định nghĩa Cambridge vào trường Definition!', true);
          } else {
            showToast(`✗ Server chưa mở (${response?.error || 'offline'})`, false);
          }
        });
      });
      defEl.appendChild(btn);
    });
  }
})();
