import type {
  AnkiNoteItem,
  AppSettings,
  AudioTake,
  DictionaryLookupResponse,
  DownloadsFilterMode,
  DownloadsScanResponse,
  GeminiGenerateExamplesRequest,
  GeminiGenerateExamplesResponse,
  GeminiModelsResponse,
  LanguageCode,
  OpenAITtsOptionsResponse,
  SaveCardPayload,
  TempImageMedia,
} from '@ass/shared';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request lỗi (${response.status})`);
  }
  return data;
}

export const api = {
  getSettings: () => requestJson<AppSettings>('/api/settings'),

  saveSettings: (partial: Partial<AppSettings>) =>
    requestJson<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(partial),
    }),

  saveOpenAIApiKey: (apiKey: string) =>
    requestJson<AppSettings>('/api/secrets/openai', {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }),

  deleteOpenAIApiKey: () =>
    requestJson<AppSettings>('/api/secrets/openai', {
      method: 'DELETE',
    }),

  saveGeminiApiKey: (apiKey: string) =>
    requestJson<AppSettings>('/api/secrets/gemini', {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }),

  deleteGeminiApiKey: () =>
    requestJson<AppSettings>('/api/secrets/gemini', {
      method: 'DELETE',
    }),

  fetchGeminiModels: (payload?: { apiKey?: string }) =>
    requestJson<GeminiModelsResponse>('/api/gemini/models', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  generateGeminiExamples: (payload: GeminiGenerateExamplesRequest) =>
    requestJson<GeminiGenerateExamplesResponse>('/api/gemini/examples', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  fetchOpenAITtsOptions: (payload?: { apiKey?: string; model?: string }) =>
    requestJson<OpenAITtsOptionsResponse>('/api/openai/tts-options', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  previewOpenAIVoice: async (payload: {
    voice: string;
    model: string;
    speed?: number;
    instructions?: string;
    text?: string;
    apiKey?: string;
  }): Promise<string> => {
    const response = await fetch('/api/openai/preview-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `Không nghe thử được giọng (${response.status})`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  lookupDictionary: (word: string, lang: LanguageCode = 'en', refresh = false) =>
    requestJson<DictionaryLookupResponse>(
      `/api/dictionary/lookup?word=${encodeURIComponent(word)}&lang=${encodeURIComponent(lang)}&refresh=${refresh ? '1' : '0'}`,
    ),

  lookupFallbackDictionary: (word: string, lang: LanguageCode = 'en') =>
    requestJson<DictionaryLookupResponse>(
      `/api/dictionary/fallback?word=${encodeURIComponent(word)}&lang=${encodeURIComponent(lang)}`,
    ),

  generateWordAudio: (payload: {
    text: string;
    model?: string;
    voice?: string;
    speed?: number;
    instructions?: string;
  }) =>
    requestJson<AudioTake>('/api/audio/word', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteAudioTake: (id: string) =>
    requestJson<{ deleted: boolean }>(`/api/audio/takes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  uploadTempImage: (payload: { dataUrl?: string; imageUrl?: string; filename?: string }) =>
    requestJson<TempImageMedia>('/api/media/images', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteTempImage: (id: string) =>
    requestJson<{ deleted: boolean }>(`/api/media/images/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  clearTempImages: (keepIds?: string[]) =>
    requestJson<{ ok: boolean; deleted: number }>('/api/media/images/clear', {
      method: 'POST',
      body: JSON.stringify({ keepIds: keepIds ?? [] }),
    }),

  grabClipboardImage: () =>
    requestJson<TempImageMedia>('/api/clipboard/image/grab', {
      method: 'POST',
      body: '{}',
    }),

  listDownloadedAudio: (options?: {
    filter?: DownloadsFilterMode;
    dir?: string;
    maxFiles?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.filter) params.set('filter', options.filter);
    if (options?.dir) params.set('dir', options.dir);
    if (options?.maxFiles) params.set('maxFiles', String(options.maxFiles));
    const qs = params.toString();
    return requestJson<DownloadsScanResponse>(`/api/downloads/audio${qs ? `?${qs}` : ''}`);
  },

  deleteDownloadedAudio: (id: string) =>
    requestJson<{ deleted: boolean; filename: string }>(
      `/api/downloads/audio/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  listWordDownloadedAudio: (options?: {
    filter?: DownloadsFilterMode;
    dir?: string;
    maxFiles?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.filter) params.set('filter', options.filter);
    if (options?.dir) params.set('dir', options.dir);
    if (options?.maxFiles) params.set('maxFiles', String(options.maxFiles));
    const qs = params.toString();
    return requestJson<DownloadsScanResponse>(`/api/word-downloads/audio${qs ? `?${qs}` : ''}`);
  },

  deleteWordDownloadedAudio: (id: string) =>
    requestJson<{ deleted: boolean; filename: string }>(
      `/api/word-downloads/audio/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  clearCambridgeAudios: () =>
    requestJson<{ ok: boolean; deleted: number }>('/api/cambridge-audio/clear', {
      method: 'POST',
      body: '{}',
    }),

  sendElevenLabsHandoff: (text: string) =>
    requestJson<{ ok: boolean; id: string; text: string }>('/api/handoff/elevenlabs', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  getAnkiStatus: () =>
    requestJson<{ connected: boolean; version?: number; error?: string }>('/api/anki/status'),

  getAnkiMeta: () =>
    requestJson<{ decks: string[]; models: string[] }>('/api/anki/meta'),

  getAnkiModelFields: (modelName: string) =>
    requestJson<{ modelName: string; fields: string[] }>(
      `/api/anki/model-fields?modelName=${encodeURIComponent(modelName)}`,
    ),

  findAnkiNotes: (query: string, limit = 100) =>
    requestJson<{ notes: AnkiNoteItem[] }>(
      `/api/anki/notes?query=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  saveCardToAnki: (payload: SaveCardPayload) =>
    requestJson<{
      ok: boolean;
      mode: 'create' | 'update';
      noteId: number;
      uploadedWordFile?: string;
      uploadedExampleFile?: string;
      uploadedImageFile?: string;
    }>('/api/anki/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
