import { Eye, EyeOff, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  DEFAULT_FIELD_VISIBILITY,
  getLanguageDefinition,
  SUPPORTED_LANGUAGES,
  type AppSettings,
  type CambridgeDictMode,
  type CustomFieldConfig,
  type FieldMapping,
  type LanguageCode,
  type LanguageDefinition,
  type LanguageProfile,
  type PosFormat,
  type ToggleableFieldKey,
} from '@ass/shared';

interface AnkiSettingsSectionProps {
  draft: AppSettings;
  editingLang: LanguageCode;
  editingLangDef: LanguageDefinition;
  editingProfile: LanguageProfile;
  decks: string[];
  models: string[];
  modelFields: string[];
  loadingAnkiMeta: boolean;
  onChangeEditingLang: (lang: LanguageCode) => void;
  onChangeAnkiConnectUrl: (url: string) => void;
  onUpdateEditingProfile: (updater: (curr: LanguageProfile) => LanguageProfile) => void;
  onModelChange: (modelName: string) => void;
  onLoadAnkiMeta: () => void;
  onAddCustomField: (ankiField?: string, label?: string) => void;
  onAutoImportUnmappedFields: () => void;
  onUpdateCustomField: (id: string, patch: Partial<CustomFieldConfig>) => void;
  onDeleteCustomField: (id: string) => void;
}

export function AnkiSettingsSection({
  draft,
  editingLang,
  editingLangDef,
  editingProfile,
  decks,
  models,
  modelFields,
  loadingAnkiMeta,
  onChangeEditingLang,
  onChangeAnkiConnectUrl,
  onUpdateEditingProfile,
  onModelChange,
  onLoadAnkiMeta,
  onAddCustomField,
  onAutoImportUnmappedFields,
  onUpdateCustomField,
  onDeleteCustomField,
}: AnkiSettingsSectionProps) {
  const effectiveVis = {
    ...DEFAULT_FIELD_VISIBILITY,
    ...(editingProfile.visibleFields ?? {}),
  };
  const langFields = editingLangDef.fields;
  const toggleableItems = langFields.filter((i) => i.toggleable);
  const visibleCount = toggleableItems.filter(
    (i) => effectiveVis[i.key as ToggleableFieldKey],
  ).length;

  const toggleFieldVisibility = (fieldKey: ToggleableFieldKey) => {
    onUpdateEditingProfile((p) => {
      const curr = {
        ...DEFAULT_FIELD_VISIBILITY,
        ...(p.visibleFields ?? {}),
      };
      return {
        ...p,
        visibleFields: {
          ...curr,
          [fieldKey]: !curr[fieldKey],
        },
      };
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            AnkiConnect &amp; Ánh xạ trường
          </h2>
          <p className="text-xs text-slate-500">
            Cần mở Anki Desktop và cài add-on AnkiConnect (
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">
              2055492159
            </code>
            ).
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadAnkiMeta}
          disabled={loadingAnkiMeta}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingAnkiMeta ? 'animate-spin' : ''}`} />
          Tải Deck &amp; Note Type
        </button>
      </div>

      {/* Language Profile Selector */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-2.5">
        <div>
          <span className="text-xs font-bold text-slate-800">Hồ sơ ngôn ngữ đang cấu hình</span>
          <p className="text-[11px] text-slate-500">
            Mỗi ngôn ngữ có Deck, Note Type, ánh xạ trường và hướng dẫn đọc riêng.
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-white p-1 shadow-2xs ring-1 ring-slate-200/80">
          {SUPPORTED_LANGUAGES.map((code) => {
            const def = getLanguageDefinition(code);
            const active = editingLang === code;
            const prof = draft.languageProfiles?.[code];
            const ready = Boolean(prof?.defaultDeck && prof?.defaultNoteType);
            return (
              <button
                key={code}
                type="button"
                onClick={() => onChangeEditingLang(code)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="font-mono text-[10px] opacity-85">{def.shortLabel}</span>
                {def.name}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    ready
                      ? active
                        ? 'bg-emerald-300'
                        : 'bg-emerald-500'
                      : active
                        ? 'bg-amber-300'
                        : 'bg-amber-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700">AnkiConnect URL</label>
          <input
            type="text"
            value={draft.ankiConnectUrl}
            onChange={(e) => onChangeAnkiConnectUrl(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Deck mặc định ({editingLangDef.shortLabel})
          </label>
          {decks.length > 0 ? (
            <select
              value={editingProfile.defaultDeck}
              onChange={(e) =>
                onUpdateEditingProfile((p) => ({ ...p, defaultDeck: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            >
              <option value="">-- Chọn Deck --</option>
              {decks.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder={editingLangDef.defaultDeckPlaceholder}
              value={editingProfile.defaultDeck}
              onChange={(e) =>
                onUpdateEditingProfile((p) => ({ ...p, defaultDeck: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Note Type mặc định ({editingLangDef.shortLabel})
          </label>
          {models.length > 0 ? (
            <select
              value={editingProfile.defaultNoteType}
              onChange={(e) => onModelChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            >
              <option value="">-- Chọn Note Type --</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="VD: Basic"
              value={editingProfile.defaultNoteType}
              onChange={(e) =>
                onUpdateEditingProfile((p) => ({ ...p, defaultNoteType: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            />
          )}
        </div>
      </div>

      {editingLang === 'en' && (
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700">
            Nguồn từ điển Cambridge (Tiếng Anh)
          </label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Chọn giữa từ điển Anh-Anh tiêu chuẩn hoặc bản rút gọn dễ hiểu cho người học.
          </p>
          <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
            {(
              [
                {
                  value: 'english',
                  title: 'English thông thường',
                  badge: '/dictionary/english/',
                  desc: 'Từ điển Cambridge đầy đủ, chi tiết các sắc thái nghĩa và ví dụ phong phú.',
                },
                {
                  value: 'learner-english',
                  title: "Learner's Dictionary",
                  badge: '/dictionary/learner-english/',
                  desc: 'Định nghĩa ngắn gọn, dùng từ vựng cơ bản dễ hiểu cho người học.',
                },
              ] as Array<{
                value: CambridgeDictMode;
                title: string;
                badge: string;
                desc: string;
              }>
            ).map((opt) => {
              const currentMode: CambridgeDictMode =
                editingProfile.cambridgeMode ?? draft.cambridgeMode ?? 'english';
              const active = currentMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    onUpdateEditingProfile((p) => ({ ...p, cambridgeMode: opt.value }))
                  }
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/12'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                        {opt.badge}
                      </code>
                    </div>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
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
      )}

      {editingLangDef.supportsPosFormat && (
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700">
            Định dạng Từ loại khi lưu vào Anki
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(
              [
                { value: 'full', label: 'Đầy đủ (noun, verb, adjective)' },
                { value: 'short', label: 'Viết tắt có dấu chấm (n., v., adj.)' },
                { value: 'abbr', label: 'Viết tắt ngắn (n, v, adj)' },
              ] as Array<{ value: PosFormat; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdateEditingProfile((p) => ({ ...p, posFormat: opt.value }))}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  editingProfile.posFormat === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Field mapping & default visibility grid */}
      <div className="mt-5 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold tracking-wide text-slate-600 uppercase">
              Ánh xạ trường &amp; Hiển thị mặc định ({editingLangDef.name})
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Bật/tắt các trường xuất hiện mặc định trong tab <strong>Tạo thẻ mới</strong>.
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
            Đang hiện {visibleCount}/{toggleableItems.length} trường tùy chọn
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {langFields.map(({ key, label, hint, toggleable }) => {
            const isShown = toggleable ? effectiveVis[key as ToggleableFieldKey] : true;
            return (
              <div
                key={key}
                className={`rounded-xl border p-3 transition ${
                  isShown
                    ? 'border-slate-200/80 bg-slate-50/50'
                    : 'border-dashed border-slate-200 bg-slate-50/25 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-slate-800">{label}</label>
                    {hint && <p className="mt-0.5 text-[10px] text-indigo-600/90">{hint}</p>}
                  </div>

                  {toggleable ? (
                    <button
                      type="button"
                      onClick={() => toggleFieldVisibility(key as ToggleableFieldKey)}
                      title={
                        isShown
                          ? 'Đang hiển thị khi tạo thẻ mới — bấm để ẩn'
                          : 'Đang ẩn mặc định — bấm để bật hiển thị khi tạo thẻ mới'
                      }
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                        isShown
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-700'
                      }`}
                    >
                      {isShown ? (
                        <>
                          <Eye className="h-3 w-3" />
                          Đang hiện
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Đang ẩn
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                      Luôn hiện
                    </span>
                  )}
                </div>

                {modelFields.length > 0 ? (
                  <select
                    disabled={!isShown}
                    value={isShown ? editingProfile.fieldMapping[key as keyof FieldMapping] : ''}
                    title={
                      isShown ? undefined : 'Bật hiển thị trường này để ánh xạ sang Anki'
                    }
                    onChange={(e) =>
                      onUpdateEditingProfile((p) => ({
                        ...p,
                        fieldMapping: {
                          ...p.fieldMapping,
                          [key]: e.target.value,
                        },
                      }))
                    }
                    className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:border-indigo-500 focus:outline-none ${
                      isShown
                        ? 'border-slate-200 bg-white text-slate-800'
                        : 'cursor-not-allowed border-slate-200/70 bg-slate-100/90 text-slate-400'
                    }`}
                  >
                    <option value="">
                      {isShown
                        ? '-- Không ghi trường này --'
                        : '-- Đang ẩn · Đã khóa ánh xạ --'}
                    </option>
                    {modelFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled={!isShown}
                    value={isShown ? editingProfile.fieldMapping[key as keyof FieldMapping] : ''}
                    title={
                      isShown ? undefined : 'Bật hiển thị trường này để ánh xạ sang Anki'
                    }
                    onChange={(e) =>
                      onUpdateEditingProfile((p) => ({
                        ...p,
                        fieldMapping: {
                          ...p.fieldMapping,
                          [key]: e.target.value,
                        },
                      }))
                    }
                    placeholder={
                      isShown ? 'Tên trường trong Anki...' : 'Đang ẩn · Đã khóa ánh xạ'
                    }
                    className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none ${
                      isShown
                        ? 'border-slate-200 bg-white text-slate-800'
                        : 'cursor-not-allowed border-slate-200/70 bg-slate-100/90 text-slate-400 placeholder:text-slate-400'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Extra Anki Fields */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold tracking-wide text-slate-700 uppercase">
              Trường bổ sung (Custom Fields)
            </h3>
            <p className="text-[11px] text-slate-500">
              Thêm các trường phụ có trong Note Type Anki.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {modelFields.length > 0 && (
              <button
                type="button"
                onClick={onAutoImportUnmappedFields}
                className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Tự thêm trường chưa map
              </button>
            )}
            <button
              type="button"
              onClick={() => onAddCustomField()}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm trường
            </button>
          </div>
        </div>

        {(editingProfile.customFields ?? []).length > 0 ? (
          <div className="mt-3 space-y-2.5">
            {(editingProfile.customFields ?? []).map((cf) => (
              <div
                key={cf.id}
                className="grid items-end gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Tên hiển thị trên App
                  </label>
                  <input
                    type="text"
                    value={cf.label}
                    onChange={(e) => onUpdateCustomField(cf.id, { label: e.target.value })}
                    placeholder="VD: Nghĩa Tiếng Việt"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Trường trong Anki
                  </label>
                  {modelFields.length > 0 ? (
                    <select
                      value={cf.ankiField}
                      onChange={(e) =>
                        onUpdateCustomField(cf.id, {
                          ankiField: e.target.value,
                          ...(cf.label === 'Trường mới' && e.target.value
                            ? { label: e.target.value }
                            : {}),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Chọn trường Anki --</option>
                      {modelFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={cf.ankiField}
                      onChange={(e) => onUpdateCustomField(cf.id, { ankiField: e.target.value })}
                      placeholder="Tên trường trong Anki..."
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3 pb-1.5 sm:col-span-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={cf.multiline}
                      onChange={(e) =>
                        onUpdateCustomField(cf.id, { multiline: e.target.checked })
                      }
                      className="rounded accent-indigo-600"
                    />
                    Nhiều dòng
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(cf.allowBold)}
                      onChange={(e) =>
                        onUpdateCustomField(cf.id, { allowBold: e.target.checked })
                      }
                      className="rounded accent-indigo-600"
                    />
                    In đậm
                  </label>
                </div>

                <div className="flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => onDeleteCustomField(cf.id)}
                    title="Xóa trường này"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">
            Chưa có trường bổ sung.
          </p>
        )}
      </div>
    </section>
  );
}
