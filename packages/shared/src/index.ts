export type LanguageCode = 'en' | 'ja';

export type PosFormat = 'full' | 'short' | 'abbr';

export type CambridgeDictMode = 'english' | 'learner-english';

export type InboxTargetField = 'word' | 'example_en' | 'example_vi' | 'definition' | 'ipa';
export type InboxInsertMode = 'replace' | 'append';

export interface FieldMapping {
  word: string;
  partOfSpeech: string;
  ipa: string;
  typeAnswer: string;
  pastForms: string;
  furigana: string;
  definition: string;
  exampleEn: string;
  exampleVi: string;
  image: string;
  wordAudio: string;
  exampleAudio: string;
}

export type ToggleableFieldKey = Exclude<keyof FieldMapping, 'word'>;

export type FieldVisibility = Record<ToggleableFieldKey, boolean>;

export const DEFAULT_FIELD_VISIBILITY: FieldVisibility = {
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

export interface LanguageProfile {
  defaultDeck: string;
  defaultNoteType: string;
  posFormat: PosFormat;
  cambridgeMode?: CambridgeDictMode;
  fieldMapping: FieldMapping;
  visibleFields: FieldVisibility;
  customFields: CustomFieldConfig[];
  ttsInstructions: string;
  ttsVoice?: string;
  geminiPrompt?: string;
}

export interface CustomFieldConfig {
  id: string;
  label: string;
  ankiField: string;
  multiline: boolean;
  allowBold?: boolean;
}

export interface OpenAITtsConfig {
  apiKey: string;
  hasApiKey?: boolean;
  apiKeyMasked?: string;
  storagePath?: string;
  model: string;
  voice: string;
  speed: number;
  instructions: string;
}

export interface OpenAIVoiceOption {
  id: string;
  name: string;
  description: string;
  source: 'builtin' | 'custom';
  supportsLegacyTts: boolean;
}

export interface OpenAITtsOptionsResponse {
  ok: boolean;
  models: string[];
  voices: OpenAIVoiceOption[];
  customVoicesCount: number;
  verifiedWithApi: boolean;
  error?: string;
}

export const OPENAI_BUILTIN_VOICES: OpenAIVoiceOption[] = [
  { id: 'alloy', name: 'Alloy', description: 'Trung tính, rõ ràng (mặc định)', source: 'builtin', supportsLegacyTts: true },
  { id: 'marin', name: 'Marin', description: 'Chất lượng cao nhất (khuyên dùng cho gpt-4o-mini-tts)', source: 'builtin', supportsLegacyTts: false },
  { id: 'cedar', name: 'Cedar', description: 'Tự nhiên, ấm áp (khuyên dùng cho gpt-4o-mini-tts)', source: 'builtin', supportsLegacyTts: false },
  { id: 'coral', name: 'Coral', description: 'Rõ chữ, dễ nghe', source: 'builtin', supportsLegacyTts: true },
  { id: 'ash', name: 'Ash', description: 'Ấm, điềm đạm', source: 'builtin', supportsLegacyTts: true },
  { id: 'ballad', name: 'Ballad', description: 'Mềm mại, truyền cảm', source: 'builtin', supportsLegacyTts: false },
  { id: 'echo', name: 'Echo', description: 'Giọng nam trầm, chắc', source: 'builtin', supportsLegacyTts: true },
  { id: 'fable', name: 'Fable', description: 'Nhấn nhá sinh động (hơi hướng Anh-Anh)', source: 'builtin', supportsLegacyTts: true },
  { id: 'nova', name: 'Nova', description: 'Tươi sáng, rõ ràng', source: 'builtin', supportsLegacyTts: true },
  { id: 'onyx', name: 'Onyx', description: 'Trầm mạnh, dứt khoát', source: 'builtin', supportsLegacyTts: true },
  { id: 'sage', name: 'Sage', description: 'Nhẹ nhàng, bình tĩnh', source: 'builtin', supportsLegacyTts: true },
  { id: 'shimmer', name: 'Shimmer', description: 'Nhẹ, mượt', source: 'builtin', supportsLegacyTts: true },
  { id: 'verse', name: 'Verse', description: 'Biểu cảm tự nhiên', source: 'builtin', supportsLegacyTts: false },
];

export type DownloadsFilterMode = 'elevenlabs_only' | 'all_audio' | 'cambridge_audio';

export type WordAudioSource = 'openai_tts' | 'folder_scan';

export interface DownloadsAudioConfig {
  downloadsDir: string;
  filterMode: DownloadsFilterMode;
  maxFiles: number;
  deleteSourceAfterSave: boolean;
}

export interface GeminiConfig {
  apiKey: string;
  hasApiKey?: boolean;
  apiKeyMasked?: string;
  storagePath?: string;
  model: string;
  temperature: number;
  exampleCount: number;
  boldTargetWord: boolean;
  systemInstruction: string;
}

export interface GeminiModelOption {
  id: string;
  name: string;
  description: string;
  source?: 'builtin' | 'api';
}

export interface GeminiModelsResponse {
  ok: boolean;
  models: GeminiModelOption[];
  verifiedWithApi: boolean;
  error?: string;
}

export interface GeminiExamplePair {
  id: string;
  target: string;
  vi: string;
  context?: string;
}

export interface GeminiGenerateExamplesRequest {
  lang?: LanguageCode;
  word: string;
  pos?: string;
  definition?: string;
  model?: string;
  promptTemplate?: string;
  exampleCount?: number;
  temperature?: number;
  apiKey?: string;
}

export interface GeminiGenerateExamplesResponse {
  ok: boolean;
  lang: LanguageCode;
  word: string;
  model: string;
  resolvedPrompt: string;
  examples: GeminiExamplePair[];
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const GEMINI_BUILTIN_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Nhanh, ổn định, tối ưu tạo câu ví dụ qua Interactions API (Khuyên dùng)',
    source: 'builtin',
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    description: 'Thế hệ Gemini 4 mới nhất, thông minh và tốc độ phản hồi nhanh',
    source: 'builtin',
  },
  {
    id: 'gemini-3.8-flash-lite',
    name: 'Gemini 3.8 Flash-Lite',
    description: 'Phản hồi tức thì, nhẹ và tiết kiệm quota',
    source: 'builtin',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    description: 'Tốc độ cao, chi phí thấp nhất cho tác vụ tạo câu ngắn',
    source: 'builtin',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    description: 'Nhẹ, phản hồi nhanh cho tác vụ tần suất cao',
    source: 'builtin',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    description: 'Suy luận frontier hiệu suất cao, phản hồi tương tác nhanh',
    source: 'builtin',
  },
  {
    id: 'gemini-4-neon',
    name: 'Gemini 4 Neon',
    description: 'Trí tuệ frontier hoàn thành tác vụ nhanh (Paid tier)',
    source: 'builtin',
  },
  {
    id: 'gemini-4-carbon',
    name: 'Gemini 4 Carbon',
    description: 'Mô hình suy luận sâu mạnh nhất thế hệ Gemini 4',
    source: 'builtin',
  },
  {
    id: 'gemini-3.8-pro',
    name: 'Gemini 3.8 Pro',
    description: 'Chất lượng ngôn ngữ, sắc thái & ngữ cảnh chuyên sâu',
    source: 'builtin',
  },
];

export interface AppSettings {
  activeLanguage: LanguageCode;
  languageProfiles: Record<LanguageCode, LanguageProfile>;
  ankiConnectUrl: string;
  defaultDeck: string;
  defaultNoteType: string;
  posFormat: PosFormat;
  cambridgeMode: CambridgeDictMode;
  fieldMapping: FieldMapping;
  visibleFields: FieldVisibility;
  customFields: CustomFieldConfig[];
  autoClipboardImage: boolean;
  wordAudioSource: WordAudioSource;
  wordAudioDownloads: DownloadsAudioConfig;
  openai: OpenAITtsConfig;
  gemini: GeminiConfig;
  elevenlabsDownloads: DownloadsAudioConfig;
}

export const DEFAULT_EN_PROFILE: LanguageProfile = {
  defaultDeck: '',
  defaultNoteType: '',
  posFormat: 'full',
  cambridgeMode: 'english',
  fieldMapping: {
    word: 'Word',
    partOfSpeech: 'PartOfSpeech',
    ipa: 'IPA',
    typeAnswer: 'Type Answer',
    pastForms: 'Past Simple and Past Participle',
    furigana: 'Furigana',
    definition: 'Definition',
    exampleEn: 'Example',
    exampleVi: 'ExampleVI',
    image: 'Image',
    wordAudio: 'WordAudio',
    exampleAudio: 'ExampleAudio',
  },
  visibleFields: { ...DEFAULT_FIELD_VISIBILITY },
  customFields: [],
  ttsInstructions:
    'Pronounce this single English vocabulary word clearly, naturally, and accurately in British English.',
  geminiPrompt:
    'Tạo câu ví dụ tiếng Anh cho từ vựng "{{word}}" kèm bản dịch tiếng Việt.',
};

export const DEFAULT_JA_PROFILE: LanguageProfile = {
  defaultDeck: '',
  defaultNoteType: '',
  posFormat: 'full',
  fieldMapping: {
    word: 'Word',
    partOfSpeech: 'PartOfSpeech',
    ipa: 'Reading',
    typeAnswer: 'Type Answer',
    pastForms: 'Past Simple and Past Participle',
    furigana: 'Furigana',
    definition: 'Definition',
    exampleEn: 'Example',
    exampleVi: 'ExampleVI',
    image: 'Image',
    wordAudio: 'WordAudio',
    exampleAudio: 'ExampleAudio',
  },
  visibleFields: { ...DEFAULT_FIELD_VISIBILITY },
  customFields: [],
  ttsInstructions:
    'Pronounce this single Japanese vocabulary word clearly and naturally in standard Tokyo Japanese.',
  geminiPrompt:
    'Tạo câu ví dụ tiếng Nhật cho từ vựng "{{word}}" kèm bản dịch tiếng Việt.',
};

export const DEFAULT_SETTINGS: AppSettings = {
  activeLanguage: 'en',
  languageProfiles: {
    en: structuredClone(DEFAULT_EN_PROFILE),
    ja: structuredClone(DEFAULT_JA_PROFILE),
  },
  ankiConnectUrl: 'http://127.0.0.1:8765',
  defaultDeck: '',
  defaultNoteType: '',
  posFormat: 'full',
  cambridgeMode: 'english',
  fieldMapping: { ...DEFAULT_EN_PROFILE.fieldMapping },
  visibleFields: { ...DEFAULT_FIELD_VISIBILITY },
  customFields: [],
  autoClipboardImage: true,
  wordAudioSource: 'openai_tts',
  wordAudioDownloads: {
    downloadsDir: '',
    filterMode: 'cambridge_audio',
    maxFiles: 15,
    deleteSourceAfterSave: false,
  },
  openai: {
    apiKey: '',
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
    speed: 1.0,
    instructions:
      'Pronounce this single English vocabulary word clearly, naturally, and accurately in British English.',
  },
  gemini: {
    apiKey: '',
    model: DEFAULT_GEMINI_MODEL,
    temperature: 0.7,
    exampleCount: 4,
    boldTargetWord: true,
    systemInstruction: '',
  },
  elevenlabsDownloads: {
    downloadsDir: '',
    filterMode: 'elevenlabs_only',
    maxFiles: 15,
    deleteSourceAfterSave: false,
  },
};

export interface OxfordIpaItem {
  id: string;
  headword: string;
  pos: string;
  usIpa: string;
  ukIpa?: string;
  pastSimple?: string[];
  pastParticiple?: string[];
  pastForms?: string;
  sourceUrl: string;
}

export interface OxfordLookupResult {
  word: string;
  sourceUrl: string;
  entries: OxfordIpaItem[];
  error?: string;
}

export interface CambridgeSense {
  id: string;
  level?: string;
  definition: string;
  examples: string[];
}

export interface CambridgeSenseBlock {
  id: string;
  guideword?: string;
  senses: CambridgeSense[];
}

export interface CambridgeEntry {
  id: string;
  headword: string;
  pos: string;
  usIpa?: string;
  ukIpa?: string;
  blocks: CambridgeSenseBlock[];
}

export interface CambridgeAudioItem {
  region: 'us' | 'uk' | 'other';
  url: string;
  pos?: string;
  dataBase64?: string;
}

export interface CambridgeLookupResult {
  word: string;
  sourceUrl: string;
  entries: CambridgeEntry[];
  audios?: CambridgeAudioItem[];
  error?: string;
}

export interface DictionaryReadingOption {
  id: string;
  headword: string;
  pos: string;
  reading: string;
  altReading?: string;
  label?: string;
  autoFields?: Record<string, string>;
  sourceUrl?: string;
}

export interface DictionarySenseItem {
  id: string;
  level?: string;
  definition: string;
  examples: string[];
}

export interface DictionarySenseGroup {
  id: string;
  guideword?: string;
  senses: DictionarySenseItem[];
}

export interface DictionaryEntryItem {
  id: string;
  sourceId: string;
  sourceName: string;
  headword: string;
  pos: string;
  reading?: string;
  altReading?: string;
  autoFields?: Record<string, string>;
  blocks: DictionarySenseGroup[];
  sourceUrl?: string;
}

export interface DictionaryLookupResponse {
  lang: LanguageCode;
  word: string;
  cached: boolean;
  primaryUrl: string;
  secondaryUrl?: string;
  readings: DictionaryReadingOption[];
  entries: DictionaryEntryItem[];
  readingError?: string;
  entryError?: string;
  oxford?: OxfordLookupResult;
  cambridge?: CambridgeLookupResult;
}

export type AudioTakeKind = 'word' | 'example';

export interface AudioTake {
  id: string;
  kind: AudioTakeKind;
  provider: 'openai' | 'elevenlabs';
  voice: string;
  model: string;
  text: string;
  url: string;
  filename: string;
  createdAt: string;
  params?: Record<string, string | number>;
}

export interface InboxMessage {
  id: string;
  target: InboxTargetField;
  text: string;
  mode: InboxInsertMode;
  sourceUrl?: string;
  sourceTitle?: string;
  receivedAt: string;
}

export interface TempImageMedia {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  sourceUrl?: string;
  sourceTitle?: string;
  receivedAt: string;
}

export interface AnkiNoteItem {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
}

export interface DownloadedAudioFile {
  id: string;
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
  modifiedMs: number;
  isElevenLabs: boolean;
  isCambridge?: boolean;
  url: string;
}

export interface DownloadsScanResponse {
  dir: string;
  filterMode: DownloadsFilterMode;
  files: DownloadedAudioFile[];
  error?: string;
}

export interface DictionarySyncEvent {
  lang?: LanguageCode;
  source: 'cambridge' | 'oxford' | 'weblio';
  word: string;
  cambridge?: CambridgeLookupResult;
  oxford?: OxfordLookupResult;
  unified?: Omit<DictionaryLookupResponse, 'cached'>;
  receivedAt: string;
}

export interface SaveCardPayload {
  lang?: LanguageCode;
  mode: 'create' | 'update';
  noteId?: number;
  deckName: string;
  modelName: string;
  tags?: string[];
  values: {
    word: string;
    partOfSpeech: string;
    ipa: string;
    typeAnswer: string;
    pastForms: string;
    furigana?: string;
    definition: string;
    exampleEn: string;
    exampleVi: string;
  };
  customValues?: Record<string, string>;
  imageTempId?: string | null;
  keepExistingImage?: boolean;
  wordAudioTakeId?: string | null;
  wordDownloadFileId?: string | null;
  exampleDownloadFileId?: string | null;
  keepExistingWordAudio?: boolean;
  keepExistingExampleAudio?: boolean;
}

export const COMMON_POS_LIST = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrasal verb',
  'idiom',
  'preposition',
  'conjunction',
  'pronoun',
  'exclamation',
] as const;

const POS_SHORT_MAP: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  'phrasal verb': 'phr. v.',
  idiom: 'idm.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  exclamation: 'excl.',
};

const POS_ABBR_MAP: Record<string, string> = {
  noun: 'n',
  verb: 'v',
  adjective: 'adj',
  adverb: 'adv',
  'phrasal verb': 'phr v',
  idiom: 'idm',
  preposition: 'prep',
  conjunction: 'conj',
  pronoun: 'pron',
  exclamation: 'excl',
};

export function stripPosGuideword(pos: string): string {
  return pos.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function normalizePos(pos: string): string {
  const lower = stripPosGuideword(pos).toLowerCase();
  if (lower === 'n' || lower === 'n.') return 'noun';
  if (lower === 'v' || lower === 'v.') return 'verb';
  if (lower === 'adj' || lower === 'adj.') return 'adjective';
  if (lower === 'adv' || lower === 'adv.') return 'adverb';
  if (lower === 'prep' || lower === 'prep.') return 'preposition';
  if (lower === 'conj' || lower === 'conj.') return 'conjunction';
  if (lower === 'pron' || lower === 'pron.') return 'pronoun';
  if (lower === 'excl' || lower === 'excl.') return 'exclamation';
  if (lower === 'phr. v.' || lower === 'phr v') return 'phrasal verb';
  if (lower === 'idm' || lower === 'idm.') return 'idiom';
  return lower;
}

export function formatPosWithGuideword(pos: string, guidewords: string[]): string {
  const base = stripPosGuideword(pos);
  if (!base) return '';
  const cleaned = Array.from(
    new Set(
      guidewords
        .map((g) => g.trim().replace(/^\(|\)$/g, '').trim())
        .filter((g) => Boolean(g) && !/free dictionary api|fallback/i.test(g))
        .map((g) => g.toLowerCase()),
    ),
  );
  if (cleaned.length === 0) return base;
  return `${base} (${cleaned.join(', ')})`;
}

export function formatPosForAnki(pos: string, format: PosFormat): string {
  const match = pos.trim().match(/^(.+?)\s*(\([^)]*\))$/);
  const rawBase = match ? match[1].trim() : pos.trim();
  const suffix = match ? ` ${match[2].trim()}` : '';
  const normalized = normalizePos(rawBase);
  if (!normalized) return '';
  let formattedBase = normalized;
  if (format === 'short') formattedBase = POS_SHORT_MAP[normalized] ?? normalized;
  else if (format === 'abbr') formattedBase = POS_ABBR_MAP[normalized] ?? normalized;
  return `${formattedBase}${suffix}`;
}

export function stripIpaSlashes(input: string): string {
  return input.trim().replace(/^\/+|\/+$/g, '').trim();
}

export function stripHtmlToPlainText(input: string, cleanWrapper = false): string {
  let text = input
    // Convert block breaks to newlines first before stripping tags
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanWrapper) {
    // Strip leading bullets or list numbering like "- ", "• ", "1. "
    text = text.replace(/^(?:[-•*–—]|\d+[.)])\s+/, '');
    // Strip matching surrounding quotes
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith('“') && text.endsWith('”')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }
  }

  return text;
}

/**
 * Strips unwanted HTML formatting while intentionally keeping bold (`<b>...</b>`) tags
 * and converting Markdown `**...**` bold to `<b>...</b>`.
 * Converts line breaks to `<br>` for Anki fields.
 */
export function sanitizeAnkiBoldText(input: string, forAnkiHtml = true): string {
  const OPEN_TOKEN = '__ASS_BOLD_OPEN__';
  const CLOSE_TOKEN = '__ASS_BOLD_CLOSE__';

  let working = input
    // Normalize <b> and <strong> tags (even with attributes) to safe tokens
    .replace(/<\s*(?:b|strong)(?:\s[^>]*)?>/gi, OPEN_TOKEN)
    .replace(/<\/\s*(?:b|strong)\s*>/gi, CLOSE_TOKEN)
    // Convert markdown **bold** to safe tokens
    .replace(/\*\*([^*\n]+?)\*\*/g, `${OPEN_TOKEN}$1${CLOSE_TOKEN}`);

  working = stripHtmlToPlainText(working, false);

  working = working
    .replaceAll(OPEN_TOKEN, '<b>')
    .replaceAll(CLOSE_TOKEN, '</b>')
    // Remove empty bold pairs
    .replace(/<b>\s*<\/b>/g, '');

  return forAnkiHtml ? working.replace(/\n/g, '<br>') : working;
}

/**
 * Removes all HTML tags and markdown bold markers (`**`) so TTS engines read natural text.
 */
export function cleanTextForTts(input: string): string {
  return stripHtmlToPlainText(input, false)
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates an ASCII-safe filename slug from a word or label.
 */
export function slugifyFilename(input: string, fallback = 'item', maxLen = 24): string {
  return (
    (input || '')
      .trim()
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, maxLen) || fallback
  );
}

/**
 * Interpolates a user-customizable Gemini prompt template with vocabulary parameters.
 * Supports `{{word}}`, `{word}`, `{{tu_vung}}`, `{tu_vung}`, `${word}`, `[word]`
 * as well as optional `{{pos}}` and `{{definition}}`.
 */
export function interpolateGeminiPrompt(
  template: string,
  params: { word: string; pos?: string; definition?: string },
): string {
  const cleanWord = params.word.trim();
  const cleanPos = (params.pos || '').trim();
  const cleanDef = stripHtmlToPlainText(params.definition || '', false);

  const wordRegex = /\{\{\s*(?:word|tu_vung|tuvung)\s*\}\}|\{\s*(?:word|tu_vung|tuvung)\s*\}|\$\{\s*word\s*\}|\[\s*word\s*\]/gi;
  const posRegex = /\{\{\s*(?:pos|part_of_speech|tu_loai)\s*\}\}|\{\s*(?:pos|part_of_speech|tu_loai)\s*\}/gi;
  const defRegex = /\{\{\s*(?:definition|def|nghia)\s*\}\}|\{\s*(?:definition|def|nghia)\s*\}/gi;

  const hasWordPlaceholder = wordRegex.test(template);
  let result = template.replace(wordRegex, cleanWord);
  result = result.replace(posRegex, cleanPos);
  result = result.replace(defRegex, cleanDef);

  if (!hasWordPlaceholder && cleanWord) {
    result = `${result.trim()}\nTừ vựng cần đặt câu: "${cleanWord}"`;
  }

  return result.trim();
}

const COMMON_IRREGULAR_VERBS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  arise: ['arose', 'arisen', 'arises', 'arising'],
  awake: ['awoke', 'awoken', 'awakes', 'awaking'],
  bear: ['bore', 'borne', 'born', 'bears', 'bearing'],
  beat: ['beat', 'beaten', 'beats', 'beating'],
  become: ['became', 'become', 'becomes', 'becoming'],
  begin: ['began', 'begun', 'begins', 'beginning'],
  bend: ['bent', 'bends', 'bending'],
  bet: ['bet', 'bets', 'betting'],
  bind: ['bound', 'binds', 'binding'],
  bite: ['bit', 'bitten', 'bites', 'biting'],
  bleed: ['bled', 'bleeds', 'bleeding'],
  blow: ['blew', 'blown', 'blows', 'blowing'],
  break: ['broke', 'broken', 'breaks', 'breaking'],
  bring: ['brought', 'brings', 'bringing'],
  build: ['built', 'builds', 'building'],
  burn: ['burnt', 'burned', 'burns', 'burning'],
  burst: ['burst', 'bursts', 'bursting'],
  buy: ['bought', 'buys', 'buying'],
  catch: ['caught', 'catches', 'catching'],
  choose: ['chose', 'chosen', 'chooses', 'choosing'],
  cling: ['clung', 'clings', 'clinging'],
  come: ['came', 'come', 'comes', 'coming'],
  cost: ['cost', 'costs', 'costing'],
  creep: ['crept', 'creeps', 'creeping'],
  cut: ['cut', 'cuts', 'cutting'],
  deal: ['dealt', 'deals', 'dealing'],
  dig: ['dug', 'digs', 'digging'],
  do: ['does', 'did', 'done', 'doing'],
  draw: ['drew', 'drawn', 'draws', 'drawing'],
  dream: ['dreamt', 'dreamed', 'dreams', 'dreaming'],
  drink: ['drank', 'drunk', 'drinks', 'drinking'],
  drive: ['drove', 'driven', 'drives', 'driving'],
  eat: ['ate', 'eaten', 'eats', 'eating'],
  fall: ['fell', 'fallen', 'falls', 'falling'],
  feed: ['fed', 'feeds', 'feeding'],
  feel: ['felt', 'feels', 'feeling'],
  fight: ['fought', 'fights', 'fighting'],
  find: ['found', 'finds', 'finding'],
  flee: ['fled', 'flees', 'fleeing'],
  fly: ['flew', 'flown', 'flies', 'flying'],
  forbid: ['forbade', 'forbidden', 'forbids', 'forbidding'],
  forget: ['forgot', 'forgotten', 'forgets', 'forgetting'],
  forgive: ['forgave', 'forgiven', 'forgives', 'forgiving'],
  freeze: ['froze', 'frozen', 'freezes', 'freezing'],
  get: ['got', 'gotten', 'gets', 'getting'],
  give: ['gave', 'given', 'gives', 'giving'],
  go: ['goes', 'went', 'gone', 'going'],
  grow: ['grew', 'grown', 'grows', 'growing'],
  hang: ['hung', 'hanged', 'hangs', 'hanging'],
  have: ['has', 'had', 'having'],
  hear: ['heard', 'hears', 'hearing'],
  hide: ['hid', 'hidden', 'hides', 'hiding'],
  hit: ['hit', 'hits', 'hitting'],
  hold: ['held', 'holds', 'holding'],
  hurt: ['hurt', 'hurts', 'hurting'],
  keep: ['kept', 'keeps', 'keeping'],
  kneel: ['knelt', 'kneels', 'kneeling'],
  know: ['knew', 'known', 'knows', 'knowing'],
  lay: ['laid', 'lays', 'laying'],
  lead: ['led', 'leads', 'leading'],
  lean: ['leant', 'leaned', 'leans', 'leaning'],
  leap: ['leapt', 'leaped', 'leaps', 'leaping'],
  learn: ['learnt', 'learned', 'learns', 'learning'],
  leave: ['left', 'leaves', 'leaving'],
  lend: ['lent', 'lends', 'lending'],
  let: ['let', 'lets', 'letting'],
  lie: ['lay', 'lain', 'lied', 'lies', 'lying'],
  light: ['lit', 'lighted', 'lights', 'lighting'],
  lose: ['lost', 'loses', 'losing'],
  make: ['made', 'makes', 'making'],
  mean: ['meant', 'means', 'meaning'],
  meet: ['met', 'meets', 'meeting'],
  overcome: ['overcame', 'overcome', 'overcomes', 'overcoming'],
  pay: ['paid', 'pays', 'paying'],
  put: ['put', 'puts', 'putting'],
  quit: ['quit', 'quits', 'quitting'],
  read: ['read', 'reads', 'reading'],
  ride: ['rode', 'ridden', 'rides', 'riding'],
  ring: ['rang', 'rung', 'rings', 'ringing'],
  rise: ['rose', 'risen', 'rises', 'rising'],
  run: ['ran', 'run', 'runs', 'running'],
  say: ['said', 'says', 'saying'],
  see: ['saw', 'seen', 'sees', 'seeing'],
  seek: ['sought', 'seeks', 'seeking'],
  sell: ['sold', 'sells', 'selling'],
  send: ['sent', 'sends', 'sending'],
  set: ['set', 'sets', 'setting'],
  shake: ['shook', 'shaken', 'shakes', 'shaking'],
  shine: ['shone', 'shined', 'shines', 'shining'],
  shoot: ['shot', 'shoots', 'shooting'],
  show: ['showed', 'shown', 'shows', 'showing'],
  shrink: ['shrank', 'shrunk', 'shrinks', 'shrinking'],
  shut: ['shut', 'shuts', 'shutting'],
  sing: ['sang', 'sung', 'sings', 'singing'],
  sink: ['sank', 'sunk', 'sinks', 'sinking'],
  sit: ['sat', 'sits', 'sitting'],
  sleep: ['slept', 'sleeps', 'sleeping'],
  slide: ['slid', 'slides', 'sliding'],
  speak: ['spoke', 'spoken', 'speaks', 'speaking'],
  spend: ['spent', 'spends', 'spending'],
  spin: ['spun', 'spins', 'spinning'],
  split: ['split', 'splits', 'splitting'],
  spread: ['spread', 'spreads', 'spreading'],
  spring: ['sprang', 'sprung', 'springs', 'springing'],
  stand: ['stood', 'stands', 'standing'],
  steal: ['stole', 'stolen', 'steals', 'stealing'],
  stick: ['stuck', 'sticks', 'sticking'],
  sting: ['stung', 'stings', 'stinging'],
  strike: ['struck', 'stricken', 'strikes', 'striking'],
  swear: ['swore', 'sworn', 'swears', 'swearing'],
  sweep: ['swept', 'sweeps', 'sweeping'],
  swim: ['swam', 'swum', 'swims', 'swimming'],
  swing: ['swung', 'swings', 'swinging'],
  take: ['took', 'taken', 'takes', 'taking'],
  teach: ['taught', 'teaches', 'teaching'],
  tear: ['tore', 'torn', 'tears', 'tearing'],
  tell: ['told', 'tells', 'telling'],
  think: ['thought', 'thinks', 'thinking'],
  throw: ['threw', 'thrown', 'throws', 'throwing'],
  understand: ['understood', 'understands', 'understanding'],
  wake: ['woke', 'woken', 'wakes', 'waking'],
  wear: ['wore', 'worn', 'wears', 'wearing'],
  weep: ['wept', 'weeps', 'weeping'],
  win: ['won', 'wins', 'winning'],
  wind: ['wound', 'winds', 'winding'],
  withdraw: ['withdrew', 'withdrawn', 'withdraws', 'withdrawing'],
  write: ['wrote', 'written', 'writes', 'writing'],
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimEdgePunctuation(str: string): string {
  return str
    .replace(/^[\s.,;:!?"'“”‘’()[\]{}…—–\-•]+/, '')
    .replace(/[\s.,;:!?"'“”‘’()[\]{}…—–\-•]+$/, '')
    .trim();
}

function normalizeExtractedCase(matched: string, referenceWord: string): string {
  const clean = trimEdgePunctuation(matched);
  if (!clean || !referenceWord) return clean;
  const refFirst = referenceWord[0];
  const isRefLower =
    refFirst === refFirst.toLowerCase() && refFirst !== refFirst.toUpperCase();
  if (
    isRefLower &&
    clean.length > 1 &&
    clean[0] === clean[0].toUpperCase() &&
    clean[0] !== clean[0].toLowerCase() &&
    clean.slice(1) === clean.slice(1).toLowerCase()
  ) {
    return clean[0].toLowerCase() + clean.slice(1);
  }
  return clean;
}

function buildEnglishWordForms(base: string, extraPastForms?: string): Set<string> {
  const w = base.trim().toLowerCase();
  const forms = new Set<string>();
  if (!w) return forms;
  forms.add(w);

  // Include irregular forms from built-in table
  const irreg = COMMON_IRREGULAR_VERBS[w];
  if (irreg) {
    for (const f of irreg) forms.add(f.toLowerCase());
  }

  // Include Oxford pastForms if provided (e.g. "went, gone" or "learnt / learned")
  if (extraPastForms?.trim()) {
    for (const part of extraPastForms.split(/[,/|;]+/)) {
      const clean = part.trim().toLowerCase();
      if (clean && !clean.includes(' ')) forms.add(clean);
    }
  }

  // Regular inflections (-s, -es, -ies, -ves, -ed, -d, -ied, -ing, -er, -est, -ly, -ness)
  forms.add(`${w}s`);
  forms.add(`${w}es`);
  forms.add(`${w}ed`);
  forms.add(`${w}d`);
  forms.add(`${w}ing`);
  forms.add(`${w}er`);
  forms.add(`${w}est`);
  forms.add(`${w}ly`);
  forms.add(`${w}ness`);

  if (w.endsWith('e')) {
    const noE = w.slice(0, -1);
    if (noE.length >= 2) {
      forms.add(`${noE}ed`);
      forms.add(`${noE}ing`);
      forms.add(`${noE}er`);
      forms.add(`${noE}est`);
    }
    if (w.endsWith('ie')) {
      forms.add(`${w.slice(0, -2)}ying`);
    }
    if (w.endsWith('le') && w.length > 3) {
      forms.add(`${w.slice(0, -2)}ly`);
    }
  }

  if (w.endsWith('y') && w.length > 2) {
    const noY = w.slice(0, -1);
    forms.add(`${noY}ies`);
    forms.add(`${noY}ied`);
    forms.add(`${noY}ier`);
    forms.add(`${noY}iest`);
    forms.add(`${noY}ily`);
    forms.add(`${noY}iness`);
  }

  if (w.endsWith('f') && w.length > 2) {
    forms.add(`${w.slice(0, -1)}ves`);
  } else if (w.endsWith('fe') && w.length > 3) {
    forms.add(`${w.slice(0, -2)}ves`);
  }

  if (w.endsWith('c') && w.length > 2) {
    forms.add(`${w}ked`);
    forms.add(`${w}king`);
  }

  // Consonant doubling (e.g. stop -> stopped/stopping, plan -> planned, travel -> travelled)
  if (w.length >= 3 && /[aeiou][bcdfghjklmnpqrstvwxz]$/i.test(w)) {
    const last = w[w.length - 1];
    forms.add(`${w}${last}ed`);
    forms.add(`${w}${last}ing`);
    forms.add(`${w}${last}er`);
    forms.add(`${w}${last}est`);
  }

  return forms;
}

function isEnglishInflectionOf(token: string, base: string, forms: Set<string>): boolean {
  const lower = token.trim().toLowerCase();
  const baseLower = base.trim().toLowerCase();
  if (!lower || !baseLower) return false;
  if (forms.has(lower)) return true;

  // Stem-prefix check for common suffixes (e.g. adapt -> adaptation / adaptable)
  const stem = baseLower.replace(/(?:e|y)$/i, '');
  if (stem.length >= 4 && lower.startsWith(stem)) {
    const suffix = lower.slice(stem.length);
    if (
      /^(?:s|es|ed|d|ing|er|est|ly|ies|ied|ier|iest|ily|ves|able|ible|ment|ness|tion|ation|sion|ity|ive|al|ous|ful|less)$/i.test(
        suffix,
      )
    ) {
      return true;
    }
  }
  return false;
}

function matchJapaneseInflection(word: string, plainExample: string): string {
  const w = word.trim();
  if (!w || !plainExample) return '';

  const politeTail = '(?:います|いました|いません|いる|いた|おく|おいた|しまう|しまった|みる|みた|いく|くる|ください)?';

  if (w.endsWith('する')) {
    const prefix = escapeRegExp(w.slice(0, -2));
    const re = new RegExp(
      `${prefix}(?:しました|しませんでした|しています|していた|している|しない|しなかった|します|しません|して${politeTail}|した|すれば|しよう|できる|できます|できた|される|させる|しろ|せよ|する)`,
    );
    const m = plainExample.match(re);
    if (m?.[0]) return m[0];
  }

  if (w.endsWith('くる') || w.endsWith('来る')) {
    const prefix = escapeRegExp(w.slice(0, -2));
    const re = new RegExp(
      `${prefix}(?:きました|きませんでした|きて${politeTail}|きた|こない|こなかった|きます|きません|くれば|こよう|こられる|こさせる|くる|来ます|来ました|来て${politeTail}|来た|来ない|来なかった|来る)`,
    );
    const m = plainExample.match(re);
    if (m?.[0]) return m[0];
  }

  if (w.length >= 2) {
    const last = w[w.length - 1];
    const stem = escapeRegExp(w.slice(0, -1));
    const endingMap: Record<string, string> = {
      る: `(?:りました|りませんでした|りません|ります|らない|らなかった|って${politeTail}|った|れば|ろう|られる|시키는|らせる|れる|ました|ませんでした|ません|ます|なかった|ない|て${politeTail}|た|よう|たい|たかった|たくない|る)`,
      う: `(?:いました|いませんでした|いません|います|わない|わなかった|って${politeTail}|った|えば|おう|える|わせる|いたい|う)`,
      く: `(?:きました|きませんでした|きません|きます|かない|かなかった|いて${politeTail}|いた|って${politeTail}|った|けば|こう|ける|かせる|きたい|く)`,
      ぐ: `(?:ぎました|ぎませんでした|ぎません|ぎます|がない|がなかった|いで${politeTail}|いだ|げば|ごう|げる|がせる|ぎたい|ぐ)`,
      す: `(?:しました|しませんでした|しません|します|さない|さなかった|して${politeTail}|した|せば|そう|せる|させる|したい|す)`,
      つ: `(?:ちました|ちませんでした|ちません|ちます|たない|たなかった|って${politeTail}|った|てば|とう|てる|たせる|ちたい|つ)`,
      ぬ: `(?:にました|にませんでした|にません|にます|なない|ななかった|んで${politeTail}|んだ|ねば|のう|ねる|なせる|にたい|ぬ)`,
      ぶ: `(?:びました|びませんでした|びません|びます|ばない|ばなかった|んで${politeTail}|んだ|べば|ぼう|べる|ばせる|びたい|ぶ)`,
      む: `(?:みました|みませんでした|みません|みます|まない|まなかった|んで${politeTail}|んだ|めば|もう|める|ませる|みたい|む)`,
      い: `(?:くなかった|くない|かった|くて|く|さ|そう|い)`,
    };

    const endingPattern = endingMap[last];
    if (endingPattern) {
      const re = new RegExp(`${stem}${endingPattern}`);
      const m = plainExample.match(re);
      if (m?.[0]) return m[0];
    }
  }

  if (plainExample.includes(w)) {
    return w;
  }

  return '';
}

/**
 * Extracts the target vocabulary word or its inflected/conjugated form from an example sentence
 * to automatically populate the `Type Answer` field.
 */
export function extractTypeAnswerFromExample(
  rawWord: string,
  rawExample: string,
  options?: { lang?: LanguageCode; pastForms?: string },
): string {
  const baseWord = stripHtmlToPlainText(rawWord || '', false).trim();
  if (!baseWord || !rawExample || !rawExample.trim()) return '';

  const isJapanese =
    options?.lang === 'ja' || /[\u3040-\u30ff\u4e00-\u9faf]/.test(baseWord);

  // 1. Check explicit bold segments (<b>...</b>, <strong>...</strong>, **...**) first
  const boldMatches: string[] = [];
  const boldTagRegex = /<\s*(?:b|strong)(?:\s[^>]*)?>([\s\S]*?)<\/\s*(?:b|strong)\s*>|\*\*([^*\n]+?)\*\*/gi;
  let bm: RegExpExecArray | null;
  while ((bm = boldTagRegex.exec(rawExample)) !== null) {
    const content = trimEdgePunctuation(stripHtmlToPlainText(bm[1] ?? bm[2] ?? '', false));
    if (content) boldMatches.push(content);
  }

  const plainExample = stripHtmlToPlainText(rawExample, false);
  if (!plainExample) return '';

  if (isJapanese) {
    if (boldMatches.length > 0) {
      // Prefer bold match that shares kanji/kana with baseWord
      const kanjiCore = baseWord.slice(0, Math.max(1, baseWord.length - 1));
      const matchingBold = boldMatches.find(
        (b) => b.includes(kanjiCore) || baseWord.includes(b),
      );
      if (matchingBold) return matchingBold;
      if (boldMatches.length === 1 && boldMatches[0].length <= 20) {
        return boldMatches[0];
      }
    }
    return matchJapaneseInflection(baseWord, plainExample);
  }

  // English / Latin-script matching
  const words = baseWord
    .split(/\s+/)
    .map((w) => trimEdgePunctuation(w))
    .filter(Boolean);
  if (words.length === 0) return '';

  const headForms = buildEnglishWordForms(words[0], options?.pastForms);

  // If bold segments exist, check if any bold segment matches the word/phrase or its inflections
  if (boldMatches.length > 0) {
    for (const seg of boldMatches) {
      const segTokens = seg.split(/\s+/).map(trimEdgePunctuation).filter(Boolean);
      if (
        segTokens.length > 0 &&
        segTokens.some((t) => isEnglishInflectionOf(t, words[0], headForms))
      ) {
        return normalizeExtractedCase(seg, baseWord);
      }
    }
    if (boldMatches.length === 1 && boldMatches[0].split(/\s+/).length <= 5) {
      return normalizeExtractedCase(boldMatches[0], baseWord);
    }
  }

  // Multi-word phrase / phrasal verb matching (e.g. "give up" -> "gave up", "look forward to" -> "looking forward to")
  if (words.length > 1) {
    const PLACEHOLDERS = new Set(['sb', 'sth', 'somebody', 'something', "one's", 'oneself']);
    const headAlts = Array.from(headForms).map(escapeRegExp).join('|');
    const tailPatterns = words.slice(1).map((w) => {
      const lower = w.toLowerCase();
      if (PLACEHOLDERS.has(lower)) {
        return '(?:\\s+[a-zA-Z’\'-]+){0,2}';
      }
      const wForms = Array.from(buildEnglishWordForms(w)).map(escapeRegExp).join('|');
      return `\\s+(?:${wForms})`;
    });

    // Try contiguous phrase match first
    const phraseRegex = new RegExp(`\\b((?:${headAlts})${tailPatterns.join('')})\\b`, 'i');
    const pm = plainExample.match(phraseRegex);
    if (pm?.[1]) {
      return normalizeExtractedCase(pm[1], baseWord);
    }

    // Try separable 2-word phrasal verb (e.g. "give it up", "turned the light off")
    if (words.length === 2 && !PLACEHOLDERS.has(words[1].toLowerCase())) {
      const particle = escapeRegExp(words[1]);
      const sepRegex = new RegExp(
        `\\b((?:${headAlts})\\s+(?:[a-zA-Z’'-]+\\s+){1,2}${particle})\\b`,
        'i',
      );
      const sm = plainExample.match(sepRegex);
      if (sm?.[1]) {
        return normalizeExtractedCase(sm[1], baseWord);
      }
    }
  }

  // Single-word token scan in plainExample
  const tokenRegex = /[a-zA-Z]+(?:['’-][a-zA-Z]+)*/g;
  const tokens: string[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = tokenRegex.exec(plainExample)) !== null) {
    tokens.push(tm[0]);
  }

  // 1. Exact or direct inflection set match
  for (const tok of tokens) {
    if (headForms.has(tok.toLowerCase())) {
      return normalizeExtractedCase(tok, baseWord);
    }
  }

  // 2. Broader stem-prefix inflection match
  for (const tok of tokens) {
    if (isEnglishInflectionOf(tok, words[0], headForms)) {
      return normalizeExtractedCase(tok, baseWord);
    }
  }

  return '';
}

/**
 * Ensures the target vocabulary word (or its inflected/conjugated form) is wrapped in `<b>...</b>`
 * inside an example sentence, matching the Gemini AI bolding behavior.
 * Preserves existing `<b>...</b>` tags if the sentence already contains bold formatting.
 */
export function autoBoldTargetWordInExample(
  rawExample: string,
  rawWord: string,
  options?: { lang?: LanguageCode; pastForms?: string },
): string {
  let normalized = sanitizeAnkiBoldText(rawExample || '', false);
  if (!normalized) return '';
  if (/<b>[\s\S]*?<\/b>/i.test(normalized)) {
    // If the entire sentence was bolded (no regular word characters outside <b>...</b>),
    // strip the whole-sentence bold so we can bold only the target word instead.
    const outsideBold = normalized
      .replace(/<b>[\s\S]*?<\/b>/gi, '')
      .replace(/[\s.,;:!?"'“”‘’()[\]{}…—–\-]+/g, '');
    if (outsideBold.length > 0) {
      return normalized;
    }
    normalized = normalized.replace(/<\/?b>/gi, '').trim();
  }
  const baseWord = stripHtmlToPlainText(rawWord || '', false).trim();
  if (!baseWord) return normalized;

  const matched = extractTypeAnswerFromExample(baseWord, normalized, options);
  if (!matched) return normalized;

  const isJapanese =
    options?.lang === 'ja' || /[\u3040-\u30ff\u4e00-\u9faf]/.test(baseWord);
  const escaped = escapeRegExp(matched);
  const pattern = isJapanese
    ? new RegExp(escaped)
    : new RegExp(`(?<![a-zA-Z0-9’'-])${escaped}(?![a-zA-Z0-9’'-])`, 'i');

  return normalized.replace(pattern, (found) => `<b>${found}</b>`);
}

export * from './languages.js';
