import * as cheerio from 'cheerio';
import {
  buildCambridgeUrl,
  normalizePos,
  stripIpaSlashes,
  type CambridgeAudioItem,
  type CambridgeDictMode,
  type CambridgeEntry,
  type CambridgeLookupResult,
  type CambridgeSense,
  type CambridgeSenseBlock,
} from '@ass/shared';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://dictionary.cambridge.org/',
  'Sec-Ch-Ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

function toCambridgeSlug(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/:$/, '')
    .trim();
}

function cleanDefinitionText($def: cheerio.Cheerio<any>): string {
  const $clone = $def.clone();
  $clone.find('.ass-pick-def-btn').remove();
  return cleanText($clone.text())
    .replace(/\s*\+\s*Chọn vào Anki\s*$/i, '')
    .replace(/\s*[:：]\s*$/, '')
    .trim();
}

export function parseCambridgeHtml(
  html: string,
  sourceUrl: string,
  fallbackWord: string,
): CambridgeLookupResult {
  const $ = cheerio.load(html);
  const entries: CambridgeEntry[] = [];

  // Primary English & Learner's Dictionary entries (.entry-body__el, .di-body .entry, or .entry-body)
  const entryElements = $('.entry-body__el, .pr.entry-body__el');
  const diEntries = $('.di-body .entry');
  const targets =
    entryElements.length > 0
      ? entryElements
      : diEntries.length > 0
        ? diEntries
        : $('.entry-body, .di-body');

  targets.each((entryIdx, entryEl) => {
    const $entry = $(entryEl);
    const $directHeader = $entry.children('.pos-header, .dpos-h').first();
    const $nonRunonHeader = $entry
      .find('.pos-header, .dpos-h')
      .filter((_, el) => $(el).closest('.runon, .drunon').length === 0)
      .first();
    const $header = $directHeader.length > 0 ? $directHeader : $nonRunonHeader;
    const $pronScope = $header.length > 0 ? $header : $entry;

    const headword =
      cleanText($pronScope.find('.hw.dhw, .di-title .hw, .di-title .dhw, .hw').first().text()) ||
      cleanText(
        $entry
          .find('.pos-header .hw.dhw, .dpos-h .hw.dhw, .di-title .hw, .di-title .dhw, .hw')
          .first()
          .text(),
      ) ||
      cleanText(
        $entry.closest('.di, .superentry, .entry-body').find('.di-title .hw, .di-title').first().text(),
      ) ||
      fallbackWord;
    const rawPos = cleanText(
      $pronScope.find('.pos.dpos, .posgram .pos.dpos, .pos').first().text() ||
        $entry
          .find('.pos-header .pos.dpos, .dpos-h .pos.dpos, .posgram .pos.dpos, .pos.dpos')
          .first()
          .text(),
    );
    const pos = normalizePos(rawPos);

    let rawUs = '';
    let rawUk = '';

    $pronScope
      .find('.dpron-i')
      .filter((_, el) => $(el).closest('.runon, .drunon').length === 0)
      .each((_, dpEl) => {
        const $dp = $(dpEl);
        const regionText = cleanText($dp.find('.region, .dreg').first().text()).toLowerCase();
        const isUs = $dp.hasClass('us') || regionText === 'us';
        const isUk = $dp.hasClass('uk') || regionText === 'uk';
        const ipaList = $dp
          .find('.ipa, .dipa')
          .map((__, ipaEl) => stripIpaSlashes(cleanText($(ipaEl).text())))
          .get()
          .filter(Boolean);
        const uniqueIpas = Array.from(new Set(ipaList));
        const ipaVal = uniqueIpas.join(', ');
        if (!ipaVal) return;
        if (isUs && !rawUs) rawUs = ipaVal;
        else if (isUk && !rawUk) rawUk = ipaVal;
      });

    if (!rawUs) {
      const $usIpa = $pronScope
        .find('.us .ipa, .us .dipa')
        .filter((_, el) => $(el).closest('.runon, .drunon').length === 0)
        .first();
      rawUs = stripIpaSlashes(cleanText($usIpa.text()));
    }
    if (!rawUk) {
      const $ukIpa = $pronScope
        .find('.uk .ipa, .uk .dipa')
        .filter((_, el) => $(el).closest('.runon, .drunon').length === 0)
        .first();
      rawUk = stripIpaSlashes(cleanText($ukIpa.text()));
    }

    const usIpa = rawUs || undefined;
    const ukIpa = rawUk || undefined;

    const blocks: CambridgeSenseBlock[] = [];

    const dsenses = $entry.find('.pos-body > .pr.dsense, .pr.dsense, .pos-body > .dsense, .dsense');
    if (dsenses.length > 0) {
      dsenses.each((blockIdx, blockEl) => {
        const $block = $(blockEl);
        const guideword = cleanText(
          $block
            .find('.dsense_h .guideword span, .dsense_h .guideword, .guideword span, .guideword')
            .first()
            .text(),
        ).replace(/^\(|\)$/g, '');

        const senses: CambridgeSense[] = [];
        $block.find('.def-block.ddef_block, .def-block, .ddef_block').each((senseIdx, senseEl) => {
          const $sense = $(senseEl);
          const definition = cleanDefinitionText($sense.find('.def.ddef_d, .def, .ddef_d').first());
          if (!definition) return;

          const level = cleanText($sense.find('.def-info .epp-xref').first().text()) || undefined;
          const examples: string[] = [];
          $sense.find('.examp.dexamp .eg.deg, .examp .eg, .dexamp .deg').each((_, exEl) => {
            const exText = cleanText($(exEl).text());
            if (exText && !examples.includes(exText)) {
              examples.push(exText);
            }
          });

          senses.push({
            id: `cam_${entryIdx}_${blockIdx}_${senseIdx}`,
            level,
            definition,
            examples,
          });
        });

        if (senses.length > 0) {
          blocks.push({
            id: `cam_blk_${entryIdx}_${blockIdx}`,
            guideword: guideword || undefined,
            senses,
          });
        }
      });
    } else {
      // Fallback for idioms / phrasal verb pages where def-blocks appear directly
      const senses: CambridgeSense[] = [];
      $entry.find('.def-block.ddef_block').each((senseIdx, senseEl) => {
        const $sense = $(senseEl);
        const definition = cleanDefinitionText($sense.find('.def.ddef_d').first());
        if (!definition) return;
        const level = cleanText($sense.find('.def-info .epp-xref').first().text()) || undefined;
        const examples: string[] = [];
        $sense.find('.examp.dexamp .eg.deg').each((_, exEl) => {
          const exText = cleanText($(exEl).text());
          if (exText && !examples.includes(exText)) {
            examples.push(exText);
          }
        });
        senses.push({
          id: `cam_${entryIdx}_0_${senseIdx}`,
          level,
          definition,
          examples,
        });
      });

      if (senses.length > 0) {
        blocks.push({
          id: `cam_blk_${entryIdx}_0`,
          senses,
        });
      }
    }

    if (blocks.length > 0) {
      entries.push({
        id: `cam_entry_${entryIdx}`,
        headword,
        pos,
        usIpa,
        ukIpa,
        blocks,
      });
    }
  });

  // Fallback for idiom-only pages
  if (entries.length === 0) {
    const idiomSenses: CambridgeSense[] = [];
    $('.idiom-block .def-block.ddef_block, .def-block.ddef_block').each((idx, senseEl) => {
      const $sense = $(senseEl);
      const definition = cleanDefinitionText($sense.find('.def.ddef_d').first());
      if (!definition) return;
      const level = cleanText($sense.find('.def-info .epp-xref').first().text()) || undefined;
      const examples: string[] = [];
      $sense.find('.examp.dexamp .eg.deg').each((_, exEl) => {
        const exText = cleanText($(exEl).text());
        if (exText && !examples.includes(exText)) examples.push(exText);
      });
      idiomSenses.push({
        id: `cam_fb_${idx}`,
        level,
        definition,
        examples,
      });
    });

    if (idiomSenses.length > 0) {
      entries.push({
        id: 'cam_entry_fb',
        headword: fallbackWord,
        pos: 'idiom',
        blocks: [{ id: 'cam_blk_fb', senses: idiomSenses }],
      });
    }
  }

  // Extract up to the first 2 unique MP3 audio files from Cambridge (excluding .runon derivatives)
  const audios: CambridgeAudioItem[] = [];
  const seenAudioUrls = new Set<string>();
  const pushAudioFromEl = (el: any) => {
    if (audios.length >= 2) return;
    const $audio = $(el);
    if ($audio.closest('.runon, .drunon').length > 0) return;
    const rawSrc =
      $audio.find('source[type="audio/mpeg"]').first().attr('src') ||
      $audio.find('source[src$=".mp3"]').first().attr('src') ||
      $audio.find('source').first().attr('src') ||
      '';
    if (!rawSrc) return;
    const fullUrl = rawSrc.startsWith('http')
      ? rawSrc
      : `https://dictionary.cambridge.org${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`;
    if (seenAudioUrls.has(fullUrl)) return;
    seenAudioUrls.add(fullUrl);
    const $dp = $audio.closest('.dpron-i');
    const regText = cleanText($dp.find('.region, .dreg').first().text()).toLowerCase();
    const region: 'us' | 'uk' | 'other' =
      $dp.hasClass('us') || regText === 'us' || fullUrl.includes('/us_pron/')
        ? 'us'
        : $dp.hasClass('uk') || regText === 'uk' || fullUrl.includes('/uk_pron/')
          ? 'uk'
          : 'other';
    const posText = normalizePos(
      cleanText($audio.closest('.entry-body__el').find('.pos-header .pos.dpos').first().text()),
    );
    audios.push({
      region,
      url: fullUrl,
      ...(posText ? { pos: posText } : {}),
    });
  };
  $('.entry-body__el .dpron-i audio, .dpron-i audio').each((_, el) => pushAudioFromEl(el));
  if (audios.length < 2) {
    $('audio').each((_, el) => pushAudioFromEl(el));
  }

  return {
    word: fallbackWord,
    sourceUrl,
    entries,
    ...(audios.length > 0 ? { audios } : {}),
    ...(entries.length === 0
      ? { error: 'Không tìm thấy định nghĩa Anh-Anh trên Cambridge cho từ này.' }
      : {}),
  };
}

export async function lookupCambridge(
  rawWord: string,
  mode: CambridgeDictMode = 'english',
): Promise<CambridgeLookupResult> {
  const word = rawWord.trim();
  const slug = toCambridgeSlug(word);
  const url = buildCambridgeUrl(word, mode);

  if (!slug) {
    return { word, sourceUrl: url, entries: [], error: 'Từ vựng trống.' };
  }

  const fetchSingleUrl = async (
    targetUrl: string,
  ): Promise<{ ok: boolean; status: number; finalUrl: string; html: string }> => {
    const response = await fetch(targetUrl, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(18000),
    });
    const html = response.ok ? await response.text() : '';
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || targetUrl,
      html,
    };
  };

  try {
    const primary = await fetchSingleUrl(url);

    if (primary.ok) {
      const parsed = parseCambridgeHtml(primary.html, primary.finalUrl, word);
      if (parsed.entries.length > 0 || mode === 'english') {
        return parsed;
      }
    }

    // If Learner's Dictionary does not have this word or returned an error on server,
    // try standard Cambridge English Dictionary on server before falling back to Extension sync.
    if (mode === 'learner-english') {
      const fallbackEnglishUrl = buildCambridgeUrl(word, 'english');
      try {
        const secondary = await fetchSingleUrl(fallbackEnglishUrl);
        if (secondary.ok) {
          const parsedSecondary = parseCambridgeHtml(
            secondary.html,
            secondary.finalUrl,
            word,
          );
          if (parsedSecondary.entries.length > 0) {
            return parsedSecondary;
          }
        }
      } catch {
        // ignore fallback error and return primary status
      }
    }

    if (!primary.ok) {
      const hint =
        primary.status === 403
          ? 'Cambridge chặn yêu cầu tự động từ server (403). Hãy bấm "Mở Cambridge trên trình duyệt" rồi bấm nút Đồng bộ của Extension để đưa toàn bộ nghĩa Cambridge vào đây (hoặc dùng nguồn dự phòng Free Dictionary API).'
          : `Cambridge trả về mã ${primary.status}.`;
      return {
        word,
        sourceUrl: url,
        entries: [],
        error: hint,
      };
    }

    return {
      word,
      sourceUrl: url,
      entries: [],
      error: 'Không tìm thấy định nghĩa Anh-Anh trên Cambridge cho từ này.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      word,
      sourceUrl: url,
      entries: [],
      error: `Không thể kết nối Cambridge (${message}).`,
    };
  }
}

/**
 * Documented public fallback using Free Dictionary API (https://dictionaryapi.dev)
 * when Cambridge blocks direct server requests.
 */
export async function lookupFreeDictionaryFallback(
  rawWord: string,
  mode: CambridgeDictMode = 'english',
): Promise<CambridgeLookupResult> {
  const word = rawWord.trim();
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`;

  if (!word) {
    return { word, sourceUrl: url, entries: [], error: 'Từ vựng trống.' };
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5500),
    });

    if (!response.ok) {
      return {
        word,
        sourceUrl: url,
        entries: [],
        error: `Free Dictionary API không tìm thấy từ "${word}" (mã ${response.status}).`,
      };
    }

    const data = (await response.json()) as Array<{
      word: string;
      phonetic?: string;
      phonetics?: Array<{ text?: string; audio?: string }>;
      meanings?: Array<{
        partOfSpeech?: string;
        definitions?: Array<{
          definition?: string;
          example?: string;
        }>;
      }>;
    }>;

    const entries: CambridgeEntry[] = [];
    data.forEach((item, itemIdx) => {
      const usPhonObj = item.phonetics?.find(
        (p) => p.text?.trim() && p.audio?.toLowerCase().includes('-us'),
      );
      const ukPhonObj = item.phonetics?.find(
        (p) => p.text?.trim() && p.audio?.toLowerCase().includes('-uk'),
      );
      const rawUs =
        usPhonObj?.text || item.phonetic || item.phonetics?.find((p) => p.text?.trim())?.text || '';
      const rawUk = ukPhonObj?.text || '';
      const usIpaText = stripIpaSlashes(rawUs) || undefined;
      const ukIpaText = stripIpaSlashes(rawUk) || usIpaText;
      (item.meanings ?? []).forEach((meaning, mIdx) => {
        const pos = normalizePos(meaning.partOfSpeech ?? '');
        const senses: CambridgeSense[] = (meaning.definitions ?? [])
          .filter((d) => d.definition?.trim())
          .map((d, dIdx) => ({
            id: `fdict_${itemIdx}_${mIdx}_${dIdx}`,
            definition: d.definition!.trim(),
            examples: d.example?.trim() ? [d.example.trim()] : [],
          }));

        if (senses.length > 0) {
          entries.push({
            id: `fdict_entry_${itemIdx}_${mIdx}`,
            headword: item.word || word,
            pos,
            usIpa: usIpaText,
            ukIpa: ukIpaText,
            blocks: [
              {
                id: `fdict_blk_${itemIdx}_${mIdx}`,
                guideword: 'Free Dictionary API (Fallback)',
                senses,
              },
            ],
          });
        }
      });
    });

    return {
      word,
      sourceUrl: buildCambridgeUrl(word, mode),
      entries,
      ...(entries.length === 0 ? { error: 'Không có định nghĩa từ nguồn dự phòng.' } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      word,
      sourceUrl: url,
      entries: [],
      error: `Không thể kết nối Free Dictionary API (${message}).`,
    };
  }
}
