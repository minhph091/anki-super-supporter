import * as cheerio from 'cheerio';
import {
  buildJapaneseFurigana,
  type DictionaryEntryItem,
  type DictionaryLookupResponse,
  type DictionaryReadingOption,
  type DictionarySenseGroup,
  type DictionarySenseItem,
} from '@ass/shared';

const WEBLIO_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

const PRIMARY_DICT_CLASSES: Record<string, string> = {
  Sgkdj: 'デジタル大辞泉',
  Jtnhj: '実用日本語表現辞典',
  Wdj: 'Weblio国語辞典',
  NetDicBody: '三省堂 大辞林',
  Sjs: '国語辞典',
  Ssd: '国語辞典',
  Jajcw: 'Wiktionary日本語',
};

const SKIP_DICT_CLASSES = new Set([
  'Wkpja',
  'Wkpkm',
  'Tssmj',
  'Skcin',
  'Ingdj',
  'Jmnep',
  'Osaka',
  'trnsMdlBxDsc',
  'Jjabc',
  'Cntnt',
  'Wblv',
]);

function cleanJaText(input: string): string {
  return input
    .replace(/[\u200b\u00a0\ue000-\uf8ff]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function cleanReadingText(raw: string): string {
  return raw
    .replace(/〔[^〕]*〕/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[・‐\-‐\s　]/g, '')
    .trim();
}

function extractReadingFromMidashigo(midashigo: string): string {
  const beforeBracket = midashigo.split('【')[0]?.trim() ?? '';
  if (!beforeBracket) return '';
  const cleaned = cleanReadingText(beforeBracket);
  // Ensure it is Hiragana/Katakana/prolonged mark
  if (/^[\u3040-\u30ffー]+$/.test(cleaned)) {
    return cleaned;
  }
  return '';
}

function extractCleanHeadword(titleAttr: string | undefined, midashigoText: string, fallback: string): string {
  const t = (titleAttr ?? '').trim();
  if (t) return t;
  const match = midashigoText.match(/【([^】]+)】/);
  if (match) {
    return match[1].split(/[／/]/)[0]?.replace(/[×▽△]/g, '').trim() || fallback;
  }
  return cleanJaText(midashigoText) || fallback;
}

function parseSgkdjParagraphs(
  $: cheerio.CheerioAPI,
  $body: ReturnType<cheerio.CheerioAPI>,
  entryPrefix: string,
): {
  readings: string[];
  pos: string;
  senses: DictionarySenseItem[];
} {
  const readings: string[] = [];
  let pos = '';
  const senses: DictionarySenseItem[] = [];

  const paragraphs = $body.children('p');
  const targets = paragraphs.length > 0 ? paragraphs : $body.find('p');

  let pendingNumberHeading = '';

  targets.each((pIdx, pEl) => {
    const $p = $(pEl);
    const raw = cleanJaText($p.text());
    if (!raw) return;

    // 1. Reading line: 読み方：たいふう
    const readingMatch = raw.match(/^読み方[：:]\s*(.+)$/);
    if (readingMatch) {
      const candidates = readingMatch[1]
        .split(/[、,／/]/)
        .map((c) => cleanReadingText(c))
        .filter(Boolean);
      for (const r of candidates) {
        if (!readings.includes(r)) readings.push(r);
      }
      return;
    }

    // 2. Skip supplementary / etymology / metadata sections
    if (/^(\[補説\]|\[派生\]|\[下接句\]|\[下接語\]|\[類語\]|\[用法\]|\[可能\]|出典[:：]|別表記[:：])/.test(raw)) {
      return;
    }

    // 3. Part of speech header line: <span class="hinshi">［動バ下一］</span>...
    const hinshiEl = $p.find('.hinshi').first();
    if (hinshiEl.length > 0) {
      const rawHinshi = cleanJaText(hinshiEl.text()).replace(/^［|］$/g, '').trim();
      if (rawHinshi && !pos) {
        pos = rawHinshi;
      }
      // If paragraph is purely grammatical metadata (starts with ［ and no numbered sense), skip as definition
      if (/^［/.test(raw) && !/^[１-９0-9]/.test(raw)) {
        return;
      }
    }

    // 4. Standalone quote paragraph (e.g. `「...」〈枕・八七〉`) -> keep inline with previous definition
    if (/^「[^」]+」/.test(raw) && senses.length > 0) {
      const lastSense = senses[senses.length - 1];
      lastSense.definition = `${lastSense.definition} ${raw}`.trim();
      return;
    }

    // 5. Pure number heading paragraph like `<p><b>３</b></p>`
    const onlyNumMatch = raw.match(/^([１-９0-9]{1,2})$/);
    if (onlyNumMatch) {
      pendingNumberHeading = onlyNumMatch[1];
      return;
    }

    // 6. Regular definition paragraph (keep any inline examples intact inside definition)
    let defLine = raw.replace(/^[１-９0-9]{1,2}\s+/, '').trim();
    if (/^[㋐-㋾]/.test(defLine) && pendingNumberHeading) {
      defLine = `${pendingNumberHeading}${defLine}`;
    } else if (!/^[㋐-㋾]/.test(defLine)) {
      pendingNumberHeading = '';
    }

    if (!defLine) return;

    senses.push({
      id: `${entryPrefix}_s_${pIdx}`,
      definition: defLine,
      examples: [],
    });
  });

  return { readings, pos, senses };
}

function parseGenericWeblioBody(
  $: cheerio.CheerioAPI,
  $body: ReturnType<cheerio.CheerioAPI>,
  entryPrefix: string,
): {
  readings: string[];
  pos: string;
  senses: DictionarySenseItem[];
} {
  const readings: string[] = [];
  const senses: DictionarySenseItem[] = [];

  const blocks = $body.find('p, .NetDicBody > div, li');
  const targets = blocks.length > 0 ? blocks : $body;

  targets.each((idx, el) => {
    const raw = cleanJaText($(el).text());
    if (!raw || raw.length < 2) return;

    const readingMatch = raw.match(/読み方[：:]\s*([^\n　]+)/);
    if (readingMatch) {
      const r = cleanReadingText(readingMatch[1]);
      if (r && !readings.includes(r)) readings.push(r);
      if (/^読み方[：:]/.test(raw)) return;
    }

    if (/^(別表記|英語|出典|関連語|広告|PR)/.test(raw)) return;

    if (!senses.some((s) => s.definition === raw)) {
      senses.push({
        id: `${entryPrefix}_g_${idx}`,
        definition: raw,
        examples: [],
      });
    }
  });

  return { readings, pos: '', senses: senses.slice(0, 8) };
}

export function parseWeblioHtml(
  html: string,
  sourceUrl: string,
  fallbackWord: string,
): Omit<DictionaryLookupResponse, 'cached'> {
  const $ = cheerio.load(html);
  const entries: DictionaryEntryItem[] = [];
  const readings: DictionaryReadingOption[] = [];

  const addReadingOption = (
    headword: string,
    pos: string,
    reading: string,
    idx: number,
  ) => {
    const clean = cleanReadingText(reading);
    if (!clean) return;
    if (readings.some((r) => r.reading === clean)) return;
    const furigana = buildJapaneseFurigana(headword, clean);
    readings.push({
      id: `weblio_rd_${idx}_${clean}`,
      headword,
      pos,
      reading: clean,
      label: '読み方',
      ...(furigana ? { autoFields: { furigana } } : {}),
      sourceUrl,
    });
  };

  let entryCounter = 0;

  $('.kijiWrp').each((_, wrpEl) => {
    const $wrp = $(wrpEl);
    const $kiji = $wrp.children('.kiji').first();
    if ($kiji.length === 0) return;

    // Pair each <h2 class="midashigo"> with its immediately following content <div>
    $kiji.children('h2.midashigo').each((_, h2El) => {
      const $h2 = $(h2El);
      const $contentDiv = $h2.next('div');
      if ($contentDiv.length === 0) return;

      const classAttr = ($contentDiv.attr('class') ?? '').trim();
      const dictClass = classAttr.split(/\s+/)[0] ?? '';

      if (SKIP_DICT_CLASSES.has(dictClass)) return;
      const sourceName = PRIMARY_DICT_CLASSES[dictClass];
      if (!sourceName) return;

      const midashigoText = cleanJaText($h2.text());
      const headword = extractCleanHeadword($h2.attr('title'), midashigoText, fallbackWord);
      const entryId = `weblio_${dictClass}_${entryCounter++}`;

      const parsed =
        dictClass === 'Sgkdj'
          ? parseSgkdjParagraphs($, $contentDiv, entryId)
          : parseGenericWeblioBody($, $contentDiv, entryId);

      // Fallback reading from h2.midashigo (e.g. た・べる【食べる】 -> たべる)
      if (parsed.readings.length === 0) {
        const fromHeader = extractReadingFromMidashigo(midashigoText);
        if (fromHeader) parsed.readings.push(fromHeader);
      }

      const primaryReading = parsed.readings[0];
      for (const r of parsed.readings) {
        addReadingOption(headword, parsed.pos, r, entryCounter);
      }

      if (parsed.senses.length === 0) return;

      const furigana = primaryReading ? buildJapaneseFurigana(headword, primaryReading) : '';
      const blocks: DictionarySenseGroup[] = [
        {
          id: `${entryId}_blk_0`,
          senses: parsed.senses,
        },
      ];

      entries.push({
        id: entryId,
        sourceId: 'weblio',
        sourceName,
        headword,
        pos: parsed.pos,
        reading: primaryReading,
        ...(furigana ? { autoFields: { furigana } } : {}),
        blocks,
        sourceUrl,
      });
    });
  });

  // Sort entries so デジタル大辞泉 & 実用日本語表現辞典 appear first
  const priorityOrder = ['デジタル大辞泉', '実用日本語表現辞典', 'Weblio国語辞典', '三省堂 大辞林'];
  entries.sort((a, b) => {
    const pa = priorityOrder.indexOf(a.sourceName);
    const pb = priorityOrder.indexOf(b.sourceName);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });

  const jishoUrl = `https://jisho.org/search/${encodeURIComponent(fallbackWord)}`;

  return {
    lang: 'ja',
    word: fallbackWord,
    primaryUrl: sourceUrl,
    secondaryUrl: jishoUrl,
    readings,
    entries,
    ...(readings.length === 0 ? { readingError: 'Không tìm thấy 読み方 trên Weblio cho từ này.' } : {}),
    ...(entries.length === 0
      ? {
          entryError:
            'Không tìm thấy mục từ phù hợp trên Weblio.jp. Bạn có thể mở trang Weblio gốc hoặc dùng nguồn dự phòng Jisho.org.',
        }
      : {}),
    oxford: { word: fallbackWord, sourceUrl, entries: [] },
    cambridge: { word: fallbackWord, sourceUrl, entries: [] },
  };
}

export async function lookupWeblio(rawWord: string): Promise<Omit<DictionaryLookupResponse, 'cached'>> {
  const word = rawWord.trim();
  const url = `https://www.weblio.jp/content/${encodeURIComponent(word)}`;
  const jishoUrl = `https://jisho.org/search/${encodeURIComponent(word)}`;

  if (!word) {
    return {
      lang: 'ja',
      word,
      primaryUrl: url,
      secondaryUrl: jishoUrl,
      readings: [],
      entries: [],
      entryError: 'Từ vựng trống.',
      oxford: { word, sourceUrl: url, entries: [] },
      cambridge: { word, sourceUrl: url, entries: [] },
    };
  }

  try {
    const response = await fetch(url, {
      headers: WEBLIO_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(14000),
    });

    if (!response.ok) {
      return {
        lang: 'ja',
        word,
        primaryUrl: url,
        secondaryUrl: jishoUrl,
        readings: [],
        entries: [],
        entryError: `Weblio.jp trả về mã ${response.status}. Bạn có thể mở trang Weblio gốc hoặc dùng nguồn dự phòng Jisho.org.`,
        oxford: { word, sourceUrl: url, entries: [] },
        cambridge: { word, sourceUrl: url, entries: [] },
      };
    }

    const html = await response.text();
    return parseWeblioHtml(html, response.url || url, word);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      lang: 'ja',
      word,
      primaryUrl: url,
      secondaryUrl: jishoUrl,
      readings: [],
      entries: [],
      entryError: `Không thể kết nối Weblio.jp (${message}).`,
      oxford: { word, sourceUrl: url, entries: [] },
      cambridge: { word, sourceUrl: url, entries: [] },
    };
  }
}
