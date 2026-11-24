import {
  Bot,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  getLanguageDefinition,
  interpolateGeminiPrompt,
  SUPPORTED_LANGUAGES,
  type AppSettings,
  type GeminiModelOption,
  type LanguageCode,
  type LanguageDefinition,
  type LanguageProfile,
} from '@ass/shared';

interface GeminiSettingsSectionProps {
  draft: AppSettings;
  editingLang: LanguageCode;
  editingLangDef: LanguageDefinition;
  editingProfile: LanguageProfile;
  apiKeyInput: string;
  showApiKey: boolean;
  editingApiKey: boolean;
  savingApiKey: boolean;
  geminiModels: GeminiModelOption[];
  loadingGeminiModels: boolean;
  geminiVerified: boolean;
  onChangeDraft: (next: AppSettings) => void;
  onChangeEditingLang: (lang: LanguageCode) => void;
  onUpdateEditingProfile: (updater: (curr: LanguageProfile) => LanguageProfile) => void;
  onChangeApiKeyInput: (val: string) => void;
  onToggleShowApiKey: () => void;
  onSetEditingApiKey: (editing: boolean) => void;
  onLoadGeminiModels: () => void;
  onSaveApiKeyNow: () => void;
  onDeleteApiKey: () => void;
}

const PROMPT_TOKENS: Array<{ token: string; label: string; desc: string }> = [
  { token: '{{word}}', label: '+ {{word}}', desc: 'Chèn trường Từ vựng đang nhập' },
  { token: '{{pos}}', label: '+ {{pos}}', desc: 'Chèn Từ loại (nếu có)' },
  { token: '{{definition}}', label: '+ {{definition}}', desc: 'Chèn Định nghĩa (nếu có)' },
];

export function GeminiSettingsSection({
  draft,
  editingLang,
  editingLangDef,
  editingProfile,
  apiKeyInput,
  showApiKey,
  editingApiKey,
  savingApiKey,
  geminiModels,
  loadingGeminiModels,
  geminiVerified,
  onChangeDraft,
  onChangeEditingLang,
  onUpdateEditingProfile,
  onChangeApiKeyInput,
  onToggleShowApiKey,
  onSetEditingApiKey,
  onLoadGeminiModels,
  onSaveApiKeyNow,
  onDeleteApiKey,
}: GeminiSettingsSectionProps) {
  const currentPrompt =
    editingProfile.geminiPrompt ?? editingLangDef.defaultGeminiPrompt;

  const insertPromptToken = (token: string) => {
    const base = currentPrompt.trim();
    const next = base ? `${base} ${token}` : token;
    onUpdateEditingProfile((p) => ({ ...p, geminiPrompt: next }));
  };

  const resetDefaultPrompt = () => {
    onUpdateEditingProfile((p) => ({
      ...p,
      geminiPrompt: editingLangDef.defaultGeminiPrompt,
    }));
  };

  const previewInterpolated = interpolateGeminiPrompt(currentPrompt, {
    word: editingLangDef.previewWord,
    pos: editingLang === 'ja' ? '動詞' : 'adjective',
    definition:
      editingLang === 'ja'
        ? '食物をかんで飲み込む'
        : 'able to recover quickly from difficult conditions',
  });

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            AI Tạo câu ví dụ (Google Gemini)
          </h2>
          <p className="text-xs text-slate-500">
            Cấu hình chuyên sâu cho API Key, mô hình mặc định, thông số sinh câu và mẫu câu lệnh
            (Prompt) theo từng ngôn ngữ.
          </p>
        </div>

        <button
          type="button"
          onClick={onLoadGeminiModels}
          disabled={loadingGeminiModels}
          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
        >
          {loadingGeminiModels ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
          Tải danh sách mô hình từ API
        </button>
      </div>

      {/* Encrypted Gemini API Key Vault */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">Gemini API Key</label>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-indigo-600 hover:underline"
          >
            Lấy API Key tại Google AI Studio ↗
          </a>
        </div>

        {draft.gemini.hasApiKey && !editingApiKey ? (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-emerald-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Đã lưu mã hóa an toàn:{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-emerald-800">
                  {draft.gemini.apiKeyMasked || 'AIza••••'}
                </code>
                {geminiVerified && (
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
                    Đã xác thực API
                  </span>
                )}
              </div>
              {draft.gemini.storagePath && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-emerald-700/80">
                  {draft.gemini.storagePath}\vault.enc
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSetEditingApiKey(true)}
                className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Đổi Key
              </button>
              <button
                type="button"
                disabled={savingApiKey}
                onClick={onDeleteApiKey}
                className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Xóa Key
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder="Dán Gemini API Key (AIzaSy...)"
                value={apiKeyInput}
                onChange={(e) => onChangeApiKeyInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pr-9 pl-3 font-mono text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
              />
              <button
                type="button"
                onClick={onToggleShowApiKey}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title={showApiKey ? 'Ẩn key' : 'Hiện key'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="button"
              disabled={savingApiKey || !apiKeyInput.trim()}
              onClick={onSaveApiKeyNow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingApiKey ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              Lưu Key
            </button>

            {draft.gemini.hasApiKey && (
              <button
                type="button"
                onClick={() => {
                  onSetEditingApiKey(false);
                  onChangeApiKeyInput('');
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
            )}
          </div>
        )}
      </div>

      {/* Model & Generation Parameters */}
      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700">
            Mô hình Gemini mặc định {geminiVerified ? '(Đã đồng bộ từ Google API)' : ''}
          </label>
          <select
            value={draft.gemini.model}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                gemini: { ...draft.gemini, model: e.target.value },
              })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
          >
            {!geminiModels.some((m) => m.id === draft.gemini.model) && draft.gemini.model && (
              <option value={draft.gemini.model}>{draft.gemini.model}</option>
            )}
            {geminiModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id}) — {m.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Số lượng cặp câu ví dụ mỗi lần tạo
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={draft.gemini.exampleCount}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                gemini: {
                  ...draft.gemini,
                  exampleCount: Math.min(Math.max(Number(e.target.value) || 4, 1), 10),
                },
              })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">
              Độ đa dạng / Sáng tạo (Temperature)
            </label>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-indigo-700">
              {draft.gemini.temperature.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.4}
            step={0.05}
            value={draft.gemini.temperature}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                gemini: { ...draft.gemini, temperature: Number(e.target.value) },
              })
            }
            className="mt-2.5 w-full accent-indigo-600"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={draft.gemini.boldTargetWord}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  gemini: { ...draft.gemini, boldTargetWord: e.target.checked },
                })
              }
              className="rounded accent-indigo-600"
            />
            Tự động in đậm từ vựng (<code className="font-mono">&lt;b&gt;...&lt;/b&gt;</code>) trong
            câu ví dụ được tạo
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700">
            Chỉ dẫn hệ thống (System Instruction)
          </label>
          <input
            type="text"
            value={draft.gemini.systemInstruction}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                gemini: { ...draft.gemini, systemInstruction: e.target.value },
              })
            }
            placeholder="Vai trò và phong cách chung cho Gemini..."
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
          />
        </div>
      </div>

      {/* Per-Language Custom Prompt Template Editor */}
      <div className="mt-5 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold tracking-wide text-slate-700 uppercase">
              Câu lệnh Prompt mặc định theo ngôn ngữ ({editingLangDef.shortLabel} ⇄ VI)
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Sử dụng tham số <code className="rounded bg-slate-100 px-1 font-mono">{'{{word}}'}</code>{' '}
              để truyền tự động giá trị trường Từ vựng vào câu lệnh.
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {SUPPORTED_LANGUAGES.map((code) => {
              const def = getLanguageDefinition(code);
              const active = editingLang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onChangeEditingLang(code)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    active
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="font-mono text-[10px]">{def.shortLabel}</span>
                  <span>{def.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parameter Insertion Chips + Reset */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Chèn tham số:</span>
            {PROMPT_TOKENS.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => insertPromptToken(t.token)}
                title={t.desc}
                className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1 font-mono text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetDefaultPrompt}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" />
            Khôi phục mặc định
          </button>
        </div>

        <textarea
          rows={4}
          value={currentPrompt}
          onChange={(e) =>
            onUpdateEditingProfile((p) => ({ ...p, geminiPrompt: e.target.value }))
          }
          placeholder={`Nhập prompt tạo câu ví dụ cho ${editingLangDef.name}, dùng {{word}} làm tham số từ vựng...`}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-900 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
        />

        {/* Live Interpolated Preview */}
        <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            Xem trước câu lệnh gửi tới Gemini (với từ mẫu &ldquo;{editingLangDef.previewWord}&rdquo;):
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
            {previewInterpolated}
          </p>
        </div>
      </div>
    </section>
  );
}
