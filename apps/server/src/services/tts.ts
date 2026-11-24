import crypto from 'node:crypto';
import {
  cleanTextForTts,
  OPENAI_BUILTIN_VOICES,
  type AppSettings,
  type AudioTake,
  type OpenAITtsOptionsResponse,
  type OpenAIVoiceOption,
} from '@ass/shared';
import { getStoredOpenAIApiKey, saveAudioTake } from '../store.js';
import { cleanSecretValue } from '../vault.js';

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28) || 'item'
  );
}

function describeNetworkError(prefix: string, err: unknown): Error {
  if (!(err instanceof Error)) {
    return new Error(`${prefix}: ${String(err)}`);
  }
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  const detail = cause?.code
    ? `${cause.code}${cause.message ? ` (${cause.message})` : ''}`
    : cause?.message || err.message;
  return new Error(
    `${prefix}: không thể kết nối mạng (${detail}). Kiểm tra kết nối Internet, VPN hoặc tường lửa.`,
  );
}

function resolveOpenAIKey(explicitKey?: string): string {
  const explicit = explicitKey ? cleanSecretValue(explicitKey) : '';
  return explicit || getStoredOpenAIApiKey();
}

export interface OpenAIWordAudioInput {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  instructions?: string;
  apiKey?: string;
}

async function callOpenAISpeech(
  apiKey: string,
  opts: {
    text: string;
    model: string;
    voice: string;
    speed: number;
    instructions?: string;
  },
): Promise<Buffer> {
  const body: Record<string, unknown> = {
    model: opts.model,
    voice: opts.voice,
    input: opts.text,
    response_format: 'mp3',
    speed: opts.speed,
  };

  if (opts.model.includes('gpt-4o') && opts.instructions?.trim()) {
    body.instructions = opts.instructions.trim();
  }

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw describeNetworkError('OpenAI TTS', err);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS lỗi (${response.status}): ${errText || response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateOpenAIWordAudio(
  settings: AppSettings,
  input: OpenAIWordAudioInput,
): Promise<AudioTake> {
  const apiKey = resolveOpenAIKey(input.apiKey || settings.openai.apiKey);
  if (!apiKey) {
    throw new Error('Chưa cấu hình OpenAI API Key trong Cài đặt.');
  }

  const text = cleanTextForTts(input.text);
  if (!text) {
    throw new Error('Trường từ vựng đang trống, không thể tạo âm thanh.');
  }

  const model = input.model ?? settings.openai.model ?? 'gpt-4o-mini-tts';
  const voice = input.voice ?? settings.openai.voice ?? 'alloy';
  const speed = input.speed ?? settings.openai.speed ?? 1.0;
  const instructions = input.instructions ?? settings.openai.instructions;

  const buffer = await callOpenAISpeech(apiKey, { text, model, voice, speed, instructions });
  const shortId = crypto.randomBytes(4).toString('hex');
  const id = `word_${shortId}`;
  const filename = `ass_word_${slugify(text)}_${shortId}.mp3`;

  const take: AudioTake = {
    id,
    kind: 'word',
    provider: 'openai',
    voice,
    model,
    text,
    url: `/api/audio/takes/${id}`,
    filename,
    createdAt: new Date().toISOString(),
    params: { speed },
  };

  return saveAudioTake(take, buffer);
}

export async function previewOpenAIVoice(
  settings: AppSettings,
  input: {
    voice?: string;
    model?: string;
    speed?: number;
    instructions?: string;
    text?: string;
    apiKey?: string;
  },
): Promise<Buffer> {
  const apiKey = resolveOpenAIKey(input.apiKey || settings.openai.apiKey);
  if (!apiKey) {
    throw new Error('Chưa có OpenAI API Key để nghe thử giọng.');
  }
  const text = cleanTextForTts(input.text || 'resilient');
  const model = input.model || settings.openai.model || 'gpt-4o-mini-tts';
  const voice = input.voice || settings.openai.voice || 'alloy';
  const speed = input.speed ?? settings.openai.speed ?? 1.0;
  const instructions = input.instructions ?? settings.openai.instructions;

  return callOpenAISpeech(apiKey, { text, model, voice, speed, instructions });
}

export async function fetchOpenAITtsOptions(
  explicitApiKey?: string,
  selectedModel?: string,
): Promise<OpenAITtsOptionsResponse> {
  const apiKey = resolveOpenAIKey(explicitApiKey);
  const defaultModels = ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1'];

  if (!apiKey) {
    return {
      ok: false,
      models: defaultModels,
      voices: OPENAI_BUILTIN_VOICES,
      customVoicesCount: 0,
      verifiedWithApi: false,
      error: 'Chưa có OpenAI API Key. Hãy nhập và lưu API Key để tải danh sách trực tiếp từ OpenAI.',
    };
  }

  let models: string[] = [];
  try {
    const modelsRes = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!modelsRes.ok) {
      const errText = await modelsRes.text().catch(() => '');
      return {
        ok: false,
        models: defaultModels,
        voices: OPENAI_BUILTIN_VOICES,
        customVoicesCount: 0,
        verifiedWithApi: false,
        error: `OpenAI API lỗi (${modelsRes.status}): ${errText || modelsRes.statusText}`,
      };
    }

    const payload = (await modelsRes.json()) as { data?: Array<{ id: string }> };
    const ttsIds = (payload.data ?? [])
      .map((m) => m.id)
      .filter((id) => /(?:^tts-|^gpt-4o-mini-tts|-tts$|-tts-)/i.test(id));

    // Sort recommended models first
    const priority = (id: string) => {
      if (id === 'gpt-4o-mini-tts') return 0;
      if (id.startsWith('gpt-4o-mini-tts')) return 1;
      if (id === 'tts-1-hd') return 2;
      if (id === 'tts-1') return 3;
      return 10;
    };

    models = Array.from(new Set(ttsIds)).sort(
      (a, b) => priority(a) - priority(b) || a.localeCompare(b),
    );
    if (models.length === 0) {
      models = defaultModels;
    }
  } catch (err) {
    return {
      ok: false,
      models: defaultModels,
      voices: OPENAI_BUILTIN_VOICES,
      customVoicesCount: 0,
      verifiedWithApi: false,
      error: describeNetworkError('OpenAI API', err).message,
    };
  }

  // Also check if OpenAI Audio Voices endpoint returns custom/organization voices on this account
  const customVoices: OpenAIVoiceOption[] = [];
  try {
    const voicesRes = await fetch('https://api.openai.com/v1/audio/voices', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (voicesRes.ok) {
      const vData = (await voicesRes.json()) as {
        data?: Array<{ id?: string; name?: string; description?: string }>;
        voices?: Array<{ id?: string; name?: string; description?: string }>;
      };
      const rawList = vData.data ?? vData.voices ?? [];
      for (const item of rawList) {
        const id = (item.id || item.name || '').trim();
        if (!id) continue;
        if (OPENAI_BUILTIN_VOICES.some((b) => b.id === id)) continue;
        customVoices.push({
          id,
          name: item.name || id,
          description: item.description || 'Custom Voice trên tài khoản OpenAI',
          source: 'custom',
          supportsLegacyTts: false,
        });
      }
    }
  } catch {
    // Standard OpenAI accounts use built-in voices; ignore optional custom voices endpoint failure
  }

  const effectiveModel = selectedModel || models[0] || 'gpt-4o-mini-tts';
  const isLegacyTts = effectiveModel === 'tts-1' || effectiveModel === 'tts-1-hd';
  const builtin = isLegacyTts
    ? OPENAI_BUILTIN_VOICES.filter((v) => v.supportsLegacyTts)
    : OPENAI_BUILTIN_VOICES;

  return {
    ok: true,
    models,
    voices: [...customVoices, ...builtin],
    customVoicesCount: customVoices.length,
    verifiedWithApi: true,
  };
}
