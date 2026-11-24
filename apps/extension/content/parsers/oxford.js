(() => {
  const ASS = window.__ASS__;
  if (!ASS) return;
  const { cleanText, isHumanVerificationPage, showToast, showSyncFab } = ASS;

  function extractOxfordFromDom() {
    const headword = cleanText(
      document.querySelector(
        '.top-g .webtop-g .h, .webtop-g .h, .webtop .headword, h1.headword, h2.h, h1.h',
      )?.textContent,
    );
    const pos = cleanText(
      document.querySelector(
        '.top-g .webtop-g .pos, .top-g > .pos-g .pos, .webtop .pos, .webtop-g .pos, span.pos',
      )?.textContent,
    ).toLowerCase();

    const stripSlashes = (v) =>
      v
        ? v
            .replace(/^(?:NAmE|BrE)\s*/i, '')
            .trim()
            .replace(/^\/+|\/+$/g, '')
            .trim()
        : '';

    const readCleanOxfordPhon = (phonEl) => {
      if (!phonEl) return '';
      const clone = phonEl.cloneNode(true);
      clone.querySelectorAll('.name, .separator, .wrap').forEach((n) => n.remove());
      return stripSlashes(cleanText(clone.textContent));
    };

    const isInsideSecondaryBlock = (el) =>
      Boolean(el.closest('.if-gs, .if-g, .idm-gs, .idm-g, .phrasal_verb_links, .unbox'));

    const findFirstPhon = (selectors, excludeBr = false) => {
      for (const sel of selectors) {
        const nodes = Array.from(document.querySelectorAll(sel));
        for (const el of nodes) {
          if (isInsideSecondaryBlock(el)) continue;
          if (excludeBr && (el.closest('.phons_br') || el.closest('[geo="br"]'))) continue;
          const val = readCleanOxfordPhon(el);
          if (val) return val;
        }
      }
      return '';
    };

    const usIpa = findFirstPhon(
      [
        '.top-g > .pron-gs .pron-g[geo="n_am"] .phon',
        '.top-g .pron-g[geo="n_am"] .phon',
        '.webtop .phons_n_am .phon',
        '.phons_n_am .phon',
        '.top-g > .pron-gs .phon',
        '.webtop .phonetics .phon',
        '.webtop .phon',
        '.webtop-g .phon',
      ],
      true,
    );

    const ukIpa =
      findFirstPhon(
        [
          '.top-g > .pron-gs .pron-g[geo="br"] .phon',
          '.top-g .pron-g[geo="br"] .phon',
          '.webtop .phons_br .phon',
          '.phons_br .phon',
        ],
        false,
      ) || undefined;

    const pastSimple = [];
    const pastParticiple = [];
    const vfTable = document.querySelector('.verb_forms_table');
    if (vfTable) {
      const readCell = (tr) => {
        const td = tr.querySelector('td.verb_form') || tr.querySelector('td');
        if (!td) return '';
        const clone = td.cloneNode(true);
        clone
          .querySelectorAll('.vf_prefix, .phonetics, .phon, .sound, .geo, .label, .reg')
          .forEach((n) => n.remove());
        return cleanText(clone.textContent.replace(/[\u200b\u00a0]/g, ' ').replace(/\(\s*\)/g, ''));
      };
      vfTable
        .querySelectorAll('tr.verb_form[form="past"], tr[form="past"], tr[form="pt"]')
        .forEach((tr) => {
          const v = readCell(tr);
          if (v && !pastSimple.includes(v)) pastSimple.push(v);
        });
      vfTable
        .querySelectorAll('tr.verb_form[form="pastpart"], tr[form="pastpart"], tr[form="pp"]')
        .forEach((tr) => {
          const v = readCell(tr);
          if (v && !pastParticiple.includes(v)) pastParticiple.push(v);
        });
      if (pastSimple.length === 0 && pastParticiple.length === 0) {
        vfTable.querySelectorAll('tr').forEach((tr) => {
          const prefix = cleanText(tr.querySelector('.vf_prefix')?.textContent).toLowerCase();
          const v = readCell(tr);
          if (!v) return;
          if ((prefix.includes('past simple') || prefix.includes('past tense')) && !pastSimple.includes(v)) {
            pastSimple.push(v);
          } else if (prefix.includes('past participle') && !pastParticiple.includes(v)) {
            pastParticiple.push(v);
          }
        });
      }
    }

    if (pastSimple.length === 0 && pastParticiple.length === 0) {
      document.querySelectorAll('.top-g > .if-gs .if-g').forEach((ifG) => {
        const prefix = cleanText(ifG.querySelector('.prefix')?.textContent).toLowerCase();
        const forms = Array.from(ifG.querySelectorAll('.if'))
          .map((el) => cleanText(el.textContent))
          .filter(Boolean);
        if (!prefix || forms.length === 0) return;
        const isPast =
          prefix.includes('past tense') || prefix.includes('past simple') || prefix === 'pt';
        const isPart = prefix.includes('past participle') || prefix === 'pp';
        if (isPast) {
          forms.forEach((f) => {
            if (!pastSimple.includes(f)) pastSimple.push(f);
          });
        }
        if (isPart) {
          forms.forEach((f) => {
            if (!pastParticiple.includes(f)) pastParticiple.push(f);
          });
        }
      });
    }

    const vfParts = [];
    if (pastSimple.length > 0) vfParts.push(pastSimple.join(' / '));
    if (pastParticiple.length > 0) vfParts.push(pastParticiple.join(' / '));
    const pastForms = vfParts.length > 0 ? vfParts.join(', ') : undefined;

    const entries =
      usIpa || ukIpa || pastForms
        ? [
            {
              id: `ox_ext_${headword}_${pos || 'any'}`,
              headword,
              pos,
              usIpa,
              ukIpa,
              ...(pastSimple.length > 0 ? { pastSimple } : {}),
              ...(pastParticiple.length > 0 ? { pastParticiple } : {}),
              ...(pastForms ? { pastForms } : {}),
              sourceUrl: window.location.href,
            },
          ]
        : [];

    return {
      word: headword,
      sourceUrl: window.location.href,
      entries,
    };
  }

  const payload = extractOxfordFromDom();

  chrome.runtime.sendMessage({ type: 'ASS_CHECK_AUTO_SYNC_TAB' }, (job) => {
    if (chrome.runtime.lastError || !job?.isAutoSyncTab || job.site !== 'oxford') return;

    let attempts = 0;
    const maxAttempts = 12;

    const runAutoSyncOxford = () => {
      const fresh = extractOxfordFromDom();
      if (fresh.entries.length > 0) {
        const syncPayload = {
          ...fresh,
          word: job.word || fresh.word,
        };
        chrome.runtime.sendMessage({ type: 'ASS_SYNC_OXFORD', payload: syncPayload }, (response) => {
          if (response?.ok) {
            chrome.runtime.sendMessage({ type: 'ASS_AUTO_SYNC_COMPLETE' });
          } else {
            chrome.runtime.sendMessage({
              type: 'ASS_AUTO_SYNC_NEEDS_USER',
              reason: 'server_offline',
            });
          }
        });
        return;
      }

      if (isHumanVerificationPage()) {
        chrome.runtime.sendMessage({
          type: 'ASS_AUTO_SYNC_NEEDS_USER',
          reason: 'verification',
        });
        return;
      }

      if (window.location.pathname.includes('/search/')) {
        const firstDefLink = document.querySelector(
          '#search-results a[href*="/definition/american_english/"], .result-list1 a[href*="/definition/american_english/"], a[href*="/definition/american_english/"]',
        );
        const href = firstDefLink?.getAttribute('href');
        const hopKey = `ass_ox_hop_${job.requestId || job.word}`;
        if (href && !sessionStorage.getItem(hopKey)) {
          sessionStorage.setItem(hopKey, '1');
          window.location.href = href.startsWith('http')
            ? href
            : `https://www.oxfordlearnersdictionaries.com${href}`;
          return;
        }
      }

      const isSpellcheck = window.location.pathname.includes('/spellcheck/');
      if (!isSpellcheck && attempts < maxAttempts) {
        attempts += 1;
        setTimeout(runAutoSyncOxford, 500);
        return;
      }

      chrome.runtime.sendMessage({
        type: 'ASS_AUTO_SYNC_NEEDS_USER',
        reason: 'not_found',
      });
    };

    if (payload.entries.length > 0 || document.readyState === 'complete') {
      runAutoSyncOxford();
    } else {
      window.addEventListener('load', runAutoSyncOxford, { once: true });
    }
  });

  if (payload.entries.length > 0) {
    const oxLabel = payload.entries[0].usIpa
      ? `US IPA (${payload.entries[0].usIpa})`
      : `UK IPA (${payload.entries[0].ukIpa})`;
    showSyncFab(`⟳ Đồng bộ Oxford ${oxLabel} → Studio`, () => {
      const fresh = extractOxfordFromDom();
      chrome.runtime.sendMessage({ type: 'ASS_SYNC_OXFORD', payload: fresh }, (response) => {
        if (response?.ok) {
          const syncedIpa = fresh.entries[0]?.usIpa || fresh.entries[0]?.ukIpa || '';
          showToast(`✓ Đã đồng bộ IPA ${syncedIpa} sang Studio!`, true);
        } else {
          showToast(`✗ Không đồng bộ được (${response?.error || 'Server offline'})`, false);
        }
      });
    });
  }
})();
