import * as cheerio from 'cheerio';
import {
  normalizePos,
  stripIpaSlashes,
  type OxfordIpaItem,
  type OxfordLookupResult,
} from '@ass/shared';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function toOxfordSlug(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ParsedOxfordPage {
  item: OxfordIpaItem | null;
  homographUrls: string[];
}

function extractOxfordVerbForms($: cheerio.CheerioAPI): {
  pastSimple: string[];
  pastParticiple: string[];
  pastForms?: string;
} {
  const pastSimple: string[] = [];
  const pastParticiple: string[] = [];

  const table = $('.verb_forms_table').first();
  if (table.length > 0) {
    const cleanVerbCell = (row: ReturnType<cheerio.CheerioAPI>): string => {
      const td = row.find('td.verb_form').first().clone();
      if (td.length === 0) return '';
      td.find('.vf_prefix, .phonetics, .phon, .sound, .geo, .label, .reg').remove();
      return td
        .text()
        .replace(/[\u200b\u00a0]/g, ' ')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    table.find('tr.verb_form[form="past"], tr[form="past"], tr[form="pt"]').each((_, tr) => {
      const val = cleanVerbCell($(tr));
      if (val && !pastSimple.includes(val)) {
        pastSimple.push(val);
      }
    });

    table.find('tr.verb_form[form="pastpart"], tr[form="pastpart"], tr[form="pp"]').each((_, tr) => {
      const val = cleanVerbCell($(tr));
      if (val && !pastParticiple.includes(val)) {
        pastParticiple.push(val);
      }
    });

    // Fallback if Oxford omits form="past" / form="pastpart" attributes (including American English "past tense")
    if (pastSimple.length === 0 && pastParticiple.length === 0) {
      table.find('tr').each((_, tr) => {
        const row = $(tr);
        const prefix = row.find('.vf_prefix').text().trim().toLowerCase();
        const val = cleanVerbCell(row);
        if (!val) return;
        if ((prefix.includes('past simple') || prefix.includes('past tense')) && !pastSimple.includes(val)) {
          pastSimple.push(val);
        } else if (prefix.includes('past participle') && !pastParticiple.includes(val)) {
          pastParticiple.push(val);
        }
      });
    }
  }

  // OAAD (American English) inline inflections fallback (e.g. past tense / past participle in .top-g > .if-gs)
  if (pastSimple.length === 0 && pastParticiple.length === 0) {
    $('.top-g > .if-gs .if-g').each((_, ifEl) => {
      const $ifG = $(ifEl);
      const prefix = $ifG.find('.prefix').first().text().trim().toLowerCase();
      if (!prefix) return;
      const isPast =
        prefix.includes('past tense') || prefix.includes('past simple') || prefix === 'pt';
      const isPart = prefix.includes('past participle') || prefix === 'pp';
      if (!isPast && !isPart) return;
      $ifG.find('.if').each((__, fEl) => {
        const val = $(fEl).text().replace(/\s+/g, ' ').trim();
        if (!val) return;
        if (isPast && !pastSimple.includes(val)) pastSimple.push(val);
        if (isPart && !pastParticiple.includes(val)) pastParticiple.push(val);
      });
    });
  }

  const parts: string[] = [];
  if (pastSimple.length > 0) parts.push(pastSimple.join(' / '));
  if (pastParticiple.length > 0) parts.push(pastParticiple.join(' / '));

  return {
    pastSimple,
    pastParticiple,
    pastForms: parts.length > 0 ? parts.join(', ') : undefined,
  };
}

function readCleanOxfordPhon($: cheerio.CheerioAPI, el: any): string {
  const $clone = $(el).clone();
  $clone.find('.name, .separator, .wrap').remove();
  return stripIpaSlashes(
    $clone
      .text()
      .replace(/^(?:NAmE|BrE)\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

export function parseOxfordHtml(
  html: string,
  pageUrl: string,
  fallbackWord: string,
): ParsedOxfordPage {
  const $ = cheerio.load(html);
  const headword =
    $('.top-g .webtop-g .h, .webtop-g .h, .webtop .headword, h1.headword, h2.h')
      .first()
      .text()
      .trim() || fallbackWord;
  const rawPos =
    $('.top-g .webtop-g .pos, .top-g > .pos-g .pos, .webtop .pos, span.pos')
      .first()
      .text()
      .trim() || '';

  const isSecondary = (el: any): boolean =>
    $(el).closest('.if-gs, .if-g, .idm-gs, .idm-g, .unbox').length > 0;

  const usPhons: string[] = [];
  const collectUs = (selector: string) => {
    $(selector).each((_, el) => {
      if (isSecondary(el)) return;
      if ($(el).closest('.phons_br, [geo="br"]').length > 0) return;
      const text = readCleanOxfordPhon($, el);
      if (text && !usPhons.includes(text)) {
        usPhons.push(text);
      }
    });
  };

  collectUs('.top-g > .pron-gs .pron-g[geo="n_am"] .phon');
  collectUs('.webtop .phons_n_am .phon, .phons_n_am .phon');
  if (usPhons.length === 0) {
    collectUs('.top-g > .pron-gs .phon');
  }

  const ukPhons: string[] = [];
  const collectUk = (selector: string) => {
    $(selector).each((_, el) => {
      if (isSecondary(el)) return;
      const text = readCleanOxfordPhon($, el);
      if (text && !ukPhons.includes(text)) {
        ukPhons.push(text);
      }
    });
  };
  collectUk('.top-g > .pron-gs .pron-g[geo="br"] .phon');
  collectUk('.webtop .phons_br .phon, .phons_br .phon');

  // Only fall back to generic .phon if neither US nor UK wrapper matched
  if (usPhons.length === 0 && ukPhons.length === 0) {
    const fallbackPhon = readCleanOxfordPhon($, $('.webtop .phon').first());
    if (fallbackPhon) usPhons.push(fallbackPhon);
  }

  const usIpa = usPhons[0] ?? '';
  const ukIpa = ukPhons[0] || undefined;
  const pos = normalizePos(rawPos);
  const { pastSimple, pastParticiple, pastForms } = extractOxfordVerbForms($);

  const homographUrls: string[] = [];
  const baseSlug = toOxfordSlug(fallbackWord);
  $('#relatedentries a, .relatedentries a, #search-results a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const fullUrl = href.startsWith('http')
      ? href
      : `https://www.oxfordlearnersdictionaries.com${href}`;
    const match = fullUrl.match(
      /\/definition\/(?:american_english|english)\/([a-z0-9-]+?)(?:_(\d+))?(?:\?|$|#)/i,
    );
    if (match && match[1].toLowerCase() === baseSlug && fullUrl !== pageUrl) {
      if (!homographUrls.includes(fullUrl)) {
        homographUrls.push(fullUrl);
      }
    }
  });

  const item: OxfordIpaItem | null =
    usIpa || ukIpa || pastForms
      ? {
        id: `ox_${toOxfordSlug(headword)}_${pos || 'any'}_${usIpa || ukIpa || 'noipa'}`,
        headword,
        pos,
        usIpa,
        ukIpa,
        ...(pastSimple.length > 0 ? { pastSimple } : {}),
        ...(pastParticiple.length > 0 ? { pastParticiple } : {}),
        ...(pastForms ? { pastForms } : {}),
        sourceUrl: pageUrl,
      }
      : null;

  return { item, homographUrls: homographUrls.slice(0, 2) };
}

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; url: string; html: string }> {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(18000),
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, url: response.url || url, html };
}

export async function lookupOxfordUkIpa(rawWord: string): Promise<OxfordLookupResult> {
  const word = rawWord.trim();
  const slug = toOxfordSlug(word);
  const searchUrl = `https://www.oxfordlearnersdictionaries.com/search/american_english/?q=${encodeURIComponent(word)}`;

  if (!slug) {
    return { word, sourceUrl: searchUrl, entries: [], error: 'Từ vựng trống.' };
  }

  try {
    const page = await fetchHtml(searchUrl);

    if (!page.ok) {
      return {
        word,
        sourceUrl: searchUrl,
        entries: [],
        error: `Oxford trả về mã ${page.status}. Bạn có thể mở trang Oxford trực tiếp hoặc dùng US IPA từ Cambridge.`,
      };
    }

    const parsed = parseOxfordHtml(page.html, page.url, word);
    const entries: OxfordIpaItem[] = [];

    if (parsed.item) {
      entries.push(parsed.item);
    }

    // Fetch homograph pages (e.g. record_1 noun, record_2 verb) in parallel so user gets all POS US IPAs
    if (parsed.homographUrls.length > 0) {
      const extraPages = await Promise.allSettled(
        parsed.homographUrls.map((u) => fetchHtml(u)),
      );
      for (const result of extraPages) {
        if (result.status !== 'fulfilled' || !result.value.ok) continue;
        const extra = parseOxfordHtml(result.value.html, result.value.url, word);
        if (
          extra.item &&
          !entries.some(
            (e) =>
              e.pos === extra.item!.pos &&
              e.usIpa === extra.item!.usIpa &&
              e.pastForms === extra.item!.pastForms,
          )
        ) {
          entries.push(extra.item);
        }
      }
    }

    return {
      word,
      sourceUrl: page.url || searchUrl,
      entries,
      ...(entries.length === 0
        ? { error: 'Không tìm thấy US IPA trên Oxford cho từ này.' }
        : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      word,
      sourceUrl: searchUrl,
      entries: [],
      error: `Không thể kết nối Oxford (${message}).`,
    };
  }
}
