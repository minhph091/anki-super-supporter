import {
  buildJapaneseFurigana,
  type DictionaryEntryItem,
  type DictionaryLookupResponse,
  type DictionaryReadingOption,
  type DictionarySenseItem,
} from '@ass/shared';

interface JishoApiWord {
  slug?: string;
  jlpt?: string[];
  japanese?: Array<{ word?: string; reading?: string }>;
  senses?: Array<{
    english_definitions?: string[];
    parts_of_speech?: string[];
  }>;
}

interface JishoApiResponse {
  data?: JishoApiWord[];
}

export async function lookupJishoFallback(
  rawWord: string,
): Promise<Omit<DictionaryLookupResponse, 'cached'>> {
  const word = rawWord.trim();
  const weblioUrl = `https://www.weblio.jp/content/${encodeURIComponent(word)}`;
  const jishoUrl = `https://jisho.org/search/${encodeURIComponent(word)}`;

  if (!word) {
    return {
      lang: 'ja',
      word,
      primaryUrl: weblioUrl,
      secondaryUrl: jishoUrl,
      readings: [],
      entries: [],
      entryError: 'Từ vựng trống.',
      oxford: { word, sourceUrl: weblioUrl, entries: [] },
      cambridge: { word, sourceUrl: jishoUrl, entries: [] },
    };
  }

  try {
    const resp = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`,
      {
        headers: {
          'User-Agent': 'AnkiSuperSupporter/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      },
    );

    if (!resp.ok) {
      return {
        lang: 'ja',
        word,
        primaryUrl: weblioUrl,
        secondaryUrl: jishoUrl,
        readings: [],
        entries: [],
        entryError: `Jisho.org trả về mã ${resp.status}.`,
        oxford: { word, sourceUrl: weblioUrl, entries: [] },
        cambridge: { word, sourceUrl: jishoUrl, entries: [] },
      };
    }

    const json = (await resp.json()) as JishoApiResponse;
    const rows = Array.isArray(json.data) ? json.data.slice(0, 6) : [];

    const readings: DictionaryReadingOption[] = [];
    const entries: DictionaryEntryItem[] = [];

    rows.forEach((row, idx) => {
      const jp = row.japanese?.[0];
      const headword = jp?.word || jp?.reading || row.slug || word;
      const reading = jp?.reading || '';
      const jlptRaw = row.jlpt?.[0] ?? '';
      const jlptBadge = jlptRaw ? jlptRaw.replace(/^jlpt-/i, '').toUpperCase() : undefined;
      const firstPos = row.senses?.[0]?.parts_of_speech?.[0] ?? '';
      const furigana = reading ? buildJapaneseFurigana(headword, reading) : '';

      if (reading && !readings.some((r) => r.reading === reading)) {
        readings.push({
          id: `jisho_rd_${idx}_${reading}`,
          headword,
          pos: firstPos,
          reading,
          label: '読み方',
          ...(furigana ? { autoFields: { furigana } } : {}),
          sourceUrl: jishoUrl,
        });
      }

      const senses: DictionarySenseItem[] = (row.senses ?? [])
        .map((s, sIdx) => ({
          id: `jisho_${idx}_s_${sIdx}`,
          level: sIdx === 0 ? jlptBadge : undefined,
          definition: (s.english_definitions ?? []).join('; '),
          examples: [],
        }))
        .filter((s) => Boolean(s.definition));

      if (senses.length > 0) {
        entries.push({
          id: `jisho_entry_${idx}`,
          sourceId: 'jisho',
          sourceName: 'Jisho.org',
          headword,
          pos: firstPos,
          reading: reading || undefined,
          ...(furigana ? { autoFields: { furigana } } : {}),
          blocks: [{ id: `jisho_blk_${idx}`, senses }],
          sourceUrl: jishoUrl,
        });
      }
    });

    return {
      lang: 'ja',
      word,
      primaryUrl: weblioUrl,
      secondaryUrl: jishoUrl,
      readings,
      entries,
      ...(entries.length === 0 ? { entryError: 'Không tìm thấy mục từ trên Jisho.org.' } : {}),
      oxford: { word, sourceUrl: weblioUrl, entries: [] },
      cambridge: { word, sourceUrl: jishoUrl, entries: [] },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      lang: 'ja',
      word,
      primaryUrl: weblioUrl,
      secondaryUrl: jishoUrl,
      readings: [],
      entries: [],
      entryError: `Không thể kết nối Jisho.org (${message}).`,
      oxford: { word, sourceUrl: weblioUrl, entries: [] },
      cambridge: { word, sourceUrl: jishoUrl, entries: [] },
    };
  }
}
