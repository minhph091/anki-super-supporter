import { Eye, EyeOff, FolderSearch, KeyRound, Loader2, Play, ShieldCheck, Volume2 } from 'lucide-react';
import {
  getLanguageDefinition,
  OPENAI_BUILTIN_VOICES,
  SUPPORTED_LANGUAGES,
  type AppSettings,
  type DownloadsFilterMode,
  type DownloadsScanResponse,
  type LanguageCode,
  type LanguageDefinition,
  type LanguageProfile,
  type OpenAIVoiceOption,
  type WordAudioSource,
} from '@ass/shared';

interface WordAudioSettingsSectionProps {
  draft: AppSettings;
  editingLang: LanguageCode;
  editingLangDef: LanguageDefinition;
  editingProfile: LanguageProfile;
  apiKeyInput: string;
  showApiKey: boolean;
  editingApiKey: boolean;
  savingApiKey: boolean;
  openaiModels: string[];
  openaiVoices: OpenAIVoiceOption[];
  loadingOpenAIOptions: boolean;
  openaiVerified: boolean;
  previewingVoice: boolean;
  wordScanCheck: DownloadsScanResponse | null;
  checkingWordFolder: boolean;
  onChangeDraft: (next: AppSettings) => void;
  onChangeEditingLang: (lang: LanguageCode) => void;
  onUpdateEditingProfile: (updater: (curr: LanguageProfile) => LanguageProfile) => void;
  onChangeApiKeyInput: (val: string) => void;
  onToggleShowApiKey: () => void;
  onSetEditingApiKey: (editing: boolean) => void;
  onSetOpenaiVoices: (updater: (prev: OpenAIVoiceOption[]) => OpenAIVoiceOption[]) => void;
  onLoadOpenAIOptions: () => void;
  onSaveApiKeyNow: () => void;
  onDeleteApiKey: () => void;
  onPreviewVoice: () => void;
  onCheckWordDownloadsFolder: () => void;
}

export function WordAudioSettingsSection({
  draft,
  editingLang,
  editingLangDef,
  editingProfile,
  apiKeyInput,
  showApiKey,
  editingApiKey,
  savingApiKey,
  openaiModels,
  openaiVoices,
  loadingOpenAIOptions,
  openaiVerified,
  previewingVoice,
  wordScanCheck,
  checkingWordFolder,
  onChangeDraft,
  onChangeEditingLang,
  onUpdateEditingProfile,
  onChangeApiKeyInput,
  onToggleShowApiKey,
  onSetEditingApiKey,
  onSetOpenaiVoices,
  onLoadOpenAIOptions,
  onSaveApiKeyNow,
  onDeleteApiKey,
  onPreviewVoice,
  onCheckWordDownloadsFolder,
}: WordAudioSettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Âm thanh Từ vựng</h2>
          <p className="text-xs text-slate-500">
            Tạo bằng OpenAI TTS hoặc quét file từ thư mục.
          </p>
        </div>
        {draft.wordAudioSource === 'openai_tts' ? (
          <button
            type="button"
            onClick={onLoadOpenAIOptions}
            disabled={loadingOpenAIOptions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
          >
            {loadingOpenAIOptions ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
            Tải model &amp; giọng từ API
          </button>
        ) : (
          <button
            type="button"
            onClick={onCheckWordDownloadsFolder}
            disabled={checkingWordFolder}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
          >
            {checkingWordFolder ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderSearch className="h-3.5 w-3.5" />
            )}
            Kiểm tra thư mục
          </button>
        )}
      </div>

      {/* Word Audio Source Switcher */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-slate-700">
          Nguồn âm thanh từ vựng
        </label>
        <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
          {(
            [
              {
                value: 'openai_tts',
                title: 'OpenAI TTS',
                desc: 'Tạo giọng đọc qua OpenAI API.',
              },
              {
                value: 'folder_scan',
                title: 'Quét từ thư mục',
                desc: 'Lấy file audio mới nhất từ thư mục trên máy.',
              },
            ] as Array<{ value: WordAudioSource; title: string; desc: string }>
          ).map((opt) => {
            const active = draft.wordAudioSource === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeDraft({ ...draft, wordAudioSource: opt.value })}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/12'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      active ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {draft.wordAudioSource === 'folder_scan' ? (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Đường dẫn thư mục âm thanh từ vựng
              </label>
              <input
                type="text"
                placeholder="VD: C:\Users\TenBan\Downloads"
                value={draft.wordAudioDownloads.downloadsDir}
                onChange={(e) =>
                  onChangeDraft({
                    ...draft,
                    wordAudioDownloads: {
                      ...draft.wordAudioDownloads,
                      downloadsDir: e.target.value,
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Bộ lọc file mặc định
              </label>
              <select
                value={draft.wordAudioDownloads.filterMode}
                onChange={(e) =>
                  onChangeDraft({
                    ...draft,
                    wordAudioDownloads: {
                      ...draft.wordAudioDownloads,
                      filterMode: e.target.value as DownloadsFilterMode,
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
              >
                <option value="all_audio">Tất cả file audio (.mp3, .wav, .m4a...)</option>
                <option value="elevenlabs_only">Chỉ file ElevenLabs</option>
                <option value="cambridge_audio">
                  Audio Cambridge (tự tải 2 file đầu · lưu tạm)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Số file mới nhất hiển thị tối đa
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={draft.wordAudioDownloads.maxFiles}
                onChange={(e) =>
                  onChangeDraft({
                    ...draft,
                    wordAudioDownloads: {
                      ...draft.wordAudioDownloads,
                      maxFiles: Number(e.target.value) || 15,
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.wordAudioDownloads.deleteSourceAfterSave}
                  onChange={(e) =>
                    onChangeDraft({
                      ...draft,
                      wordAudioDownloads: {
                        ...draft.wordAudioDownloads,
                        deleteSourceAfterSave: e.target.checked,
                      },
                    })
                  }
                  className="rounded accent-indigo-600"
                />
                Tự xóa file gốc sau khi lưu vào Anki
              </label>
            </div>
          </div>

          {wordScanCheck && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                wordScanCheck.error
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {wordScanCheck.error ? (
                <p>✗ {wordScanCheck.error}</p>
              ) : (
                <p>
                  ✓ Đọc thư mục <code className="font-mono">{wordScanCheck.dir}</code> thành công —
                  tìm thấy <strong>{wordScanCheck.files.length}</strong> file audio phù hợp.
                  {wordScanCheck.files[0] && (
                    <>
                      {' '}
                      Mới nhất:{' '}
                      <code className="font-mono">{wordScanCheck.files[0].filename}</code>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {/* Persistent API Key Vault */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">OpenAI API Key</label>

            {draft.openai.hasApiKey && !editingApiKey ? (
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-emerald-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Đã lưu an toàn:{' '}
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono text-emerald-800">
                      {draft.openai.apiKeyMasked || 'sk-••••'}
                    </code>
                    {openaiVerified && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
                        Đã xác thực API
                      </span>
                    )}
                  </div>
                  {draft.openai.storagePath && (
                    <p className="mt-0.5 truncate font-mono text-[10px] text-emerald-700/80">
                      {draft.openai.storagePath}\vault.enc
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
                    placeholder="Dán OpenAI API Key (sk-...)"
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

                {draft.openai.hasApiKey && (
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

          {/* Model dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Model TTS {openaiVerified ? '(Từ OpenAI API)' : ''}
            </label>
            <select
              value={draft.openai.model}
              onChange={(e) => {
                const nextModel = e.target.value;
                onChangeDraft({
                  ...draft,
                  openai: { ...draft.openai, model: nextModel },
                });
                const isLegacy = nextModel === 'tts-1' || nextModel === 'tts-1-hd';
                onSetOpenaiVoices((prev) => {
                  const custom = prev.filter((v) => v.source === 'custom');
                  const builtin = isLegacy
                    ? OPENAI_BUILTIN_VOICES.filter((v) => v.supportsLegacyTts)
                    : OPENAI_BUILTIN_VOICES;
                  return [...custom, ...builtin];
                });
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            >
              {Array.from(new Set([draft.openai.model, ...openaiModels])).map((m) => (
                <option key={m} value={m}>
                  {m === 'gpt-4o-mini-tts' ? 'gpt-4o-mini-tts (Khuyên dùng)' : m}
                </option>
              ))}
            </select>
          </div>

          {/* Voice dropdown + Preview */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Giọng đọc ({openaiVoices.length} giọng)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={draft.openai.voice}
                onChange={(e) =>
                  onChangeDraft({ ...draft, openai: { ...draft.openai, voice: e.target.value } })
                }
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
              >
                {!openaiVoices.some((v) => v.id === draft.openai.voice) && draft.openai.voice && (
                  <option value={draft.openai.voice}>{draft.openai.voice}</option>
                )}
                {openaiVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.id}) — {v.description}
                    {v.source === 'custom' ? ' [Custom]' : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={previewingVoice || (!draft.openai.hasApiKey && !apiKeyInput.trim())}
                onClick={onPreviewVoice}
                title={`Nghe thử giọng đọc đã chọn với từ mẫu '${editingLangDef.previewWord}'`}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
              >
                {previewingVoice ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Nghe thử
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Tốc độ đọc mặc định</label>
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-indigo-700">
                {draft.openai.speed}x
              </span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.2}
              step={0.05}
              value={draft.openai.speed}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  openai: { ...draft.openai, speed: Number(e.target.value) },
                })
              }
              className="mt-2.5 w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                Hướng dẫn đọc ({editingLangDef.name})
              </label>
              <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-[10px] font-semibold">
                {SUPPORTED_LANGUAGES.map((code) => {
                  const def = getLanguageDefinition(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onChangeEditingLang(code)}
                      className={`rounded px-1.5 py-0.5 transition ${
                        editingLang === code
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-500'
                      }`}
                    >
                      {def.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            <input
              type="text"
              value={editingProfile.ttsInstructions}
              onChange={(e) =>
                onUpdateEditingProfile((p) => ({ ...p, ttsInstructions: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            />
          </div>
        </div>
      )}
    </section>
  );
}
