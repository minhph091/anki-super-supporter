(() => {
  const ASS = window.__ASS__;
  if (!ASS) return;
  const { cleanText, showToast, showSyncFab } = ASS;

  function extractWeblioFromDom() {
    const cleanReading = (raw) =>
      (raw || '')
        .replace(/〔[^〕]*〕/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[・‐\-‐\s　]/g, '')
        .trim();

    const dictNames = {
      Sgkdj: 'デジタル大辞泉',
      Jtnhj: '実用日本語表現辞典',
      Wdj: 'Weblio国語辞典',
      NetDicBody: '三省堂 大辞林',
      Jajcw: 'Wiktionary日本語',
    };

    const entries = [];
    const readings = [];
    let detectedWord = '';
    let counter = 0;

    document.querySelectorAll('.kijiWrp .kiji').forEach((kiji) => {
      kiji.querySelectorAll(':scope > h2.midashigo').forEach((h2) => {
        const nextDiv = h2.nextElementSibling;
        if (!nextDiv || nextDiv.tagName !== 'DIV') return;
        const dictClass = (nextDiv.className || '').trim().split(/\s+/)[0] || '';
        const sourceName = dictNames[dictClass];
        if (!sourceName) return;

        const headword =
          (h2.getAttribute('title') || '').trim() ||
          cleanText(h2.textContent).replace(/.*【([^】]+)】.*/, '$1') ||
          cleanText(h2.textContent);
        if (headword && !detectedWord) detectedWord = headword;

        let reading = '';
        let pos = '';
        const senses = [];

        nextDiv.querySelectorAll('p').forEach((p, idx) => {
          const txt = cleanText(p.textContent);
          if (!txt) return;
          const rMatch = txt.match(/^読み方[：:]\s*(.+)$/);
          if (rMatch) {
            const first = cleanReading(rMatch[1].split(/[、,／/]/)[0]);
            if (first && !reading) reading = first;
            return;
          }
          if (/^(\[補説\]|\[派生\]|\[下接句\]|\[類語\]|出典[:：]|別表記[:：])/.test(txt)) {
            return;
          }
          const hinshi = p.querySelector('.hinshi');
          if (hinshi && !pos) {
            pos = cleanText(hinshi.textContent).replace(/^［|］$/g, '');
            if (/^［/.test(txt)) return;
          }
          const defText = txt.replace(/^[１-９0-9]{1,2}\s+/, '').trim();
          if (defText && defText.length > 1) {
            senses.push({
              id: `weblio_ext_${counter}_${idx}`,
              definition: defText,
              examples: [],
            });
          }
        });

        if (!reading) {
          const before = cleanText(h2.textContent).split('【')[0];
          const cand = cleanReading(before);
          if (/^[\u3040-\u30ffー]+$/.test(cand)) reading = cand;
        }

        if (reading && !readings.some((r) => r.reading === reading)) {
          readings.push({
            id: `weblio_ext_rd_${counter}`,
            headword,
            pos,
            reading,
            label: '読み方',
            sourceUrl: window.location.href,
          });
        }

        if (senses.length > 0) {
          entries.push({
            id: `weblio_ext_entry_${counter++}`,
            sourceId: 'weblio',
            sourceName,
            headword,
            pos,
            reading: reading || undefined,
            blocks: [{ id: `weblio_ext_blk_${counter}`, senses }],
            sourceUrl: window.location.href,
          });
        }
      });
    });

    const word =
      detectedWord ||
      cleanText(document.querySelector('h1, h2.midashigo')?.getAttribute('title') || '');

    return {
      lang: 'ja',
      word,
      primaryUrl: window.location.href,
      secondaryUrl: `https://jisho.org/search/${encodeURIComponent(word)}`,
      readings,
      entries,
    };
  }

  const payload = extractWeblioFromDom();
  if (payload.entries.length > 0) {
    const rd = payload.readings[0]?.reading ? ` (${payload.readings[0].reading})` : '';
    showSyncFab(`⟳ Đồng bộ Weblio "${payload.word}"${rd} → Studio`, () => {
      const fresh = extractWeblioFromDom();
      chrome.runtime.sendMessage({ type: 'ASS_SYNC_WEBLIO', payload: fresh }, (response) => {
        if (response?.ok) {
          showToast(
            `✓ Đã đồng bộ Weblio "${fresh.word}" (${fresh.entries.length} mục từ) sang Studio!`,
            true,
          );
        } else {
          showToast(`✗ Không đồng bộ được (${response?.error || 'Server offline'})`, false);
        }
      });
    });
  }
})();
