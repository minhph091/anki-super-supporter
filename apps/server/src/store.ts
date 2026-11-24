import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDefaultLanguageProfile,
  DEFAULT_FIELD_VISIBILITY,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_SETTINGS,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type AppSettings,
  type AudioTake,
  type LanguageCode,
  type LanguageProfile,
  type TempImageMedia,
} from '@ass/shared';
import { getDefaultDownloadsDir } from './services/downloadsScanner.js';
import { cleanSecretValue, getPersistentConfigDir, maskSecretKey, secretVault } from './vault.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const TMP_AUDIO_DIR = path.join(DATA_DIR, 'tmp-audio');
export const TMP_CAMBRIDGE_AUDIO_DIR = path.join(DATA_DIR, 'tmp-cambridge-audio');
export const TMP_IMAGE_DIR = path.join(DATA_DIR, 'tmp-images');

export const PERSISTENT_CONFIG_DIR = getPersistentConfigDir();
const SETTINGS_PATH = path.join(PERSISTENT_CONFIG_DIR, 'settings.json');
const LEGACY_SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

const TAKE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const TEMP_IMAGE_TTL_MS = 1000 * 60 * 30; // 30 minutes for idle temp images

const audioTakesMap = new Map<string, { meta: AudioTake; filePath: string }>();
const tempImagesMap = new Map<string, { meta: TempImageMedia; filePath: string }>();

function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(TMP_AUDIO_DIR, { recursive: true });
  fs.mkdirSync(TMP_CAMBRIDGE_AUDIO_DIR, { recursive: true });
  fs.mkdirSync(TMP_IMAGE_DIR, { recursive: true });
  try {
    fs.mkdirSync(PERSISTENT_CONFIG_DIR, { recursive: true });
  } catch {
    // ignore if persistent config dir is inaccessible
  }
}

export function clearCambridgeTempAudios(): number {
  ensureDataDirs();
  let deleted = 0;
  try {
    for (const file of fs.readdirSync(TMP_CAMBRIDGE_AUDIO_DIR)) {
      const fullPath = path.join(TMP_CAMBRIDGE_AUDIO_DIR, file);
      try {
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
          deleted += 1;
        }
      } catch {
        // ignore individual unlink errors
      }
    }
  } catch {
    // ignore cleanup errors
  }
  return deleted;
}

export function clearAllTempImages(keepIds: string[] = []): number {
  ensureDataDirs();
  const keepSet = new Set(keepIds.map((id) => id.replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean));
  let deleted = 0;
  try {
    for (const file of fs.readdirSync(TMP_IMAGE_DIR)) {
      const baseId = file.replace(/\.[^.]+$/, '');
      if (keepSet.has(baseId)) continue;
      const fullPath = path.join(TMP_IMAGE_DIR, file);
      try {
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
          tempImagesMap.delete(baseId);
          deleted += 1;
        }
      } catch {
        // ignore individual unlink errors
      }
    }
  } catch {
    // ignore cleanup errors
  }
  for (const id of Array.from(tempImagesMap.keys())) {
    if (!keepSet.has(id)) {
      tempImagesMap.delete(id);
    }
  }
  return deleted;
}

export function clearAllAudioTakes(keepIds: string[] = []): number {
  ensureDataDirs();
  const keepSet = new Set(keepIds.map((id) => id.replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean));
  let deleted = 0;
  try {
    for (const file of fs.readdirSync(TMP_AUDIO_DIR)) {
      if (!file.endsWith('.mp3')) continue;
      const baseId = file.replace(/\.mp3$/, '');
      if (keepSet.has(baseId)) continue;
      const fullPath = path.join(TMP_AUDIO_DIR, file);
      try {
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
          audioTakesMap.delete(baseId);
          deleted += 1;
        }
      } catch {
        // ignore individual unlink errors
      }
    }
  } catch {
    // ignore cleanup errors
  }
  for (const id of Array.from(audioTakesMap.keys())) {
    if (!keepSet.has(id)) {
      audioTakesMap.delete(id);
    }
  }
  return deleted;
}

let legacyMigrated = false;

function migrateLegacySettingsIfNeeded(): void {
  if (legacyMigrated) return;
  legacyMigrated = true;
  ensureDataDirs();
  if (!fs.existsSync(SETTINGS_PATH) && fs.existsSync(LEGACY_SETTINGS_PATH)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_SETTINGS_PATH, 'utf-8')) as Partial<AppSettings>;
      if (legacy.openai?.apiKey?.trim()) {
        secretVault.set('openai_api_key', legacy.openai.apiKey);
        legacy.openai.apiKey = '';
      }
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(legacy, null, 2), 'utf-8');
    } catch {
      // ignore migration errors
    }
  }
}

export function getStoredOpenAIApiKey(): string {
  migrateLegacySettingsIfNeeded();
  const fromVault = secretVault.get('openai_api_key');
  if (fromVault) return fromVault;
  const fromEnv = cleanSecretValue(process.env.OPENAI_API_KEY || '');
  return fromEnv;
}

export function setStoredOpenAIApiKey(apiKey: string): void {
  secretVault.set('openai_api_key', apiKey);
}

export function deleteStoredOpenAIApiKey(): void {
  secretVault.delete('openai_api_key');
}

export function getStoredGeminiApiKey(): string {
  migrateLegacySettingsIfNeeded();
  const fromVault = secretVault.get('gemini_api_key');
  if (fromVault) return fromVault;
  const fromEnv = cleanSecretValue(process.env.GEMINI_API_KEY || '');
  return fromEnv;
}

export function setStoredGeminiApiKey(apiKey: string): void {
  secretVault.set('gemini_api_key', apiKey);
}

export function deleteStoredGeminiApiKey(): void {
  secretVault.delete('gemini_api_key');
}

const LEGACY_GEMINI_PROMPTS = new Set([
  'Hãy tạo các câu ví dụ tiếng Anh tự nhiên, thông dụng trong giao tiếp hoặc học thuật cho từ vựng "{{word}}", kèm bản dịch tiếng Việt chuẩn xác. Trong mỗi câu ví dụ, hãy in đậm từ vựng (hoặc dạng chia của nó) bằng thẻ <b>...</b>.',
  'Hãy tạo các câu ví dụ tiếng Nhật tự nhiên, thực tế trong đời sống (kèm cách dùng chuẩn) cho từ vựng "{{word}}", kèm bản dịch tiếng Việt tự nhiên. Trong mỗi câu ví dụ, hãy in đậm từ vựng bằng thẻ <b>...</b>.',
  'Tạo câu ví dụ tiếng Anh ngắn gọn, đơn giản cho từ "{{word}}" kèm dịch tiếng Việt. Ngoài từ "{{word}}", chỉ dùng từ vựng rất cơ bản, quen thuộc (A1), không dùng từ khó và in đậm từ vựng bằng thẻ <b>...</b>.',
  'Tạo câu ví dụ tiếng Nhật ngắn gọn, đơn giản cho từ "{{word}}" kèm dịch tiếng Việt. Ngoài từ "{{word}}", chỉ dùng từ vựng và ngữ pháp rất cơ bản, dễ hiểu, không dùng từ khó và in đậm từ vựng bằng thẻ <b>...</b>.',
]);

const LEGACY_GEMINI_SYSTEM_INSTRUCTIONS = new Set([
  'Bạn là trợ lý ngôn ngữ chuyên tạo câu ví dụ học từ vựng Anki chất lượng cao, tự nhiên, dễ nhớ và dịch tiếng Việt mượt mà.',
  'Bạn tạo câu ví dụ Anki thật ngắn gọn, đơn giản. Ngoài từ vựng đang học, chỉ dùng các từ vựng cơ bản, dễ nhất (trình độ A1) để người học không bao giờ gặp thêm từ khó khác trong câu.',
  'Bạn là trợ lý tạo câu ví dụ học từ vựng. Hãy tuân thủ chính xác yêu cầu, độ khó và ngữ cảnh trong câu lệnh (prompt) của người dùng.',
]);

function mergeLanguageProfile(
  lang: LanguageCode,
  base: LanguageProfile,
  override?: Partial<LanguageProfile>,
): LanguageProfile {
  const defaults = createDefaultLanguageProfile(lang);
  const rawPrompt =
    override?.geminiPrompt !== undefined
      ? override.geminiPrompt
      : base.geminiPrompt || defaults.geminiPrompt;
  const geminiPrompt =
    rawPrompt && LEGACY_GEMINI_PROMPTS.has(rawPrompt.trim())
      ? defaults.geminiPrompt
      : rawPrompt;
  return {
    defaultDeck: override?.defaultDeck ?? base.defaultDeck ?? defaults.defaultDeck,
    defaultNoteType: override?.defaultNoteType ?? base.defaultNoteType ?? defaults.defaultNoteType,
    posFormat: override?.posFormat ?? base.posFormat ?? defaults.posFormat,
    ...(lang === 'en'
      ? {
        cambridgeMode:
          override?.cambridgeMode === 'learner-english' ||
            override?.cambridgeMode === 'english'
            ? override.cambridgeMode
            : base.cambridgeMode === 'learner-english'
              ? 'learner-english'
              : 'english',
      }
      : {}),
    fieldMapping: {
      ...defaults.fieldMapping,
      ...(base.fieldMapping ?? {}),
      ...(override?.fieldMapping ?? {}),
    },
    visibleFields: {
      ...defaults.visibleFields,
      ...(base.visibleFields ?? {}),
      ...(override?.visibleFields ?? {}),
    },
    customFields: Array.isArray(override?.customFields)
      ? override.customFields
      : Array.isArray(base.customFields)
        ? base.customFields
        : [],
    ttsInstructions:
      override?.ttsInstructions !== undefined
        ? override.ttsInstructions
        : base.ttsInstructions || defaults.ttsInstructions,
    ttsVoice: override?.ttsVoice !== undefined ? override.ttsVoice : base.ttsVoice,
    geminiPrompt,
  };
}

export function loadSettings(): AppSettings {
  migrateLegacySettingsIfNeeded();
  ensureDataDirs();
  const defaultWithDir: AppSettings = {
    ...structuredClone(DEFAULT_SETTINGS),
    wordAudioDownloads: {
      ...DEFAULT_SETTINGS.wordAudioDownloads,
      downloadsDir: getDefaultDownloadsDir(),
    },
    elevenlabsDownloads: {
      ...DEFAULT_SETTINGS.elevenlabsDownloads,
      downloadsDir: getDefaultDownloadsDir(),
    },
  };

  let raw: Partial<AppSettings> = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) as Partial<AppSettings>;
    } catch {
      raw = {};
    }
  }

  // If an older settings.json still had a plaintext key, move it to encrypted vault automatically
  if (raw.openai?.apiKey?.trim() && !secretVault.get('openai_api_key')) {
    secretVault.set('openai_api_key', raw.openai.apiKey);
    raw.openai.apiKey = '';
    try {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(raw, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  if (raw.gemini?.apiKey?.trim() && !secretVault.get('gemini_api_key')) {
    secretVault.set('gemini_api_key', raw.gemini.apiKey);
    raw.gemini.apiKey = '';
    try {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(raw, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  const effectiveKey = getStoredOpenAIApiKey();
  const effectiveGeminiKey = getStoredGeminiApiKey();
  const activeLanguage: LanguageCode = isSupportedLanguage(raw.activeLanguage)
    ? raw.activeLanguage
    : 'en';

  // Auto-migrate legacy flat settings into languageProfiles.en seamlessly
  const legacyEnFallback: Partial<LanguageProfile> = !raw.languageProfiles?.en
    ? {
      defaultDeck: raw.defaultDeck,
      defaultNoteType: raw.defaultNoteType,
      posFormat: raw.posFormat,
      fieldMapping: raw.fieldMapping,
      visibleFields: raw.visibleFields,
      customFields: raw.customFields,
      ttsInstructions: raw.openai?.instructions,
    }
    : {};

  const languageProfiles = {} as Record<LanguageCode, LanguageProfile>;
  for (const lang of SUPPORTED_LANGUAGES) {
    const defProfile = createDefaultLanguageProfile(lang);
    const storedProfile =
      lang === 'en'
        ? { ...legacyEnFallback, ...(raw.languageProfiles?.en ?? {}) }
        : raw.languageProfiles?.[lang];
    languageProfiles[lang] = mergeLanguageProfile(lang, defProfile, storedProfile);
  }

  const activeProfile = languageProfiles[activeLanguage];

  const resolvedCambridgeMode =
    raw.cambridgeMode === 'learner-english' ||
      languageProfiles.en.cambridgeMode === 'learner-english'
      ? 'learner-english'
      : 'english';
  languageProfiles.en.cambridgeMode = resolvedCambridgeMode;

  return {
    ...defaultWithDir,
    ...raw,
    activeLanguage,
    languageProfiles,
    defaultDeck: activeProfile.defaultDeck,
    defaultNoteType: activeProfile.defaultNoteType,
    posFormat: activeProfile.posFormat,
    cambridgeMode: resolvedCambridgeMode,
    fieldMapping: { ...activeProfile.fieldMapping },
    visibleFields: { ...DEFAULT_FIELD_VISIBILITY, ...activeProfile.visibleFields },
    customFields: [...activeProfile.customFields],
    autoClipboardImage:
      typeof raw.autoClipboardImage === 'boolean' ? raw.autoClipboardImage : true,
    wordAudioSource:
      raw.wordAudioSource === 'folder_scan' ? 'folder_scan' : 'openai_tts',
    wordAudioDownloads: {
      ...defaultWithDir.wordAudioDownloads,
      ...(raw.wordAudioDownloads ?? {}),
      downloadsDir:
        raw.wordAudioDownloads?.downloadsDir?.trim() || getDefaultDownloadsDir(),
    },
    openai: {
      ...defaultWithDir.openai,
      ...(raw.openai ?? {}),
      instructions: activeProfile.ttsInstructions || defaultWithDir.openai.instructions,
      apiKey: effectiveKey,
      hasApiKey: Boolean(effectiveKey),
      apiKeyMasked: maskSecretKey(effectiveKey),
      storagePath: PERSISTENT_CONFIG_DIR,
    },
    gemini: {
      ...defaultWithDir.gemini,
      ...(raw.gemini ?? {}),
      systemInstruction:
        !raw.gemini?.systemInstruction ||
          LEGACY_GEMINI_SYSTEM_INSTRUCTIONS.has(raw.gemini.systemInstruction.trim())
          ? ''
          : raw.gemini.systemInstruction,
      model:
        !raw.gemini?.model ||
          raw.gemini.model === 'gemini-2.5-flash' ||
          raw.gemini.model === 'gemini-2.0-flash'
          ? DEFAULT_GEMINI_MODEL
          : raw.gemini.model,
      apiKey: effectiveGeminiKey,
      hasApiKey: Boolean(effectiveGeminiKey),
      apiKeyMasked: maskSecretKey(effectiveGeminiKey),
      storagePath: PERSISTENT_CONFIG_DIR,
    },
    elevenlabsDownloads: {
      ...defaultWithDir.elevenlabsDownloads,
      ...(raw.elevenlabsDownloads ?? {}),
      downloadsDir:
        raw.elevenlabsDownloads?.downloadsDir?.trim() || getDefaultDownloadsDir(),
    },
  };
}

/**
 * Safe settings view sent to frontend — never leaks the raw API key,
 * preventing accidental blank overwrites while showing exact saved vault status.
 */
export function getPublicSettings(): AppSettings {
  const full = loadSettings();
  return {
    ...full,
    openai: {
      ...full.openai,
      apiKey: '',
    },
    gemini: {
      ...full.gemini,
      apiKey: '',
    },
  };
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  migrateLegacySettingsIfNeeded();
  ensureDataDirs();
  const current = loadSettings();

  // Only update encrypted vault when a non-empty key is explicitly supplied
  const incomingKey = partial.openai?.apiKey ? cleanSecretValue(partial.openai.apiKey) : '';
  if (incomingKey) {
    setStoredOpenAIApiKey(incomingKey);
  }
  const incomingGeminiKey = partial.gemini?.apiKey ? cleanSecretValue(partial.gemini.apiKey) : '';
  if (incomingGeminiKey) {
    setStoredGeminiApiKey(incomingGeminiKey);
  }

  const nextActiveLanguage: LanguageCode = isSupportedLanguage(partial.activeLanguage)
    ? partial.activeLanguage
    : current.activeLanguage;

  const nextProfiles = {} as Record<LanguageCode, LanguageProfile>;
  for (const lang of SUPPORTED_LANGUAGES) {
    const incomingProfile = partial.languageProfiles?.[lang];
    nextProfiles[lang] = mergeLanguageProfile(lang, current.languageProfiles[lang], incomingProfile);
  }

  // If caller updated top-level profile fields without languageProfiles, apply to active profile
  const hasExplicitProfileUpdate = Boolean(partial.languageProfiles?.[nextActiveLanguage]);
  if (!hasExplicitProfileUpdate) {
    const topLevelPatch: Partial<LanguageProfile> = {};
    if (partial.defaultDeck !== undefined) topLevelPatch.defaultDeck = partial.defaultDeck;
    if (partial.defaultNoteType !== undefined) topLevelPatch.defaultNoteType = partial.defaultNoteType;
    if (partial.posFormat !== undefined) topLevelPatch.posFormat = partial.posFormat;
    if (partial.fieldMapping !== undefined) topLevelPatch.fieldMapping = partial.fieldMapping;
    if (partial.visibleFields !== undefined) topLevelPatch.visibleFields = partial.visibleFields;
    if (partial.customFields !== undefined) topLevelPatch.customFields = partial.customFields;
    if (partial.openai?.instructions !== undefined) {
      topLevelPatch.ttsInstructions = partial.openai.instructions;
    }
    if (Object.keys(topLevelPatch).length > 0) {
      nextProfiles[nextActiveLanguage] = mergeLanguageProfile(
        nextActiveLanguage,
        nextProfiles[nextActiveLanguage],
        topLevelPatch,
      );
    }
  }

  const nextCambridgeMode =
    partial.cambridgeMode === 'learner-english' || partial.cambridgeMode === 'english'
      ? partial.cambridgeMode
      : partial.languageProfiles?.en?.cambridgeMode === 'learner-english' ||
        partial.languageProfiles?.en?.cambridgeMode === 'english'
        ? partial.languageProfiles.en.cambridgeMode
        : current.cambridgeMode;
  nextProfiles.en.cambridgeMode = nextCambridgeMode;

  const activeProfile = nextProfiles[nextActiveLanguage];

  const nextToPersist: AppSettings = {
    ...current,
    ...partial,
    activeLanguage: nextActiveLanguage,
    languageProfiles: nextProfiles,
    defaultDeck: activeProfile.defaultDeck,
    defaultNoteType: activeProfile.defaultNoteType,
    posFormat: activeProfile.posFormat,
    cambridgeMode: nextCambridgeMode,
    fieldMapping: { ...activeProfile.fieldMapping },
    visibleFields: { ...activeProfile.visibleFields },
    customFields: [...activeProfile.customFields],
    autoClipboardImage:
      typeof partial.autoClipboardImage === 'boolean'
        ? partial.autoClipboardImage
        : current.autoClipboardImage,
    wordAudioSource:
      partial.wordAudioSource === 'folder_scan' || partial.wordAudioSource === 'openai_tts'
        ? partial.wordAudioSource
        : current.wordAudioSource,
    wordAudioDownloads: {
      ...current.wordAudioDownloads,
      ...(partial.wordAudioDownloads ?? {}),
      downloadsDir:
        partial.wordAudioDownloads?.downloadsDir?.trim() ||
        current.wordAudioDownloads.downloadsDir ||
        getDefaultDownloadsDir(),
    },
    openai: {
      ...current.openai,
      ...(partial.openai ?? {}),
      instructions: activeProfile.ttsInstructions,
      apiKey: '', // Never store plaintext secret in settings.json
      hasApiKey: undefined,
      apiKeyMasked: undefined,
      storagePath: undefined,
    },
    gemini: {
      ...current.gemini,
      ...(partial.gemini ?? {}),
      apiKey: '', // Never store plaintext secret in settings.json
      hasApiKey: undefined,
      apiKeyMasked: undefined,
      storagePath: undefined,
    },
    elevenlabsDownloads: {
      ...current.elevenlabsDownloads,
      ...(partial.elevenlabsDownloads ?? {}),
      downloadsDir:
        partial.elevenlabsDownloads?.downloadsDir?.trim() ||
        current.elevenlabsDownloads.downloadsDir ||
        getDefaultDownloadsDir(),
    },
  };

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(nextToPersist, null, 2), 'utf-8');
  return getPublicSettings();
}

export function saveAudioTake(meta: AudioTake, buffer: Buffer): AudioTake {
  ensureDataDirs();
  const filePath = path.join(TMP_AUDIO_DIR, `${meta.id}.mp3`);
  fs.writeFileSync(filePath, buffer);
  audioTakesMap.set(meta.id, { meta, filePath });
  return meta;
}

export function getAudioTake(id: string): { meta: AudioTake; filePath: string } | null {
  const inMem = audioTakesMap.get(id);
  if (inMem && fs.existsSync(inMem.filePath)) {
    return inMem;
  }
  const fallbackPath = path.join(TMP_AUDIO_DIR, `${id}.mp3`);
  if (fs.existsSync(fallbackPath)) {
    return {
      meta: {
        id,
        kind: id.startsWith('word_') ? 'word' : 'example',
        provider: 'openai',
        voice: '',
        model: '',
        text: '',
        url: `/api/audio/takes/${id}`,
        filename: `${id}.mp3`,
        createdAt: new Date().toISOString(),
      },
      filePath: fallbackPath,
    };
  }
  return null;
}

export function deleteAudioTake(id: string): boolean {
  const record = getAudioTake(id);
  audioTakesMap.delete(id);
  if (record && fs.existsSync(record.filePath)) {
    fs.unlinkSync(record.filePath);
    return true;
  }
  return false;
}

export function cleanupOldAudioTakes(): void {
  ensureDataDirs();
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(TMP_AUDIO_DIR)) {
      if (!file.endsWith('.mp3')) continue;
      const fullPath = path.join(TMP_AUDIO_DIR, file);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > TAKE_TTL_MS) {
        fs.unlinkSync(fullPath);
        audioTakesMap.delete(file.replace(/\.mp3$/, ''));
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

function extFromMimeType(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
  if (lower.includes('webp')) return '.webp';
  if (lower.includes('gif')) return '.gif';
  if (lower.includes('bmp')) return '.bmp';
  return '.png';
}

function mimeFromExt(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === '.jpg' || lower === '.jpeg') return 'image/jpeg';
  if (lower === '.webp') return 'image/webp';
  if (lower === '.gif') return 'image/gif';
  if (lower === '.bmp') return 'image/bmp';
  return 'image/png';
}

export function saveTempImage(
  buffer: Buffer,
  mimeType: string,
  options: {
    filename?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    keepPreviousIds?: string[];
  } = {},
): TempImageMedia {
  ensureDataDirs();
  // Automatically purge previous unused temp images so only the active card image stays on disk
  clearAllTempImages(options.keepPreviousIds ?? []);

  const ext = extFromMimeType(mimeType);
  const id = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const filePath = path.join(TMP_IMAGE_DIR, `${id}${ext}`);
  fs.writeFileSync(filePath, buffer);

  const safeName =
    options.filename?.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || `${id}${ext}`;
  const meta: TempImageMedia = {
    id,
    filename: safeName,
    mimeType,
    sizeBytes: buffer.length,
    url: `/api/media/images/${id}`,
    sourceUrl: options.sourceUrl,
    sourceTitle: options.sourceTitle,
    receivedAt: new Date().toISOString(),
  };
  tempImagesMap.set(id, { meta, filePath });
  return meta;
}

export function getTempImage(id: string): { meta: TempImageMedia; filePath: string } | null {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const inMem = tempImagesMap.get(safeId);
  if (inMem && fs.existsSync(inMem.filePath)) {
    return inMem;
  }
  for (const ext of ['.webp', '.png', '.jpg', '.gif', '.bmp']) {
    const candidate = path.join(TMP_IMAGE_DIR, `${safeId}${ext}`);
    if (fs.existsSync(candidate)) {
      const stat = fs.statSync(candidate);
      return {
        meta: {
          id: safeId,
          filename: `${safeId}${ext}`,
          mimeType: mimeFromExt(ext),
          sizeBytes: stat.size,
          url: `/api/media/images/${safeId}`,
          receivedAt: stat.mtime.toISOString(),
        },
        filePath: candidate,
      };
    }
  }
  return null;
}

export function deleteTempImage(id: string): boolean {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const record = getTempImage(safeId);
  tempImagesMap.delete(safeId);
  if (record && fs.existsSync(record.filePath)) {
    fs.unlinkSync(record.filePath);
    return true;
  }
  return false;
}

export function cleanupOldTempImages(): void {
  ensureDataDirs();
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(TMP_IMAGE_DIR)) {
      const fullPath = path.join(TMP_IMAGE_DIR, file);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > TEMP_IMAGE_TTL_MS) {
        fs.unlinkSync(fullPath);
        tempImagesMap.delete(file.replace(/\.[^.]+$/, ''));
      }
    }
  } catch {
    // ignore cleanup errors
  }
}
