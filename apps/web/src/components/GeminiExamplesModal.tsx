import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_BUILTIN_MODELS,
  getLanguageDefinition,
  interpolateGeminiPrompt,
  type GeminiExamplePair,
  type GeminiModelOption,
  type LanguageCode,
} from '@ass/shared';
import { api } from '../lib/api';
import { renderBoldPreview } from './RichExampleInput';

interface GeminiExamplesModalProps {
  open: boolean;
  lang: LanguageCode;
  word: string;
  pos: string;
  definition: string;
  defaultModel: string;
  defaultPromptTemplate: string;
  exampleCount: number;
  hasApiKey: boolean;
  targetFieldLabel: string;
  viFieldLabel: string;
  onClose: () => void;
  onApplyExample: (pair: GeminiExamplePair, mode: 'replace_both' | 'replace_target' | 'append_both') => void;
  onSavePromptAndModelDefault: (model: string, promptTemplate: string) => Promise<void>;
  onOpenDeepSettings: () => void;
}

export function GeminiExamplesModal({
  open,
  lang,
  word,
  pos,
  definition,
  defaultModel,
  defaultPromptTemplate,
  exampleCount,
  hasApiKey,
  targetFieldLabel,
  viFieldLabel,
  onClose,
  onApplyExample,
  onSavePromptAndModelDefault,
  onOpenDeepSettings,
}: GeminiExamplesModalProps) {
  const langDef = getLanguageDefinition(lang);
  const [wordInput, setWordInput] = useState(word);
  const [model, setModel] = useState(defaultModel || DEFAULT_GEMINI_MODEL);
  const [models, setModels] = useState<GeminiModelOption[]>(GEMINI_BUILTIN_MODELS);
  const [promptTemplate, setPromptTemplate] = useState(
    defaultPromptTemplate || langDef.defaultGeminiPrompt,
  );
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savedDefaultsNotice, setSavedDefaultsNotice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [examples, setExamples] = useState<GeminiExamplePair[]>([]);
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string>('');

  // Sync props when modal opens or language/defaults change
  useEffect(() => {
    if (!open) return;
    setWordInput(word);
    setModel(defaultModel || DEFAULT_GEMINI_MODEL);
    setPromptTemplate(defaultPromptTemplate || langDef.defaultGeminiPrompt);
    setError(null);
    setFallbackNotice(null);
  }, [open, word, defaultModel, defaultPromptTemplate, langDef.defaultGeminiPrompt]);

  // Load available models silently if API key is configured
  useEffect(() => {
    if (!open || !hasApiKey) return;
    api
      .fetchGeminiModels()
      .then((res) => {
        if (res.models.length > 0) {
          setModels(res.models);
          setModel((curr) =>
            res.models.some((m) => m.id === curr) ? curr : res.models[0].id,
          );
        }
      })
      .catch(() => {});
  }, [open, hasApiKey]);

  const handleGenerate = async (explicitWord?: string, explicitModel?: string, explicitPrompt?: string) => {
    const targetWord = (explicitWord ?? wordInput).trim();
    if (!targetWord) {
      setError('Vui lòng nhập Từ vựng trước khi tạo câu ví dụ.');
      return;
    }

    const activeModel = explicitModel ?? model;
    const activePrompt = explicitPrompt ?? promptTemplate;

    setLoading(true);
    setError(null);
    setFallbackNotice(null);
    try {
      const res = await api.generateGeminiExamples({
        lang,
        word: targetWord,
        pos,
        definition,
        model: activeModel,
        promptTemplate: activePrompt,
        exampleCount,
      });
      setExamples(res.examples);
      if (res.model && res.model !== activeModel) {
        setModel(res.model);
        setFallbackNotice(
          `Model "${activeModel}" đang quá tải hoặc không khả dụng — hệ thống đã tự động chuyển sang "${res.model}".`,
        );
      }
      setLastGeneratedKey(`${lang}:${targetWord.toLowerCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi gọi Gemini API.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate when opening popup with a new word if API key is ready
  useEffect(() => {
    if (!open || !hasApiKey) return;
    const clean = word.trim();
    if (!clean) return;
    const key = `${lang}:${clean.toLowerCase()}`;
    if (key !== lastGeneratedKey || examples.length === 0) {
      void handleGenerate(clean, defaultModel || DEFAULT_GEMINI_MODEL, defaultPromptTemplate || langDef.defaultGeminiPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const isDirtyDefaults =
    model !== (defaultModel || DEFAULT_GEMINI_MODEL) ||
    promptTemplate.trim() !== (defaultPromptTemplate || langDef.defaultGeminiPrompt).trim();

  const handleSaveAsDefault = async () => {
    setSavingDefaults(true);
    try {
      await onSavePromptAndModelDefault(model, promptTemplate);
      setSavedDefaultsNotice(true);
      window.setTimeout(() => setSavedDefaultsNotice(false), 2000);
    } finally {
      setSavingDefaults(false);
    }
  };

  const resolvedPreview = interpolateGeminiPrompt(promptTemplate, {
    word: wordInput || langDef.previewWord,
    pos,
    definition,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-amber-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">
                  Tạo câu ví dụ bằng Gemini AI
                </h2>
                <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                  {langDef.shortLabel} ⇄ VI
                </span>
              </div>
              <p className="text-[11px] text-indigo-200">
                Chọn 1 cặp câu ví dụ ({langDef.name} – Tiếng Việt) để chèn nhanh vào thẻ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDeepSettings}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/22"
              title="Mở cài đặt chuyên sâu (API Key, Temperature, Số lượng câu, System Instruction)"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              Cài đặt chuyên sâu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-white/75 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Controls Bar: Word + Model + Collapsible Prompt Editor */}
        <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-3.5">
          {!hasApiKey && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Bạn chưa cấu hình Gemini API Key trong Cài đặt.</span>
              </div>
              <button
                type="button"
                onClick={onOpenDeepSettings}
                className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
              >
                Nhập Gemini API Key →
              </button>
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-12">
            {/* Target Vocabulary Word */}
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-600">
                Từ vựng (<code className="font-mono">{'{{word}}'}</code>)
              </label>
              <input
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder={`Nhập từ ${langDef.name}...`}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Model Selector */}
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600">
                Mô hình Gemini
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                {!models.some((m) => m.id === model) && model && (
                  <option value={model}>{model}</option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Button */}
            <div className="flex items-end sm:col-span-3">
              <button
                type="button"
                disabled={loading || !wordInput.trim() || !hasApiKey}
                onClick={() => void handleGenerate()}
                className="inline-flex h-[36px] w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : examples.length > 0 ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {loading ? 'Đang tạo...' : examples.length > 0 ? 'Tạo lại' : 'Tạo ví dụ'}
              </button>
            </div>
          </div>

          {/* Toggleable Prompt Editor inside Popup */}
          <div className="mt-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPromptExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Tùy chỉnh nhanh câu lệnh Prompt ({langDef.shortLabel})</span>
                {promptExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {(isDirtyDefaults || savedDefaultsNotice) && (
                <button
                  type="button"
                  disabled={savingDefaults}
                  onClick={() => void handleSaveAsDefault()}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  {savingDefaults ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : savedDefaultsNotice ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  {savedDefaultsNotice
                    ? 'Đã lưu làm mặc định!'
                    : 'Lưu Prompt & Model này làm mặc định'}
                </button>
              )}
            </div>

            {promptExpanded && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">Tham số:</span>
                    {[
                      ['{{word}}', '+ {{word}} (Từ vựng)'],
                      ['{{pos}}', '+ {{pos}} (Từ loại)'],
                      ['{{definition}}', '+ {{definition}} (Định nghĩa)'],
                    ].map(([token, label]) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() =>
                          setPromptTemplate((prev) =>
                            prev.trim() ? `${prev.trim()} ${token}` : token,
                          )
                        }
                        className="rounded-md border border-indigo-200 bg-indigo-50/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPromptTemplate(langDef.defaultGeminiPrompt)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Khôi phục mặc định
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs leading-relaxed text-slate-800 focus:border-indigo-500 focus:outline-none"
                />

                <p className="mt-1.5 truncate text-[11px] text-slate-500" title={resolvedPreview}>
                  <span className="font-semibold text-slate-600">Thực gửi:</span> {resolvedPreview}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Body: Generated Examples List */}
        <div className="flex-1 overflow-y-auto p-5">
          {fallbackNotice && (
            <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs font-medium text-indigo-800">
              ⚡ {fallbackNotice}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Gemini ({model}) đang tạo cặp câu ví dụ ({langDef.shortLabel} – VI)...
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Từ vựng: <strong className="text-slate-700">{wordInput}</strong>
              </p>
            </div>
          ) : examples.length > 0 ? (
            <div className="space-y-3">
              {examples.map((pair, idx) => (
                <div
                  key={pair.id}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 font-mono text-[11px] font-bold text-indigo-700">
                        {idx + 1}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                        {langDef.shortLabel} ⇄ VI
                      </span>
                      {pair.context && (
                        <span className="rounded-full bg-indigo-50/80 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                          {pair.context}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onApplyExample(pair, 'replace_target')}
                        title={`Chỉ điền câu ${langDef.name} vào trường ${targetFieldLabel}`}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                      >
                        Chỉ lấy {langDef.shortLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyExample(pair, 'append_both')}
                        title={`Nối thêm cặp câu này vào cuối ${targetFieldLabel} và ${viFieldLabel}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        <Plus className="h-3 w-3" />
                        Nối thêm
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyExample(pair, 'replace_both')}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs transition hover:bg-indigo-700"
                      >
                        <Check className="h-3 w-3" />
                        Chọn cặp ({langDef.shortLabel} + VI)
                      </button>
                    </div>
                  </div>

                  {/* Target Language Sentence (EN / JA) */}
                  <div
                    onClick={() => onApplyExample(pair, 'replace_both')}
                    className="mt-2.5 cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="w-7 shrink-0 font-mono text-[10px] font-bold text-indigo-600 uppercase">
                        {langDef.shortLabel}
                      </span>
                      <p className="text-sm leading-relaxed text-slate-900">
                        {renderBoldPreview(pair.target)}
                      </p>
                    </div>

                    {/* Vietnamese Translation */}
                    {pair.vi && (
                      <div className="flex items-baseline gap-2 border-t border-slate-100 pt-1.5">
                        <span className="w-7 shrink-0 font-mono text-[10px] font-bold text-emerald-600 uppercase">
                          VI
                        </span>
                        <p className="text-xs leading-relaxed text-slate-600">
                          {renderBoldPreview(pair.vi)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-9 w-9 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Chưa có câu ví dụ nào được tạo
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Nhập từ vựng và bấm <strong>Tạo ví dụ</strong> để Gemini sinh danh sách các cặp câu{' '}
                <strong>{langDef.shortLabel} – VI</strong> theo câu lệnh Prompt của bạn.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
