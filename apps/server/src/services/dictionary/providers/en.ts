import {
  stripIpaSlashes,
  type CambridgeLookupResult,
  type DictionaryEntryItem,
  type DictionaryReadingOption,
  type OxfordLookupResult,
} from '@ass/shared';
import { lookupOxfordUkIpa } from '../oxford.js';
import { lookupCambridge, lookupFreeDictionaryFallback } from '../cambridge.js';
import { loadSettings } from '../../../store.js';
import type { DictionaryProvider, UncachedLookupResponse } from './types.js';

export function cleanCambridgeDefinitionText(input: string): string {
  return (input || '')
    .replace(/\s*\+\s*Chọn vào Anki\s*$/gi, '')
    .replace(/\s*[:：]\s*$/, '')
    .trim();
}

export function adaptEnglishLookup(
  word: string,
  oxford: OxfordLookupResult,
  cambridge: CambridgeLookupResult,
  options?: { preferSource?: 'oxford' | 'cambridge' },
): UncachedLookupResponse {
  const sanitizedCambridge: CambridgeLookupResult = {
    ...cambridge,
    entries: cambridge.entries.map((entry) => ({
      ...entry,
      usIpa: entry.usIpa ? stripIpaSlashes(entry.usIpa) || undefined : undefined,
      ukIpa: entry.ukIpa ? stripIpaSlashes(entry.ukIpa) || undefined : undefined,
      blocks: entry.blocks.map((block) => ({
        ...block,
        senses: block.senses.map((sense) => ({
          ...sense,
          definition: cleanCambridgeDefinitionText(sense.definition),
        })),
      })),
    })),
  };

  const readings: DictionaryReadingOption[] = [];
  const pushReading = (opt: DictionaryReadingOption) => {
    const cleanVal = stripIpaSlashes(opt.reading);
    if (!cleanVal) return;
    const cleanAlt = opt.altReading ? stripIpaSlashes(opt.altReading) || undefined : undefined;
    if (readings.some((r) => r.pos === opt.pos && r.label === opt.label && r.reading === cleanVal)) {
      return;
    }
    readings.push({
      ...opt,
      reading: cleanVal,
      altReading: cleanAlt,
    });
  };

  const oxfordPastByPos = new Map<string, string>();
  let fallbackOxfordPast = '';
  for (const item of oxford.entries) {
    if (item.pastForms) {
      if (item.pos && !oxfordPastByPos.has(item.pos)) oxfordPastByPos.set(item.pos, item.pastForms);
      if (!fallbackOxfordPast) fallbackOxfordPast = item.pastForms;
    }
  }

  const pushOxfordReadings = () => {
    for (const item of oxford.entries) {
      const usVal = stripIpaSlashes(item.usIpa || '');
      const ukVal = stripIpaSlashes(item.ukIpa || '');
      if (usVal) {
        pushReading({
          id: `${item.id}_us`,
          headword: item.headword,
          pos: item.pos,
          reading: usVal,
          altReading: ukVal || undefined,
          label: 'US',
          ...(item.pastForms ? { autoFields: { pastForms: item.pastForms } } : {}),
          sourceUrl: item.sourceUrl,
        });
      }
      if (ukVal) {
        pushReading({
          id: `${item.id}_uk`,
          headword: item.headword,
          pos: item.pos,
          reading: ukVal,
          altReading: usVal || undefined,
          label: 'UK',
          ...(item.pastForms ? { autoFields: { pastForms: item.pastForms } } : {}),
          sourceUrl: item.sourceUrl,
        });
      }
    }
  };

  const pushCambridgeReadings = (filter?: { usOnly?: boolean; ukOnly?: boolean }) => {
    for (const entry of sanitizedCambridge.entries) {
      const pastForms = oxfordPastByPos.get(entry.pos) || fallbackOxfordPast;
      if (entry.usIpa && !filter?.ukOnly) {
        pushReading({
          id: `cam_rd_${entry.id}_us`,
          headword: entry.headword,
          pos: entry.pos,
          reading: entry.usIpa,
          altReading: entry.ukIpa,
          label: 'US',
          ...(pastForms ? { autoFields: { pastForms } } : {}),
          sourceUrl: sanitizedCambridge.sourceUrl,
        });
      }
      if (entry.ukIpa && !filter?.usOnly) {
        pushReading({
          id: `cam_rd_${entry.id}_uk`,
          headword: entry.headword,
          pos: entry.pos,
          reading: entry.ukIpa,
          altReading: entry.usIpa,
          label: 'UK',
          ...(pastForms ? { autoFields: { pastForms } } : {}),
          sourceUrl: sanitizedCambridge.sourceUrl,
        });
      }
    }
  };

  if (options?.preferSource === 'cambridge') {
    pushCambridgeReadings();
    if (!readings.some((r) => r.label === 'US') || !readings.some((r) => r.label === 'UK')) {
      pushOxfordReadings();
    }
  } else {
    pushOxfordReadings();
    const hasUs = readings.some((r) => r.label === 'US');
    const hasUk = readings.some((r) => r.label === 'UK');
    if (!hasUs && !hasUk) {
      pushCambridgeReadings();
    } else if (!hasUs) {
      pushCambridgeReadings({ usOnly: true });
    } else if (!hasUk) {
      pushCambridgeReadings({ ukOnly: true });
    }
  }

  readings.sort((a, b) => {
    const score = (l?: string) => (l === 'US' ? 0 : l === 'UK' ? 1 : 2);
    return score(a.label) - score(b.label);
  });

  const entries: DictionaryEntryItem[] = sanitizedCambridge.entries.map((entry) => ({
    id: entry.id,
    sourceId: 'cambridge',
    sourceName: 'Cambridge',
    headword: entry.headword,
    pos: entry.pos,
    reading: entry.usIpa || undefined,
    altReading: entry.ukIpa || undefined,
    blocks: entry.blocks,
    sourceUrl: sanitizedCambridge.sourceUrl,
  }));

  return {
    lang: 'en',
    word,
    primaryUrl: sanitizedCambridge.sourceUrl,
    secondaryUrl: oxford.sourceUrl,
    readings,
    entries,
    readingError: oxford.error,
    entryError: sanitizedCambridge.error,
    oxford,
    cambridge: sanitizedCambridge,
  };
}

export const enDictionaryProvider: DictionaryProvider = {
  lang: 'en',

  async lookup(word: string): Promise<UncachedLookupResponse> {
    const cambridgeMode = loadSettings().cambridgeMode || 'english';
    const [oxford, cambridge] = await Promise.all([
      lookupOxfordUkIpa(word),
      lookupCambridge(word, cambridgeMode),
    ]);

    let adapted = adaptEnglishLookup(word, oxford, cambridge);

    if (adapted.readings.length === 0) {
      const fallbackCam = await lookupFreeDictionaryFallback(word, cambridgeMode);
      if (fallbackCam.entries.length > 0) {
        const mergedCam = cambridge.entries.length > 0 ? cambridge : fallbackCam;
        adapted = adaptEnglishLookup(word, oxford, mergedCam);
        if (adapted.readings.length === 0) {
          for (const entry of fallbackCam.entries) {
            const ipaVal = entry.usIpa || entry.ukIpa;
            if (!ipaVal) continue;
            if (adapted.readings.some((r) => r.reading === ipaVal)) continue;
            adapted.readings.push({
              id: `fdict_rd_${entry.id}`,
              headword: entry.headword,
              pos: entry.pos,
              reading: ipaVal,
              label: 'US',
              sourceUrl: fallbackCam.sourceUrl,
            });
          }
        }
      }
    }

    return adapted;
  },

  async lookupFallback(word: string): Promise<UncachedLookupResponse> {
    const cambridgeMode = loadSettings().cambridgeMode || 'english';
    const cambridge = await lookupFreeDictionaryFallback(word, cambridgeMode);
    const oxford: OxfordLookupResult = {
      word,
      sourceUrl: `https://www.oxfordlearnersdictionaries.com/search/american_english/?q=${encodeURIComponent(word)}`,
      entries: [],
    };
    return adaptEnglishLookup(word, oxford, cambridge);
  },
};
