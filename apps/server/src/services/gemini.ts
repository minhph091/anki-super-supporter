import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_BUILTIN_MODELS,
  getLanguageDefinition,
  interpolateGeminiPrompt,
  isSupportedLanguage,
  sanitizeAnkiBoldText,
  type AppSettings,
  type GeminiExamplePair,
  type GeminiGenerateExamplesRequest,
  type GeminiGenerateExamplesResponse,
  type GeminiModelOption,
  type GeminiModelsResponse,
  type LanguageCode,
} from '@ass/shared';
import { getStoredGeminiApiKey, saveSettings } from '../store.js';
import { cleanSecretValue } from '../vault.js';

const GEMINI_GENERATE_TIMEOUT_MS = 15000;
const GEMINI_MODELS_TIMEOUT_MS = 10000;
const MODELS_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

// Remember models that require classic generateContent instead of Interactions API
const modelsRequiringLegacyGenerateContent = new Set<string>();
let cachedLiveModels: { keyHash: string; models: GeminiModelOption[]; fetchedAt: number } | null =
  null;

function createGenAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

function extractSdkApiError(err: unknown): { status: number; message: string } | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as {
    status?: number;
    statusCode?: number;
    message?: string;
    error?: { message?: string; error?: { message?: string } };
  };
  const status =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : undefined;
  if (typeof status !== 'number' || status < 100) return null;
  const rawMsg =
    e.error?.error?.message ||
    e.error?.message ||
    (typeof e.message === 'string' ? e.message : '') ||
    `HTTP ${status}`;
  return { status, message: rawMsg };
}

function resolveGeminiKey(explicitKey?: string): string {
  const explicit = explicitKey ? cleanSecretValue(explicitKey) : '';
  return explicit || getStoredGeminiApiKey();
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'TimeoutError' ||
    err.name === 'AbortError' ||
    /aborted due to timeout|timed out/i.test(err.message)
  );
}

function describeNetworkError(prefix: string, err: unknown, timeoutMs = GEMINI_GENERATE_TIMEOUT_MS): Error {
  if (!(err instanceof Error)) {
    return new Error(`${prefix}: ${String(err)}`);
  }
  if (isTimeoutError(err)) {
    return new Error(
      `${prefix}: phản hồi quá thời gian chờ (${Math.round(timeoutMs / 1000)}s). Hãy thử lại hoặc chọn mô hình khác.`,
    );
  }
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  const detail = cause?.code
    ? `${cause.code}${cause.message ? ` (${cause.message})` : ''}`
    : cause?.message || err.message;
  return new Error(
    `${prefix}: không thể kết nối mạng (${detail}). Kiểm tra kết nối Internet, VPN hoặc tường lửa.`,
  );
}

/**
 * Sorts Gemini models with newest generations (4.x > 3.8 > 3.5 > 3.1) first,
 * and orders fast daily drivers (Hydrogen / Flash / Flash-Lite) ahead of heavy reasoning models.
 */
export function sortGeminiModels(models: GeminiModelOption[]): GeminiModelOption[] {
  const parseScore = (id: string) => {
    const verMatch = id.match(/^gemini-(\d+(?:\.\d+)?)/i);
    const version = verMatch ? Number.parseFloat(verMatch[1]) : 0;
    const isPreviewOrExp = /(?:preview|exp|experimental|latest|\d{2}-\d{4}|\d{3}$)/i.test(id);
    let tier = 5;
    if (/^gemini-4-hydrogen$/i.test(id) || /^gemini-\d+(?:\.\d+)?-flash$/i.test(id)) tier = 0;
    else if (/^gemini-\d+(?:\.\d+)?-flash-lite$/i.test(id)) tier = 1;
    else if (/^gemini-4-argon$/i.test(id) || /^gemini-4-neon$/i.test(id)) tier = 2;
    else if (/^gemini-4-carbon$/i.test(id) || /^gemini-\d+(?:\.\d+)?-pro$/i.test(id)) tier = 3;
    else if (id.includes('-flash') && !id.includes('lite')) tier = 4;
    else if (id.includes('lite')) tier = 5;
    else if (id.includes('-pro')) tier = 6;
    return { version, tier, isPreviewOrExp: isPreviewOrExp ? 1 : 0 };
  };

  return [...models].sort((a, b) => {
    const sa = parseScore(a.id);
    const sb = parseScore(b.id);
    if (sb.version !== sa.version) return sb.version - sa.version;
    if (sa.tier !== sb.tier) return sa.tier - sb.tier;
    if (sa.isPreviewOrExp !== sb.isPreviewOrExp) return sa.isPreviewOrExp - sb.isPreviewOrExp;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Parses Gemini's JSON response (even if wrapped in markdown code fences or array/object variants)
 * into clean, Anki-bold-safe example pairs.
 */
export function parseGeminiExamplesJson(rawText: string): GeminiExamplePair[] {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      return [];
    }
  }

  const rawItems: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { examples?: unknown[] })?.examples)
      ? ((parsed as { examples: unknown[] }).examples ?? [])
      : Array.isArray((parsed as { items?: unknown[] })?.items)
        ? ((parsed as { items: unknown[] }).items ?? [])
        : [];

  const results: GeminiExamplePair[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object') continue;

    const rawTarget = String(
      item.target ?? item.en ?? item.ja ?? item.jp ?? item.sentence ?? item.example ?? '',
    ).trim();
    const rawVi = String(
      item.vi ?? item.translation ?? item.meaning ?? item.vietnamese ?? '',
    ).trim();
    const rawContext = item.context ? String(item.context).trim() : undefined;

    const target = sanitizeAnkiBoldText(rawTarget, false).replace(/\s*\n+\s*/g, ' ').trim();
    const vi = sanitizeAnkiBoldText(rawVi, false).replace(/\s*\n+\s*/g, ' ').trim();
    if (!target) continue;

    results.push({
      id: `gem_ex_${i + 1}_${crypto.randomBytes(3).toString('hex')}`,
      target,
      vi,
      ...(rawContext ? { context: sanitizeAnkiBoldText(rawContext, false) } : {}),
    });
  }

  return results;
}

export async function fetchGeminiModels(
  explicitApiKey?: string,
  useCache = false,
): Promise<GeminiModelsResponse> {
  const apiKey = resolveGeminiKey(explicitApiKey);
  if (!apiKey) {
    return {
      ok: false,
      models: GEMINI_BUILTIN_MODELS,
      verifiedWithApi: false,
      error:
        'Chưa có Gemini API Key. Hãy nhập và lưu API Key để tải danh sách mô hình từ Google Gemini.',
    };
  }

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
  if (
    useCache &&
    cachedLiveModels &&
    cachedLiveModels.keyHash === keyHash &&
    Date.now() - cachedLiveModels.fetchedAt < MODELS_CACHE_TTL_MS
  ) {
    return {
      ok: true,
      models: cachedLiveModels.models,
      verifiedWithApi: true,
    };
  }

  const rawModels: Array<{
    name?: string;
    displayName?: string;
    description?: string;
    supportedActions?: string[];
  }> = [];

  try {
    const client = createGenAIClient(apiKey);
    const pager = await client.models.list({
      config: {
        pageSize: 100,
        abortSignal: AbortSignal.timeout(GEMINI_MODELS_TIMEOUT_MS),
      },
    });
    for await (const m of pager) {
      rawModels.push(m);
    }
  } catch (err) {
    const sdkErr = extractSdkApiError(err);
    if (sdkErr) {
      return {
        ok: false,
        models: GEMINI_BUILTIN_MODELS,
        verifiedWithApi: false,
        error: `Gemini API lỗi (${sdkErr.status}): ${sdkErr.message}`,
      };
    }
    return {
      ok: false,
      models: GEMINI_BUILTIN_MODELS,
      verifiedWithApi: false,
      error: describeNetworkError('Gemini API', err, GEMINI_MODELS_TIMEOUT_MS).message,
    };
  }

  const builtinMap = new Map(GEMINI_BUILTIN_MODELS.map((m) => [m.id, m]));
  const apiModelsMap = new Map<string, GeminiModelOption>();

  for (const m of rawModels) {
    const rawName = (m.name || '').replace(/^models\//, '').trim();
    if (!rawName || !rawName.startsWith('gemini-')) continue;
    // Skip deprecated Gemini 1.5 / 2.0 / 2.5 models
    if (/^gemini-(?:1\.0|1\.5|2\.0|2\.5)(?:-|$)/i.test(rawName)) continue;
    const actions = m.supportedActions ?? [];
    if (actions.length > 0 && !actions.includes('generateContent')) continue;
    if (
      /(?:embedding|imagen|veo|tts|audio|live|aqa|vision|bisheng|robotics|computer-use|transcribe|banana|omni|decision)/i.test(
        rawName,
      )
    ) {
      continue;
    }

    const builtin = builtinMap.get(rawName);
    apiModelsMap.set(rawName, {
      id: rawName,
      name: builtin?.name || m.displayName || rawName,
      description: builtin?.description || m.description || 'Mô hình từ Google Gemini API',
      source: builtin ? 'builtin' : 'api',
    });
  }

  for (const builtin of GEMINI_BUILTIN_MODELS) {
    if (!apiModelsMap.has(builtin.id)) {
      apiModelsMap.set(builtin.id, builtin);
    }
  }

  const models =
    apiModelsMap.size > 0
      ? sortGeminiModels(Array.from(apiModelsMap.values()))
      : sortGeminiModels(GEMINI_BUILTIN_MODELS);

  if (apiModelsMap.size > 0) {
    cachedLiveModels = { keyHash, models, fetchedAt: Date.now() };
  }

  return {
    ok: true,
    models,
    verifiedWithApi: true,
  };
}

function isTemperatureDeprecatedModel(model: string): boolean {
  return /^gemini-(?:4-|3\.5-flash-lite)/i.test(model);
}

/**
 * Extracts output text from either Interactions API (`output_text` / `steps` / `outputs`)
 * or classic `generateContent` (`candidates[0].content.parts`).
 */
export function extractTextFromGeminiResponse(rawData: unknown): string {
  if (!rawData || typeof rawData !== 'object') return '';
  const data = rawData as {
    output_text?: string;
    steps?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    outputs?: Array<{ type?: string; text?: string }>;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>;
      };
    }>;
  };

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.steps) && data.steps.length > 0) {
    const textChunks: string[] = [];
    for (const step of data.steps) {
      if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
      for (const item of step.content) {
        if ((!item.type || item.type === 'text') && item.text) {
          textChunks.push(item.text);
        }
      }
    }
    if (textChunks.length > 0) return textChunks.join('\n').trim();
  }

  if (Array.isArray(data.outputs) && data.outputs.length > 0) {
    const textChunks = data.outputs
      .filter((o) => o && o.type !== 'thought' && typeof o.text === 'string')
      .map((o) => o.text || '');
    if (textChunks.length > 0) return textChunks.join('\n').trim();
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const nonThoughtParts = parts.filter((p) => !p.thought && p.text);
  return (nonThoughtParts.length > 0 ? nonThoughtParts : parts)
    .map((p) => p.text || '')
    .join('\n')
    .trim();
}

/**
 * Streamlined single-model caller:
 * - Calls `interactions.create` with a fast 15s timeout and `thinking_level: low/minimal`.
 * - Only falls back to `models.generateContent` if the model is not exposed on `/v1beta/interactions`.
 */
async function callGeminiModel(
  apiKey: string,
  model: string,
  fullPrompt: string,
  systemInstruction: string | undefined,
  temperature: number,
  timeoutMs = GEMINI_GENERATE_TIMEOUT_MS,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; message: string }> {
  const client = createGenAIClient(apiKey);
  const cleanSys = systemInstruction?.trim() || undefined;
  const includeTemp = !isTemperatureDeprecatedModel(model);

  if (!modelsRequiringLegacyGenerateContent.has(model)) {
    try {
      const generationConfig: Record<string, unknown> = {
        thinking_level: /^gemini-3\.5-flash-lite/i.test(model) ? 'minimal' : 'low',
        ...(includeTemp ? { temperature } : {}),
      };
      const interaction = await client.interactions.create(
        {
          model,
          input: fullPrompt,
          store: false,
          ...(cleanSys ? { system_instruction: cleanSys } : {}),
          generation_config: generationConfig,
        } as unknown as Parameters<typeof client.interactions.create>[0],
        { timeout_ms: timeoutMs },
      );
      return { ok: true, data: interaction };
    } catch (err) {
      if (isTimeoutError(err)) {
        return {
          ok: false,
          status: 408,
          message: `Mô hình ${model} phản hồi quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`,
        };
      }
      const sdkErr = extractSdkApiError(err);
      if (!sdkErr) {
        throw describeNetworkError('Gemini API', err, timeoutMs);
      }
      // Return immediately on auth, quota, timeout, or server overload so we don't double-call
      if ([401, 403, 408, 429, 500, 502, 503, 504].includes(sdkErr.status)) {
        return { ok: false, status: sdkErr.status, message: sdkErr.message };
      }
      // For 400/404 (e.g. legacy model not supported on /interactions), fall through once to generateContent
    }
  }

  try {
    const data = await client.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        abortSignal: AbortSignal.timeout(timeoutMs),
        responseMimeType: 'application/json',
        ...(includeTemp ? { temperature } : {}),
        ...(cleanSys ? { systemInstruction: cleanSys } : {}),
      },
    });
    modelsRequiringLegacyGenerateContent.add(model);
    return { ok: true, data };
  } catch (err) {
    if (isTimeoutError(err)) {
      return {
        ok: false,
        status: 408,
        message: `Mô hình ${model} phản hồi quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`,
      };
    }
    const sdkErr = extractSdkApiError(err);
    if (sdkErr) {
      return { ok: false, status: sdkErr.status, message: sdkErr.message };
    }
    throw describeNetworkError('Gemini API', err, timeoutMs);
  }
}

export async function generateGeminiExamples(
  settings: AppSettings,
  input: GeminiGenerateExamplesRequest,
): Promise<GeminiGenerateExamplesResponse> {
  const apiKey = resolveGeminiKey(input.apiKey || settings.gemini.apiKey);
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Gemini API Key. Hãy mở Cài đặt → AI Ví dụ (Gemini) để lưu API Key.',
    );
  }

  const word = (input.word || '').trim();
  if (!word) {
    throw new Error('Vui lòng nhập Từ vựng (Word) trước khi tạo câu ví dụ bằng AI.');
  }

  const lang: LanguageCode = isSupportedLanguage(input.lang)
    ? input.lang
    : settings.activeLanguage;
  const langDef = getLanguageDefinition(lang);
  const profile = settings.languageProfiles[lang] ?? settings;

  let model = (input.model || settings.gemini.model || DEFAULT_GEMINI_MODEL)
    .replace(/^models\//, '')
    .trim();
  const exampleCount = Math.min(
    Math.max(Number(input.exampleCount ?? settings.gemini.exampleCount ?? 4), 1),
    10,
  );
  const temperature = Math.min(
    Math.max(Number(input.temperature ?? settings.gemini.temperature ?? 0.7), 0),
    1.5,
  );

  const rawTemplate =
    (input.promptTemplate ?? profile.geminiPrompt ?? langDef.defaultGeminiPrompt).trim() ||
    langDef.defaultGeminiPrompt;

  const userPrompt = interpolateGeminiPrompt(rawTemplate, {
    word,
    pos: input.pos,
    definition: input.definition,
  });

  const boldInstruction = settings.gemini.boldTargetWord
    ? ` (in đậm từ "${word}" hoặc dạng chia của nó bằng thẻ <b>...</b>)`
    : '';

  const fullPrompt = [
    userPrompt,
    `\nChỉ trả về đúng ${exampleCount} cặp câu theo định dạng JSON thuần: {"examples":[{"target":"câu ví dụ bằng ${langDef.name}${boldInstruction}","vi":"bản dịch tiếng Việt"}]}`,
  ].join('\n');

  const triedModels: string[] = [model];
  let attempt = await callGeminiModel(
    apiKey,
    model,
    fullPrompt,
    settings.gemini.systemInstruction,
    temperature,
  );

  // Fast single-step fallback ONLY on 404 (deprecated model), 429 (model quota), or 503 (model overload).
  // Never fetch live models or chain multiple retries on network timeouts (408).
  if (!attempt.ok && [404, 429, 503].includes(attempt.status)) {
    const initialStatus = attempt.status;
    const recommendedMatch = attempt.message.match(/models\/(gemini-[a-z0-9.-]+)/i);
    const fallbackCandidate =
      recommendedMatch?.[1] && recommendedMatch[1] !== model
        ? recommendedMatch[1]
        : model !== DEFAULT_GEMINI_MODEL
          ? DEFAULT_GEMINI_MODEL
          : 'gemini-3.8-flash-lite';

    triedModels.push(fallbackCandidate);
    const retryAttempt = await callGeminiModel(
      apiKey,
      fallbackCandidate,
      fullPrompt,
      settings.gemini.systemInstruction,
      temperature,
    );

    if (retryAttempt.ok) {
      model = fallbackCandidate;
      attempt = retryAttempt;
      if (initialStatus === 404) {
        try {
          saveSettings({
            gemini: {
              ...settings.gemini,
              model: fallbackCandidate,
              apiKey: '',
            },
          });
        } catch {
          // ignore settings save failure
        }
      }
    }
  }

  if (!attempt.ok) {
    const triedNote =
      triedModels.length > 1 ? ` (Đã thử: ${triedModels.join(' → ')})` : '';
    throw new Error(`Gemini API lỗi (${attempt.status}): ${attempt.message}${triedNote}`);
  }

  const textOutput = extractTextFromGeminiResponse(attempt.data);
  const examples = parseGeminiExamplesJson(textOutput);
  if (examples.length === 0) {
    throw new Error(
      'Gemini không trả về danh sách câu ví dụ hợp lệ. Hãy thử lại hoặc kiểm tra câu lệnh prompt.',
    );
  }

  return {
    ok: true,
    lang,
    word,
    model,
    resolvedPrompt: userPrompt,
    examples,
  };
}
