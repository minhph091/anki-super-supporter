import {
  Keyboard,
  Layers,
  PlusCircle,
  Radio,
  Settings as SettingsIcon,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  getLanguageDefinition,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type LanguageDefinition,
} from '@ass/shared';

export type AppTab = 'create' | 'enrich' | 'settings';

interface StudioHeaderProps {
  tab: AppTab;
  activeLang: LanguageCode;
  activeLangDef: LanguageDefinition;
  wordAudioBadgeSummary: string;
  enrichCount: number;
  missingOpenAIKey: boolean;
  sseConnected: boolean;
  ankiStatus: { connected: boolean; version?: number };
  shortcutsOpen: boolean;
  onChangeTab: (tab: AppTab) => void;
  onSwitchLanguage: (lang: LanguageCode) => void;
  onRefreshAnkiStatus: () => void;
  onToggleShortcuts: () => void;
  onCloseShortcuts: () => void;
}

const STUDIO_SHORTCUTS: Array<[string, string]> = [
  ['Ctrl + Enter', 'Lưu thẻ / Cập nhật & Tiếp'],
  ['Ctrl + K', 'Focus nhanh ô Từ vựng'],
  ['Ctrl + B', 'In đậm chữ đang bôi đen'],
  ['Alt + ← / →', 'Thẻ trước / sau (Bổ sung)'],
  ['Alt + 1 / 2', 'Extension → Example EN / VI'],
];

export function StudioHeader({
  tab,
  activeLang,
  activeLangDef,
  wordAudioBadgeSummary,
  enrichCount,
  missingOpenAIKey,
  sseConnected,
  ankiStatus,
  shortcutsOpen,
  onChangeTab,
  onSwitchLanguage,
  onRefreshAnkiStatus,
  onToggleShortcuts,
  onCloseShortcuts,
}: StudioHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900">AnkiSuperSupporter</h1>
            <p className="text-[11px] text-slate-500">
              {activeLangDef.subtitle} · {wordAudioBadgeSummary} &amp; ElevenLabs
            </p>
          </div>
        </div>

        {/* Mode switcher + Language switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            title="Chuyển ngôn ngữ tra cứu & hồ sơ Anki"
            className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-50 p-1"
          >
            {SUPPORTED_LANGUAGES.map((code) => {
              const def = getLanguageDefinition(code);
              const active = activeLang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSwitchLanguage(code)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    active
                      ? def.accentTheme === 'rose'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <span>{def.shortLabel}</span>
                  <span className="hidden text-[11px] font-medium xl:inline">{def.nativeName}</span>
                </button>
              );
            })}
          </div>

          <nav className="flex items-center rounded-xl bg-slate-100/90 p-1">
            <button
              type="button"
              onClick={() => onChangeTab('create')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === 'create'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Tạo thẻ mới
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('enrich')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === 'enrich'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Bổ sung thẻ
              {enrichCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                  {enrichCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('settings')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === 'settings'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              Cài đặt
              {missingOpenAIKey && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </button>
          </nav>
        </div>

        {/* Status indicators + shortcuts */}
        <div className="relative flex items-center gap-2">
          <span
            title="Trạng thái kết nối nhận text trực tiếp từ Browser Extension (Grok / Gemini)"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              sseConnected
                ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            <Radio className={`h-3 w-3 ${sseConnected ? 'animate-pulse text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Extension</span>{' '}
            {sseConnected ? 'Sẵn sàng' : 'Đang nối'}
          </span>

          <button
            type="button"
            onClick={onRefreshAnkiStatus}
            title="Bấm để kiểm tra lại kết nối AnkiConnect"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              ankiStatus.connected
                ? 'border-indigo-200/80 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            {ankiStatus.connected ? (
              <>
                <Wifi className="h-3 w-3" />
                Anki v{ankiStatus.version}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Chưa nối Anki
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleShortcuts}
            title="Phím tắt nhanh"
            className={`rounded-lg border p-1.5 transition ${
              shortcutsOpen
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>

          {shortcutsOpen && (
            <div className="animate-toast-in absolute top-10 right-0 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Phím tắt Studio</span>
                <button
                  type="button"
                  onClick={onCloseShortcuts}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {STUDIO_SHORTCUTS.map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{label}</span>
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
