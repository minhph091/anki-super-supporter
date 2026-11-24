import type {
  CambridgeDictMode,
  FieldMapping,
  FieldVisibility,
  LanguageCode,
  LanguageProfile,
} from './index.js';

export interface LanguageFieldMeta {
  key: keyof FieldMapping;
  label: string;
  defaultAnkiField: string;
  placeholder: string;
  hint?: string;
  toggleable: boolean;
  defaultVisible: boolean;
}

export interface LanguageDefinition {
  code: LanguageCode;
  name: string;
  nativeName: string;
  shortLabel: string;
  subtitle: string;
  viewerTitle: string;
  viewerLoadingHint: string;
  primarySourceLabel: string;
  secondarySourceLabel?: string;
  fallbackLabel: string;
  readingBadgeLabel: string;
  supportsPosFormat: boolean;
  stripReadingSlashes: boolean;
  normalizePos: boolean;
  viewerFilterMode: 'pos' | 'source';
  accentTheme: 'indigo' | 'rose';
  defaultDeckPlaceholder: string;
  readingErrorHint: string;
  fallbackToastMessage: string;
  fields: LanguageFieldMeta[];
  defaultTtsInstructions: string;
  defaultGeminiPrompt: string;
  previewWord: string;
}

export const LANGUAGE_DEFINITIONS: Record<LanguageCode, LanguageDefinition> = {
  en: {
    code: 'en',
    name: 'Tiếng Anh',
    nativeName: 'English',
    shortLabel: 'EN',
    subtitle: 'Oxford IPA · Cambridge',
    viewerTitle: 'Cambridge Viewer',
    viewerLoadingHint: 'Đang lấy US IPA từ Oxford & định nghĩa từ Cambridge',
    primarySourceLabel: 'Cambridge',
    secondarySourceLabel: 'Oxford',
    fallbackLabel: 'Nguồn dự phòng (Free Dictionary)',
    readingBadgeLabel: 'US',
    supportsPosFormat: true,
    stripReadingSlashes: true,
    normalizePos: true,
    viewerFilterMode: 'pos',
    accentTheme: 'indigo',
    defaultDeckPlaceholder: 'VD: English::Vocabulary',
    readingErrorHint: 'Oxford bị chặn (403) · Mở Oxford để đồng bộ',
    fallbackToastMessage: 'Đã tải định nghĩa Anh-Anh từ Free Dictionary API.',
    defaultTtsInstructions:
      'Pronounce this single English vocabulary word clearly, naturally, and accurately in British English.',
    defaultGeminiPrompt:
      'Tạo câu ví dụ tiếng Anh cho từ vựng "{{word}}" kèm bản dịch tiếng Việt.',
    previewWord: 'resilient',
    fields: [
      {
        key: 'word',
        label: 'Từ vựng (Word)',
        defaultAnkiField: 'Word',
        placeholder: 'Nhập từ tiếng Anh...',
        toggleable: false,
        defaultVisible: true,
      },
      {
        key: 'ipa',
        label: 'Phiên âm (IPA)',
        defaultAnkiField: 'IPA',
        placeholder: 'rɪˈzɪljənt',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'partOfSpeech',
        label: 'Từ loại (POS)',
        defaultAnkiField: 'PartOfSpeech',
        placeholder: 'noun, verb, adjective...',
        toggleable: true,
        defaultVisible: false,
      },
      {
        key: 'definition',
        label: 'Định nghĩa (Definition)',
        defaultAnkiField: 'Definition',
        placeholder: 'Nhập Definition...',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'exampleEn',
        label: 'Ví dụ Tiếng Anh (Example EN)',
        defaultAnkiField: 'Example',
        placeholder: 'Nhập Example...',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'exampleVi',
        label: 'Ví dụ Tiếng Việt (Example VI)',
        defaultAnkiField: 'ExampleVI',
        placeholder: 'Nhập ExampleVI...',
        toggleable: true,
        defaultVisible: false,
      },
      {
        key: 'image',
        label: 'Hình ảnh (Image)',
        defaultAnkiField: 'Image',
        placeholder: '',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'typeAnswer',
        label: 'Type Answer',
        defaultAnkiField: 'Type Answer',
        placeholder: 'Nhập Type Answer...',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'pastForms',
        label: 'Past Simple and Past Participle',
        defaultAnkiField: 'Past Simple and Past Participle',
        placeholder: 'VD: went, gone',
        hint: 'Tự tra Oxford, phân cách bằng dấu ,',
        toggleable: true,
        defaultVisible: false,
      },
      {
        key: 'wordAudio',
        label: 'Âm thanh Từ vựng',
        defaultAnkiField: 'WordAudio',
        placeholder: '',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'exampleAudio',
        label: 'Âm thanh Câu ví dụ',
        defaultAnkiField: 'ExampleAudio',
        placeholder: '',
        toggleable: true,
        defaultVisible: true,
      },
    ],
  },

  ja: {
    code: 'ja',
    name: 'Tiếng Nhật',
    nativeName: '日本語',
    shortLabel: 'JP',
    subtitle: 'Weblio.jp (国語辞典)',
    viewerTitle: 'Weblio Viewer',
    viewerLoadingHint: 'Đang lấy 読み方 & định nghĩa từ Weblio.jp',
    primarySourceLabel: 'Weblio',
    secondarySourceLabel: 'Jisho',
    fallbackLabel: 'Nguồn dự phòng (Jisho.org)',
    readingBadgeLabel: '読み方',
    supportsPosFormat: false,
    stripReadingSlashes: false,
    normalizePos: false,
    viewerFilterMode: 'source',
    accentTheme: 'rose',
    defaultDeckPlaceholder: 'VD: Japanese::Vocabulary',
    readingErrorHint: 'Weblio không trả 読み方 · Mở Weblio',
    fallbackToastMessage: 'Đã tải kết quả từ nguồn dự phòng Jisho.org.',
    defaultTtsInstructions:
      'Pronounce this single Japanese vocabulary word clearly and naturally in standard Tokyo Japanese.',
    defaultGeminiPrompt:
      'Tạo câu ví dụ tiếng Nhật cho từ vựng "{{word}}" kèm bản dịch tiếng Việt.',
    previewWord: '食べる',
    fields: [
      {
        key: 'word',
        label: 'Từ vựng (単語)',
        defaultAnkiField: 'Word',
        placeholder: 'Nhập từ tiếng Nhật (VD: 食べる, 台風)...',
        toggleable: false,
        defaultVisible: true,
      },
      {
        key: 'ipa',
        label: 'Cách đọc (読み方)',
        defaultAnkiField: 'Reading',
        placeholder: 'たべる / たいふう',
        hint: 'Tự tra 読み方 từ Weblio.jp',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'partOfSpeech',
        label: 'Từ loại (品詞)',
        defaultAnkiField: 'PartOfSpeech',
        placeholder: '名詞, 動詞, 形容詞...',
        toggleable: true,
        defaultVisible: false,
      },
      {
        key: 'definition',
        label: 'Định nghĩa (意味)',
        defaultAnkiField: 'Definition',
        placeholder: 'Nhập định nghĩa hoặc tick chọn từ Weblio...',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'exampleEn',
        label: 'Ví dụ Tiếng Nhật (例文)',
        defaultAnkiField: 'Example',
        placeholder: 'Nhập câu ví dụ tiếng Nhật...',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'exampleVi',
        label: 'Ví dụ Tiếng Việt (Example VI)',
        defaultAnkiField: 'ExampleVI',
        placeholder: 'Nhập bản dịch tiếng Việt...',
        toggleable: true,
        defaultVisible: false,
      },
      {
        key: 'image',
        label: 'Hình ảnh (Image)',
        defaultAnkiField: 'Image',
        placeholder: '',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'typeAnswer',
        label: 'Type Answer',
        defaultAnkiField: 'Type Answer',
        placeholder: 'Nhập từ/cách đọc cần gõ đáp án...',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'furigana',
        label: 'Furigana (ふりがな)',
        defaultAnkiField: 'Furigana',
        placeholder: 'VD: 食[た]べる',
        hint: 'Tự tạo dạng Kanji[読み] từ Weblio.jp',
        toggleable: true,
        defaultVisible: false,
      },
      {
        key: 'wordAudio',
        label: 'Âm thanh Từ vựng',
        defaultAnkiField: 'WordAudio',
        placeholder: '',
        toggleable: true,
        defaultVisible: true,
      },
      {
        key: 'exampleAudio',
        label: 'Âm thanh Câu ví dụ',
        defaultAnkiField: 'ExampleAudio',
        placeholder: '',
        toggleable: true,
        defaultVisible: true,
      },
    ],
  },
};

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'ja'];

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return value === 'en' || value === 'ja';
}

export function getLanguageDefinition(code: LanguageCode): LanguageDefinition {
  return LANGUAGE_DEFINITIONS[code] ?? LANGUAGE_DEFINITIONS.en;
}

export function languageHasField(code: LanguageCode, key: keyof FieldMapping): boolean {
  return getLanguageDefinition(code).fields.some((f) => f.key === key);
}

export function buildCambridgeUrl(
  word: string,
  mode: CambridgeDictMode = 'english',
): string {
  const slug = word
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const dictPath = mode === 'learner-english' ? 'learner-english' : 'english';
  return `https://dictionary.cambridge.org/dictionary/${dictPath}/${encodeURIComponent(slug)}`;
}

export function getLanguagePrimaryUrl(
  code: LanguageCode,
  word: string,
  cambridgeMode: CambridgeDictMode = 'english',
): string {
  const clean = word.trim();
  if (code === 'ja') {
    return `https://www.weblio.jp/content/${encodeURIComponent(clean)}`;
  }
  return buildCambridgeUrl(clean, cambridgeMode);
}

export function getLanguageSecondaryUrl(code: LanguageCode, word: string): string {
  const clean = word.trim();
  if (code === 'ja') {
    return `https://jisho.org/search/${encodeURIComponent(clean)}`;
  }
  return `https://www.oxfordlearnersdictionaries.com/search/american_english/?q=${encodeURIComponent(clean)}`;
}

export function createDefaultLanguageProfile(code: LanguageCode): LanguageProfile {
  const def = getLanguageDefinition(code);

  const fieldMapping: FieldMapping = {
    word: 'Word',
    partOfSpeech: 'PartOfSpeech',
    ipa: code === 'ja' ? 'Reading' : 'IPA',
    typeAnswer: 'Type Answer',
    pastForms: 'Past Simple and Past Participle',
    furigana: 'Furigana',
    definition: 'Definition',
    exampleEn: 'Example',
    exampleVi: 'ExampleVI',
    image: 'Image',
    wordAudio: 'WordAudio',
    exampleAudio: 'ExampleAudio',
  };

  const visibleFields: FieldVisibility = {
    partOfSpeech: false,
    ipa: true,
    typeAnswer: true,
    pastForms: false,
    furigana: false,
    definition: true,
    exampleEn: true,
    exampleVi: false,
    image: true,
    wordAudio: true,
    exampleAudio: true,
  };

  for (const field of def.fields) {
    fieldMapping[field.key] = field.defaultAnkiField;
    if (field.toggleable) {
      visibleFields[field.key as keyof FieldVisibility] = field.defaultVisible;
    }
  }

  return {
    defaultDeck: '',
    defaultNoteType: '',
    posFormat: 'full',
    ...(code === 'en' ? { cambridgeMode: 'english' as const } : {}),
    fieldMapping,
    visibleFields,
    customFields: [],
    ttsInstructions: def.defaultTtsInstructions,
    geminiPrompt: def.defaultGeminiPrompt,
  };
}

/**
 * Generates Anki-compatible ruby/furigana notation (e.g. `食べる` + `たべる` -> `食[た]べる`,
 * `台風` + `たいふう` -> `台風[たいふう]`). Returns empty string if word contains no Kanji.
 */
export function buildJapaneseFurigana(word: string, reading: string): string {
  const w = word.trim();
  const r = reading.trim();
  if (!w || !r || w === r) return '';
  // Require at least one CJK Kanji character
  if (!/[\u4e00-\u9faf\u3400-\u4dbf]/.test(w)) return '';

  // Strip matching trailing kana (okurigana) from both word and reading
  let wEnd = w.length;
  let rEnd = r.length;
  while (
    wEnd > 1 &&
    rEnd > 1 &&
    w[wEnd - 1] === r[rEnd - 1] &&
    /[\u3040-\u30ff]/.test(w[wEnd - 1])
  ) {
    wEnd--;
    rEnd--;
  }

  // Strip matching leading kana prefix (e.g. お願い -> お + 願[ねが]い)
  let wStart = 0;
  let rStart = 0;
  while (
    wStart < wEnd - 1 &&
    rStart < rEnd - 1 &&
    w[wStart] === r[rStart] &&
    /[\u3040-\u30ff]/.test(w[wStart])
  ) {
    wStart++;
    rStart++;
  }

  const prefix = w.slice(0, wStart);
  const kanjiCore = w.slice(wStart, wEnd);
  const suffix = w.slice(wEnd);
  const coreReading = r.slice(rStart, rEnd);

  if (!kanjiCore || !coreReading) return `${w}[${r}]`;
  return `${prefix}${kanjiCore}[${coreReading}]${suffix}`;
}
