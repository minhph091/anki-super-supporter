import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Chrome,
  FolderSearch,
  Layers,
  Loader2,
  Save,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  createDefaultLanguageProfile,
  DEFAULT_FIELD_VISIBILITY,
  DEFAULT_GEMINI_MODEL,
  GEMINI_BUILTIN_MODELS,
  getLanguageDefinition,
  OPENAI_BUILTIN_VOICES,
  SUPPORTED_LANGUAGES,
  type AppSettings,
  type CustomFieldConfig,
  type DownloadsScanResponse,
  type FieldMapping,
  type GeminiModelOption,
  type LanguageCode,
  type LanguageProfile,
  type OpenAIVoiceOption,
  type ToggleableFieldKey,
} from '@ass/shared';
import { api } from '../lib/api';
import { AnkiSettingsSection } from './settings/AnkiSettingsSection';
import { GeminiSettingsSection } from './settings/GeminiSettingsSection';
import { WordAudioSettingsSection } from './settings/WordAudioSettingsSection';
import { DownloadsSettingsSection } from './settings/DownloadsSettingsSection';
import { ExtensionSettingsSection } from './settings/ExtensionSettingsSection';

export type SettingsSection = 'anki' | 'gemini' | 'openai' | 'downloads' | 'extension';

interface SettingsViewProps {
  settings: AppSettings;
  initialSection?: SettingsSection;
  onSettingsSaved: (next: AppSettings) => void;
  onAnkiStatusRefresh: () => void;
}

function serializeNonSecret(s: AppSettings): string {
  return JSON.stringify({
    activeLanguage: s.activeLanguage,
    languageProfiles: s.languageProfiles,
    ankiConnectUrl: s.ankiConnectUrl,
    cambridgeMode: s.cambridgeMode,
    autoClipboardImage: s.autoClipboardImage,
    wordAudioSource: s.wordAudioSource,
    wordAudioDownloads: s.wordAudioDownloads,
    openai: {
      model: s.openai.model,
      voice: s.openai.voice,
      speed: s.openai.speed,
      instructions: s.openai.instructions,
    },
    gemini: {
      model: s.gemini?.model,
      temperature: s.gemini?.temperature,
      exampleCount: s.gemini?.exampleCount,
      boldTargetWord: s.gemini?.boldTargetWord,
      systemInstruction: s.gemini?.systemInstruction,
    },
    elevenlabsDownloads: s.elevenlabsDownloads,
  });
}

export function SettingsView({
  settings,
  initialSection = 'anki',
  onSettingsSaved,
  onAnkiStatusRefresh,
}: SettingsViewProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [editingLang, setEditingLang] = useState<LanguageCode>(settings.activeLanguage || 'en');
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decks, setDecks] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelFields, setModelFields] = useState<string[]>([]);
  const [loadingAnkiMeta, setLoadingAnkiMeta] = useState(false);

  const [scanCheck, setScanCheck] = useState<DownloadsScanResponse | null>(null);
  const [checkingFolder, setCheckingFolder] = useState(false);
  const [wordScanCheck, setWordScanCheck] = useState<DownloadsScanResponse | null>(null);
  const [checkingWordFolder, setCheckingWordFolder] = useState(false);

  // OpenAI API Key Vault state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);

  const [openaiModels, setOpenaiModels] = useState<string[]>([
    'gpt-4o-mini-tts',
    'tts-1-hd',
    'tts-1',
  ]);
  const [openaiVoices, setOpenaiVoices] = useState<OpenAIVoiceOption[]>(OPENAI_BUILTIN_VOICES);
  const [loadingOpenAIOptions, setLoadingOpenAIOptions] = useState(false);
  const [openaiVerified, setOpenaiVerified] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Gemini API Key Vault & Models state
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [editingGeminiKey, setEditingGeminiKey] = useState(false);
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);
  const [geminiModels, setGeminiModels] = useState<GeminiModelOption[]>(GEMINI_BUILTIN_MODELS);
  const [loadingGeminiModels, setLoadingGeminiModels] = useState(false);
  const [geminiVerified, setGeminiVerified] = useState(false);

  const lastSavedJsonRef = useRef<string>('');
  const autoSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const editingLangDef = getLanguageDefinition(editingLang);
  const editingProfile: LanguageProfile =
    draft.languageProfiles?.[editingLang] ?? createDefaultLanguageProfile(editingLang);

  const updateEditingProfile = (updater: (curr: LanguageProfile) => LanguageProfile) => {
    setDraft((prev) => {
      const currProfile =
        prev.languageProfiles?.[editingLang] ?? createDefaultLanguageProfile(editingLang);
      const nextProfile = updater(currProfile);
      const nextProfiles = {} as Record<LanguageCode, LanguageProfile>;
      for (const code of SUPPORTED_LANGUAGES) {
        nextProfiles[code] =
          code === editingLang
            ? nextProfile
            : (prev.languageProfiles?.[code] ?? createDefaultLanguageProfile(code));
      }
      const isEditingActive = editingLang === (prev.activeLanguage || 'en');
      return {
        ...prev,
        languageProfiles: nextProfiles,
        ...(editingLang === 'en' && nextProfile.cambridgeMode
          ? { cambridgeMode: nextProfile.cambridgeMode }
          : {}),
        ...(isEditingActive
          ? {
              defaultDeck: nextProfile.defaultDeck,
              defaultNoteType: nextProfile.defaultNoteType,
              posFormat: nextProfile.posFormat,
              fieldMapping: nextProfile.fieldMapping,
              visibleFields: nextProfile.visibleFields,
              customFields: nextProfile.customFields,
              openai: {
                ...prev.openai,
                instructions: nextProfile.ttsInstructions,
              },
            }
          : {}),
      };
    });
  };

  useEffect(() => {
    lastSavedJsonRef.current = serializeNonSecret(settings);
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const nt = draft.languageProfiles?.[editingLang]?.defaultNoteType ?? '';
    if (!nt) {
      setModelFields([]);
      return;
    }
    api
      .getAnkiModelFields(nt)
      .then((res) => setModelFields(res.fields))
      .catch(() => setModelFields([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLang]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (settings.openai.hasApiKey) {
      void handleLoadOpenAIOptions(undefined, settings.openai.model, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.openai.hasApiKey]);

  useEffect(() => {
    if (settings.gemini?.hasApiKey) {
      void handleLoadGeminiModels(undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.gemini?.hasApiKey]);

  useEffect(() => {
    const currentJson = serializeNonSecret(draft);
    if (!lastSavedJsonRef.current || currentJson === lastSavedJsonRef.current) {
      return;
    }
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    setAutoSaveState('saving');
    autoSaveTimerRef.current = window.setTimeout(() => {
      const payloadToSave: Partial<AppSettings> = {
        ...draft,
        openai: { ...draft.openai, apiKey: '' },
        gemini: { ...draft.gemini, apiKey: '' },
      };
      api
        .saveSettings(payloadToSave)
        .then((updated) => {
          lastSavedJsonRef.current = serializeNonSecret(updated);
          onSettingsSaved(updated);
          setAutoSaveState('saved');
          window.setTimeout(() => setAutoSaveState('idle'), 2000);
        })
        .catch(() => {
          setAutoSaveState('idle');
        });
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const loadAnkiMeta = async () => {
    setLoadingAnkiMeta(true);
    setError(null);
    try {
      const meta = await api.getAnkiMeta();
      setDecks(meta.decks);
      setModels(meta.models);
      if (editingProfile.defaultNoteType) {
        const res = await api.getAnkiModelFields(editingProfile.defaultNoteType);
        setModelFields(res.fields);
      }
      onAnkiStatusRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu Anki.');
    } finally {
      setLoadingAnkiMeta(false);
    }
  };

  useEffect(() => {
    void loadAnkiMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModelChange = async (modelName: string) => {
    updateEditingProfile((p) => ({ ...p, defaultNoteType: modelName }));
    if (!modelName) {
      setModelFields([]);
      return;
    }
    try {
      const res = await api.getAnkiModelFields(modelName);
      setModelFields(res.fields);
    } catch {
      setModelFields([]);
    }
  };

  const handleCheckDownloadsFolder = async () => {
    setCheckingFolder(true);
    setError(null);
    try {
      const res = await api.listDownloadedAudio({
        dir: draft.elevenlabsDownloads.downloadsDir,
        filter: draft.elevenlabsDownloads.filterMode,
        maxFiles: draft.elevenlabsDownloads.maxFiles,
      });
      setScanCheck(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không quét được thư mục Downloads.');
    } finally {
      setCheckingFolder(false);
    }
  };

  const handleCheckWordDownloadsFolder = async () => {
    setCheckingWordFolder(true);
    setError(null);
    try {
      const res = await api.listWordDownloadedAudio({
        dir: draft.wordAudioDownloads.downloadsDir,
        filter: draft.wordAudioDownloads.filterMode,
        maxFiles: draft.wordAudioDownloads.maxFiles,
      });
      setWordScanCheck(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không quét được thư mục âm thanh từ vựng.');
    } finally {
      setCheckingWordFolder(false);
    }
  };

  const handleLoadOpenAIOptions = async (
    explicitKey?: string,
    modelForFilter?: string,
    silent = false,
  ) => {
    setLoadingOpenAIOptions(true);
    if (!silent) setError(null);
    try {
      const res = await api.fetchOpenAITtsOptions({
        apiKey: explicitKey,
        model: modelForFilter ?? draft.openai.model,
      });
      if (res.models.length > 0) setOpenaiModels(res.models);
      if (res.voices.length > 0) setOpenaiVoices(res.voices);
      setOpenaiVerified(res.verifiedWithApi);
      if (!res.ok && res.error && !silent) setError(res.error);
      if (explicitKey?.trim() && res.verifiedWithApi) {
        const refreshed = await api.getSettings();
        onSettingsSaved(refreshed);
        setApiKeyInput('');
        setEditingApiKey(false);
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách giọng từ OpenAI.');
      }
    } finally {
      setLoadingOpenAIOptions(false);
    }
  };

  const handleSaveApiKeyNow = async () => {
    const clean = apiKeyInput.trim();
    if (!clean) {
      setError('Vui lòng nhập OpenAI API Key trước khi lưu.');
      return;
    }
    setSavingApiKey(true);
    setError(null);
    try {
      const updated = await api.saveOpenAIApiKey(clean);
      onSettingsSaved(updated);
      setApiKeyInput('');
      setEditingApiKey(false);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2500);
      await handleLoadOpenAIOptions(undefined, updated.openai.model, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu OpenAI API Key thất bại.');
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    setSavingApiKey(true);
    setError(null);
    try {
      const updated = await api.deleteOpenAIApiKey();
      onSettingsSaved(updated);
      setOpenaiVerified(false);
      setEditingApiKey(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được API Key.');
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleLoadGeminiModels = async (explicitKey?: string, silent = false) => {
    setLoadingGeminiModels(true);
    if (!silent) setError(null);
    try {
      const res = await api.fetchGeminiModels({ apiKey: explicitKey });
      if (res.models.length > 0) setGeminiModels(res.models);
      setGeminiVerified(res.verifiedWithApi);
      if (!res.ok && res.error && !silent) setError(res.error);
      if (explicitKey?.trim() && res.verifiedWithApi) {
        const refreshed = await api.getSettings();
        onSettingsSaved(refreshed);
        setGeminiKeyInput('');
        setEditingGeminiKey(false);
      }
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error ? err.message : 'Không tải được danh sách mô hình từ Google Gemini.',
        );
      }
    } finally {
      setLoadingGeminiModels(false);
    }
  };

  const handleSaveGeminiKeyNow = async () => {
    const clean = geminiKeyInput.trim();
    if (!clean) {
      setError('Vui lòng nhập Gemini API Key trước khi lưu.');
      return;
    }
    setSavingGeminiKey(true);
    setError(null);
    try {
      const updated = await api.saveGeminiApiKey(clean);
      onSettingsSaved(updated);
      setGeminiKeyInput('');
      setEditingGeminiKey(false);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2500);
      await handleLoadGeminiModels(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu Gemini API Key thất bại.');
    } finally {
      setSavingGeminiKey(false);
    }
  };

  const handleDeleteGeminiKey = async () => {
    setSavingGeminiKey(true);
    setError(null);
    try {
      const updated = await api.deleteGeminiApiKey();
      onSettingsSaved(updated);
      setGeminiVerified(false);
      setEditingGeminiKey(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được Gemini API Key.');
    } finally {
      setSavingGeminiKey(false);
    }
  };

  const handlePreviewVoice = async () => {
    setPreviewingVoice(true);
    setError(null);
    try {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      const blobUrl = await api.previewOpenAIVoice({
        voice: draft.openai.voice,
        model: draft.openai.model,
        speed: draft.openai.speed,
        instructions: editingProfile.ttsInstructions || draft.openai.instructions,
        text: editingLangDef.previewWord,
        apiKey: apiKeyInput.trim() || undefined,
      });
      const audio = new Audio(blobUrl);
      previewAudioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(blobUrl);
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không phát được mẫu giọng đọc.');
    } finally {
      setPreviewingVoice(false);
    }
  };

  const handleAddCustomField = (ankiField = '', label = '') => {
    const newField: CustomFieldConfig = {
      id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: label || ankiField || 'Trường mới',
      ankiField,
      multiline: false,
      allowBold: false,
    };
    updateEditingProfile((p) => ({
      ...p,
      customFields: [...(p.customFields ?? []), newField],
    }));
  };

  const handleAutoImportUnmappedFields = () => {
    if (modelFields.length === 0) return;
    const effectiveVis = {
      ...DEFAULT_FIELD_VISIBILITY,
      ...(editingProfile.visibleFields ?? {}),
    };
    const allowedKeys = new Set(editingLangDef.fields.map((f) => f.key));
    const mappedCore = new Set(
      (Object.entries(editingProfile.fieldMapping) as Array<[keyof FieldMapping, string]>)
        .filter(
          ([k]) => allowedKeys.has(k) && (k === 'word' || effectiveVis[k as ToggleableFieldKey]),
        )
        .map(([, v]) => v.trim())
        .filter(Boolean),
    );
    const mappedCustom = new Set(
      (editingProfile.customFields ?? []).map((cf) => cf.ankiField.trim()).filter(Boolean),
    );
    const missing = modelFields.filter((f) => !mappedCore.has(f) && !mappedCustom.has(f));
    if (missing.length === 0) return;

    const additions: CustomFieldConfig[] = missing.map((f, idx) => ({
      id: `cf_${Date.now()}_${idx}`,
      label: f,
      ankiField: f,
      multiline: /note|meaning|collocation|synonym|example|ghi/i.test(f),
      allowBold: /example|meaning|note|collocation/i.test(f),
    }));
    updateEditingProfile((p) => ({
      ...p,
      customFields: [...(p.customFields ?? []), ...additions],
    }));
  };

  const handleUpdateCustomField = (id: string, patch: Partial<CustomFieldConfig>) => {
    updateEditingProfile((p) => ({
      ...p,
      customFields: (p.customFields ?? []).map((cf) => (cf.id === id ? { ...cf, ...patch } : cf)),
    }));
  };

  const handleDeleteCustomField = (id: string) => {
    updateEditingProfile((p) => ({
      ...p,
      customFields: (p.customFields ?? []).filter((cf) => cf.id !== id),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payloadToSave: Partial<AppSettings> = {
        ...draft,
        openai: { ...draft.openai, apiKey: apiKeyInput.trim() },
        gemini: { ...draft.gemini, apiKey: geminiKeyInput.trim() },
      };
      const updated = await api.saveSettings(payloadToSave);
      lastSavedJsonRef.current = serializeNonSecret(updated);
      onSettingsSaved(updated);
      if (apiKeyInput.trim()) {
        setApiKeyInput('');
        setEditingApiKey(false);
      }
      if (geminiKeyInput.trim()) {
        setGeminiKeyInput('');
        setEditingGeminiKey(false);
      }
      onAnkiStatusRefresh();
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu cài đặt thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const ankiConfigured = Boolean(editingProfile.defaultDeck && editingProfile.defaultNoteType);
  const geminiConfigured = Boolean(draft.gemini?.hasApiKey);
  const wordAudioConfigured =
    draft.wordAudioSource === 'folder_scan'
      ? Boolean(draft.wordAudioDownloads.downloadsDir.trim())
      : Boolean(draft.openai.hasApiKey);

  const navItems: Array<{
    id: SettingsSection;
    label: string;
    desc: string;
    icon: React.ReactNode;
    ready?: boolean;
  }> = [
    {
      id: 'anki',
      label: 'Anki & Trường dữ liệu',
      desc: 'Deck, Note Type, Mapping',
      icon: <Layers className="h-4 w-4" />,
      ready: ankiConfigured,
    },
    {
      id: 'gemini',
      label: 'AI Ví dụ (Gemini)',
      desc: `Prompt & ${draft.gemini?.model || DEFAULT_GEMINI_MODEL}`,
      icon: <Sparkles className="h-4 w-4" />,
      ready: geminiConfigured,
    },
    {
      id: 'openai',
      label: 'Âm thanh Từ vựng',
      desc:
        draft.wordAudioSource === 'folder_scan'
          ? 'Quét file từ thư mục'
          : `OpenAI · ${draft.openai.voice || 'alloy'}`,
      icon: <Volume2 className="h-4 w-4" />,
      ready: wordAudioConfigured,
    },
    {
      id: 'downloads',
      label: 'ElevenLabs Downloads',
      desc: 'Quét thư mục Downloads',
      icon: <FolderSearch className="h-4 w-4" />,
      ready: true,
    },
    {
      id: 'extension',
      label: 'Extension & Phím tắt',
      desc: 'Cài đặt & Phím tắt',
      icon: <Chrome className="h-4 w-4" />,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-12">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Cài đặt hệ thống</h1>
          <p className="text-xs text-slate-500">Tự động lưu khi thay đổi.</p>
        </div>

        <div className="flex items-center gap-2.5">
          {autoSaveState === 'saving' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              Đang tự lưu...
            </span>
          )}
          {autoSaveState === 'saved' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đã tự lưu
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : savedNotice ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {savedNotice ? 'Đã lưu!' : 'Lưu ngay'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-12">
        <aside className="md:col-span-3">
          <nav className="flex gap-1.5 overflow-x-auto md:sticky md:top-20 md:flex-col">
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex shrink-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? 'border-indigo-200 bg-white text-indigo-700 shadow-xs'
                      : 'border-transparent bg-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <div
                    className={`mt-0.5 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold">{item.label}</span>
                      {item.ready !== undefined && (
                        <span
                          title={item.ready ? 'Đã cấu hình' : 'Chưa cấu hình đầy đủ'}
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            item.ready ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        />
                      )}
                    </div>
                    <p className="mt-0.5 hidden truncate text-[11px] text-slate-400 md:block">
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="md:col-span-9">
          {section === 'anki' && (
            <AnkiSettingsSection
              draft={draft}
              editingLang={editingLang}
              editingLangDef={editingLangDef}
              editingProfile={editingProfile}
              decks={decks}
              models={models}
              modelFields={modelFields}
              loadingAnkiMeta={loadingAnkiMeta}
              onChangeEditingLang={setEditingLang}
              onChangeAnkiConnectUrl={(url) => setDraft({ ...draft, ankiConnectUrl: url })}
              onUpdateEditingProfile={updateEditingProfile}
              onModelChange={(m) => void handleModelChange(m)}
              onLoadAnkiMeta={() => void loadAnkiMeta()}
              onAddCustomField={handleAddCustomField}
              onAutoImportUnmappedFields={handleAutoImportUnmappedFields}
              onUpdateCustomField={handleUpdateCustomField}
              onDeleteCustomField={handleDeleteCustomField}
            />
          )}

          {section === 'gemini' && (
            <GeminiSettingsSection
              draft={draft}
              editingLang={editingLang}
              editingLangDef={editingLangDef}
              editingProfile={editingProfile}
              apiKeyInput={geminiKeyInput}
              showApiKey={showGeminiKey}
              editingApiKey={editingGeminiKey}
              savingApiKey={savingGeminiKey}
              geminiModels={geminiModels}
              loadingGeminiModels={loadingGeminiModels}
              geminiVerified={geminiVerified}
              onChangeDraft={setDraft}
              onChangeEditingLang={setEditingLang}
              onUpdateEditingProfile={updateEditingProfile}
              onChangeApiKeyInput={setGeminiKeyInput}
              onToggleShowApiKey={() => setShowGeminiKey((v) => !v)}
              onSetEditingApiKey={setEditingGeminiKey}
              onLoadGeminiModels={() => void handleLoadGeminiModels(geminiKeyInput.trim() || undefined)}
              onSaveApiKeyNow={() => void handleSaveGeminiKeyNow()}
              onDeleteApiKey={() => void handleDeleteGeminiKey()}
            />
          )}

          {section === 'openai' && (
            <WordAudioSettingsSection
              draft={draft}
              editingLang={editingLang}
              editingLangDef={editingLangDef}
              editingProfile={editingProfile}
              apiKeyInput={apiKeyInput}
              showApiKey={showApiKey}
              editingApiKey={editingApiKey}
              savingApiKey={savingApiKey}
              openaiModels={openaiModels}
              openaiVoices={openaiVoices}
              loadingOpenAIOptions={loadingOpenAIOptions}
              openaiVerified={openaiVerified}
              previewingVoice={previewingVoice}
              wordScanCheck={wordScanCheck}
              checkingWordFolder={checkingWordFolder}
              onChangeDraft={setDraft}
              onChangeEditingLang={setEditingLang}
              onUpdateEditingProfile={updateEditingProfile}
              onChangeApiKeyInput={setApiKeyInput}
              onToggleShowApiKey={() => setShowApiKey((v) => !v)}
              onSetEditingApiKey={setEditingApiKey}
              onSetOpenaiVoices={setOpenaiVoices}
              onLoadOpenAIOptions={() => void handleLoadOpenAIOptions(apiKeyInput.trim() || undefined)}
              onSaveApiKeyNow={() => void handleSaveApiKeyNow()}
              onDeleteApiKey={() => void handleDeleteApiKey()}
              onPreviewVoice={() => void handlePreviewVoice()}
              onCheckWordDownloadsFolder={() => void handleCheckWordDownloadsFolder()}
            />
          )}

          {section === 'downloads' && (
            <DownloadsSettingsSection
              draft={draft}
              scanCheck={scanCheck}
              checkingFolder={checkingFolder}
              onChangeDraft={setDraft}
              onCheckDownloadsFolder={() => void handleCheckDownloadsFolder()}
            />
          )}

          {section === 'extension' && <ExtensionSettingsSection />}
        </div>
      </div>
    </div>
  );
}
