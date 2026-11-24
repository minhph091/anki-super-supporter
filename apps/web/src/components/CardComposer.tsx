import type { RefObject } from 'react';
import { Eraser, Loader2, Search, Sparkles } from 'lucide-react';
import {
  buildJapaneseFurigana,
  cleanTextForTts,
  getLanguageSecondaryUrl,
  stripIpaSlashes,
  type AudioTake,
  type CustomFieldConfig,
  type DictionaryLookupResponse,
  type DownloadedAudioFile,
  type DownloadsFilterMode,
  type FieldMapping,
  type LanguageCode,
  type LanguageDefinition,
  type LanguageFieldMeta,
  type TempImageMedia,
  type WordAudioSource,
} from '@ass/shared';
import type { CardDraftFields, InboxBadgeState } from '../hooks/useCardDraft';
import { AudioStudioCard } from './AudioStudioCard';
import { DownloadsAudioCard } from './DownloadsAudioCard';
import { ImageFieldCard } from './ImageFieldCard';
import { PosAutocompleteInput } from './PosAutocompleteInput';
import { RichExampleInput } from './RichExampleInput';

export interface CardFieldLabels {
  word: string;
  partOfSpeech: string;
  ipa: string;
  typeAnswer: string;
  pastForms: string;
  furigana: string;
  definition: string;
  exampleEn: string;
  exampleVi: string;
  image: string;
  wordAudio: string;
  exampleAudio: string;
}

export interface CardVisibilityFlags {
  pos: boolean;
  ipa: boolean;
  typeAnswer: boolean;
  pastForms: boolean;
  furigana: boolean;
  definition: boolean;
  exampleEn: boolean;
  exampleVi: boolean;
  image: boolean;
  wordAudio: boolean;
  exampleAudio: boolean;
}

interface DownloadsScannerSlot {
  dir: string;
  filter: DownloadsFilterMode;
  files: DownloadedAudioFile[];
  selectedFileId: string | null;
  loading: boolean;
  error: string | null;
  onChangeFilter: (mode: DownloadsFilterMode) => void;
  onRescan: () => void;
  onSelectFile: (id: string | null) => void;
  onDeleteFile: (id: string) => void;
}

interface CardComposerProps {
  activeLang: LanguageCode;
  activeLangDef: LanguageDefinition;
  fieldMetaMap: Map<keyof FieldMapping, LanguageFieldMeta>;
  fieldLabels: CardFieldLabels;
  visibility: CardVisibilityFlags;
  fields: CardDraftFields;
  customFields: CustomFieldConfig[];
  wordInputRef: RefObject<HTMLInputElement | null>;
  flashField: string | null;
  lastInboxBadge: InboxBadgeState | null;
  dictLoading: boolean;
  dictData: DictionaryLookupResponse | null;
  hasOxfordPastForms: boolean;
  formattedPosPreview: string;
  extractedTypeAnswer: string;
  cardImage: TempImageMedia | null;
  existingImage: string;
  imageUploading: boolean;
  wordAudioSource: WordAudioSource;
  activeVoiceLabel: string;
  existingWordAudio: string;
  existingExampleAudio: string;
  wordTakes: AudioTake[];
  selectedWordTakeId: string | null;
  wordAudioLoading: boolean;
  wordAudioError: string | null;
  wordModelOverride: string;
  wordSpeedOverride: number;
  wordDownloadsSlot: DownloadsScannerSlot;
  exampleDownloadsSlot: DownloadsScannerSlot;
  onChangeField: <K extends Exclude<keyof CardDraftFields, 'customValues'>>(
    key: K,
    value: CardDraftFields[K],
  ) => void;
  onChangeCustomValue: (id: string, value: string) => void;
  onLookup: () => void;
  onResetEditor: () => void;
  onSelectPos: (pos: string) => void;
  onGrabClipboardImage: () => void;
  onUploadImageDataUrl: (dataUrl: string, filename?: string) => void;
  onRemoveImage: () => void;
  onOpenSettings: () => void;
  onGenerateWordAudio: () => void;
  onSelectWordTake: (id: string | null) => void;
  onDeleteWordTake: (id: string) => void;
  onChangeWordModelOverride: (model: string) => void;
  onChangeWordSpeedOverride: (speed: number) => void;
  onOpenElevenLabsWithText: () => void;
  onOpenGeminiModal: () => void;
}

export function CardComposer({
  activeLang,
  activeLangDef,
  fieldMetaMap,
  fieldLabels,
  visibility,
  fields,
  customFields,
  wordInputRef,
  flashField,
  lastInboxBadge,
  dictLoading,
  dictData,
  hasOxfordPastForms,
  formattedPosPreview,
  extractedTypeAnswer,
  cardImage,
  existingImage,
  imageUploading,
  wordAudioSource,
  activeVoiceLabel,
  existingWordAudio,
  existingExampleAudio,
  wordTakes,
  selectedWordTakeId,
  wordAudioLoading,
  wordAudioError,
  wordModelOverride,
  wordSpeedOverride,
  wordDownloadsSlot,
  exampleDownloadsSlot,
  onChangeField,
  onChangeCustomValue,
  onLookup,
  onResetEditor,
  onSelectPos,
  onGrabClipboardImage,
  onUploadImageDataUrl,
  onRemoveImage,
  onOpenSettings,
  onGenerateWordAudio,
  onSelectWordTake,
  onDeleteWordTake,
  onChangeWordModelOverride,
  onChangeWordSpeedOverride,
  onOpenElevenLabsWithText,
  onOpenGeminiModal,
}: CardComposerProps) {
  const readingOptions = dictData?.readings ?? [];
  const section1ExtrasCount = Number(visibility.ipa) + Number(visibility.pos);

  return (
    <div className="space-y-4 lg:col-span-7">
      {/* SECTION 1: Word + Reading/IPA + POS */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">{fieldLabels.word}</label>
              {lastInboxBadge?.target === 'word' && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  Từ {lastInboxBadge.source}
                </span>
              )}
            </div>
            <input
              ref={wordInputRef}
              type="text"
              placeholder={fieldMetaMap.get('word')?.placeholder || 'Nhập từ vựng...'}
              value={fields.word}
              onChange={(e) => onChangeField('word', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onLookup();
                }
              }}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none ${
                flashField === 'word'
                  ? 'animate-inbox-flash border-indigo-400'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={onLookup}
            disabled={dictLoading || !fields.word.trim()}
            className="inline-flex h-[46px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-45"
          >
            {dictLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Tra từ điển
          </button>

          <button
            type="button"
            onClick={onResetEditor}
            title="Xóa trắng biểu mẫu (có thể Hoàn tác)"
            className="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>

        {section1ExtrasCount > 0 && (
          <div
            className={`mt-4 grid gap-4 border-t border-slate-100 pt-4 ${
              section1ExtrasCount > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
            }`}
          >
            {visibility.ipa && (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <label className="text-xs font-semibold text-slate-700">{fieldLabels.ipa}</label>
                  {dictData?.readingError && readingOptions.length === 0 && (
                    <a
                      href={
                        dictData.secondaryUrl || getLanguageSecondaryUrl(activeLang, fields.word)
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[10px] font-medium text-amber-600 hover:underline"
                      title={dictData.readingError}
                    >
                      {activeLangDef.readingErrorHint}
                    </a>
                  )}
                </div>

                <input
                  type="text"
                  placeholder={fieldMetaMap.get('ipa')?.placeholder || ''}
                  value={fields.ipa}
                  onChange={(e) =>
                    onChangeField(
                      'ipa',
                      activeLangDef.stripReadingSlashes
                        ? stripIpaSlashes(e.target.value)
                        : e.target.value,
                    )
                  }
                  className={`${activeLangDef.stripReadingSlashes ? 'font-ipa' : ''} w-full rounded-xl border px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none ${
                    flashField === 'ipa'
                      ? 'animate-inbox-flash border-indigo-400'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                />
              </div>
            )}

            {visibility.pos && (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    {fieldLabels.partOfSpeech}
                  </label>
                  {formattedPosPreview && (
                    <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                      {formattedPosPreview}
                    </code>
                  )}
                </div>

                {activeLangDef.supportsPosFormat ? (
                  <PosAutocompleteInput
                    value={fields.partOfSpeech}
                    prioritySuggestions={[
                      ...readingOptions.map((r) => r.pos),
                      ...(dictData?.entries.map((e) => e.pos) ?? []),
                    ].filter(Boolean)}
                    onChange={(v) => onChangeField('partOfSpeech', v)}
                    onAcceptSuggestion={onSelectPos}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={
                      fieldMetaMap.get('partOfSpeech')?.placeholder || '名詞, 動詞...'
                    }
                    value={fields.partOfSpeech}
                    onChange={(e) => onChangeField('partOfSpeech', e.target.value)}
                    className="w-full rounded-xl border border-slate-200/90 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 2: Definition + Examples + Image + Extra/Custom Fields */}
      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {visibility.definition && (
          <RichExampleInput
            label={fieldLabels.definition}
            placeholder={`Nhập ${fieldLabels.definition}...`}
            value={fields.definition}
            onChange={(v) => onChangeField('definition', v)}
            rows={3}
            highlighted={flashField === 'definition'}
          />
        )}

        {(visibility.exampleEn || visibility.exampleVi) && (
          <div
            className={`grid gap-3.5 ${
              visibility.exampleEn && visibility.exampleVi ? 'md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {visibility.exampleEn && (
              <RichExampleInput
                label={fieldLabels.exampleEn}
                placeholder={`Nhập ${fieldLabels.exampleEn}...`}
                value={fields.exampleEn}
                onChange={(v) => onChangeField('exampleEn', v)}
                highlighted={flashField === 'example_en'}
                badgeText={
                  lastInboxBadge?.target === 'example_en' ? `✓ ${lastInboxBadge.source}` : null
                }
                headerRight={
                  <button
                    type="button"
                    onClick={onOpenGeminiModal}
                    title={`Mở popup tạo cặp câu ví dụ (${activeLangDef.shortLabel} - VI) bằng Google Gemini AI`}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 shadow-2xs transition hover:border-indigo-300 hover:from-indigo-100 hover:to-violet-100"
                  >
                    <Sparkles className="h-3 w-3 text-indigo-600" />
                    Tạo ví dụ AI
                  </button>
                }
              />
            )}

            {visibility.exampleVi && (
              <RichExampleInput
                label={fieldLabels.exampleVi}
                placeholder={`Nhập ${fieldLabels.exampleVi}...`}
                value={fields.exampleVi}
                onChange={(v) => onChangeField('exampleVi', v)}
                highlighted={flashField === 'example_vi'}
                badgeText={
                  lastInboxBadge?.target === 'example_vi' ? `✓ ${lastInboxBadge.source}` : null
                }
              />
            )}
          </div>
        )}

        {visibility.image && (
          <ImageFieldCard
            label={fieldLabels.image}
            image={cardImage}
            existingAnkiImage={existingImage}
            uploading={imageUploading}
            highlighted={flashField === 'image'}
            badgeText={lastInboxBadge?.target === 'image' ? `✓ ${lastInboxBadge.source}` : null}
            onGrabClipboard={onGrabClipboardImage}
            onUploadDataUrl={onUploadImageDataUrl}
            onRemoveImage={onRemoveImage}
          />
        )}

        {visibility.typeAnswer && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {fieldLabels.typeAnswer}
                </label>
                {extractedTypeAnswer &&
                  fields.typeAnswer.trim() === extractedTypeAnswer && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                      ✓ Từ câu ví dụ
                    </span>
                  )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {extractedTypeAnswer &&
                  fields.typeAnswer.trim() !== extractedTypeAnswer && (
                    <button
                      type="button"
                      onClick={() => onChangeField('typeAnswer', extractedTypeAnswer)}
                      className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      title="Trích xuất từ hoặc dạng chia của từ vựng trong câu ví dụ"
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      Từ câu ví dụ ({extractedTypeAnswer})
                    </button>
                  )}

                {fields.word.trim() && fields.typeAnswer.trim() !== fields.word.trim() && (
                  <button
                    type="button"
                    onClick={() => onChangeField('typeAnswer', fields.word.trim())}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                    title="Sao chép từ gốc ở ô Word"
                  >
                    ← Lấy từ {fieldLabels.word}
                  </button>
                )}
              </div>
            </div>

            <input
              type="text"
              placeholder={`Nhập ${fieldLabels.typeAnswer}...`}
              value={fields.typeAnswer}
              onChange={(e) => onChangeField('typeAnswer', e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            />
          </div>
        )}

        {visibility.pastForms && (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {fieldLabels.pastForms}
              </label>
              {hasOxfordPastForms && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  Oxford
                </span>
              )}
            </div>

            <input
              type="text"
              placeholder="VD: went, gone"
              value={fields.pastForms}
              onChange={(e) => onChangeField('pastForms', e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            />
          </div>
        )}

        {visibility.furigana && (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {fieldLabels.furigana}
              </label>
              {fields.word.trim() && fields.ipa.trim() && !fields.furigana.trim() && (
                <button
                  type="button"
                  onClick={() =>
                    onChangeField('furigana', buildJapaneseFurigana(fields.word, fields.ipa))
                  }
                  className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Tạo tự động
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="VD: 食[た]べる"
              value={fields.furigana}
              onChange={(e) => onChangeField('furigana', e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            />
          </div>
        )}

        {customFields.length > 0 && (
          <div className="border-t border-slate-100 pt-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Trường bổ sung ({customFields.length})
              </span>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                + Quản lý trường &amp; Hiển thị
              </button>
            </div>

            <div className="mt-2.5 grid gap-3 md:grid-cols-2">
              {customFields.map((cf) => {
                const val = fields.customValues[cf.id] ?? '';
                const fieldTitle = cf.ankiField.trim() || cf.label;
                const updateVal = (next: string) => onChangeCustomValue(cf.id, next);

                if (cf.allowBold) {
                  return (
                    <div key={cf.id} className={cf.multiline ? 'md:col-span-2' : ''}>
                      <RichExampleInput
                        label={fieldTitle}
                        placeholder={`Nhập ${fieldTitle}...`}
                        value={val}
                        onChange={updateVal}
                        rows={cf.multiline ? 3 : 2}
                      />
                    </div>
                  );
                }

                return (
                  <div key={cf.id} className={cf.multiline ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-700">
                      {fieldTitle}
                    </label>
                    {cf.multiline ? (
                      <textarea
                        rows={2}
                        value={val}
                        onChange={(e) => updateVal(e.target.value)}
                        placeholder={`Nhập ${fieldTitle}...`}
                        className="mt-1 w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => updateVal(e.target.value)}
                        placeholder={`Nhập ${fieldTitle}...`}
                        className="mt-1 w-full rounded-xl border border-slate-200/90 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: Audio Studio */}
      {(visibility.wordAudio || visibility.exampleAudio) && (
        <div className="space-y-4">
          {visibility.wordAudio &&
            (wordAudioSource === 'folder_scan' ? (
              <DownloadsAudioCard
                title={fieldLabels.wordAudio}
                badgeLabel="Quét thư mục"
                accent="indigo"
                sourceLabel={`${fieldLabels.word}:`}
                emptySourceText={`Chưa có ${fieldLabels.word}`}
                copyButtonLabel="Copy"
                showDurationSeconds={true}
                showCambridgeTab={true}
                sourceText={fields.word}
                downloadsDir={wordDownloadsSlot.dir}
                filterMode={wordDownloadsSlot.filter}
                files={wordDownloadsSlot.files}
                selectedFileId={wordDownloadsSlot.selectedFileId}
                existingAnkiAudio={existingWordAudio}
                loading={wordDownloadsSlot.loading}
                error={wordDownloadsSlot.error}
                onChangeFilter={wordDownloadsSlot.onChangeFilter}
                onRescan={wordDownloadsSlot.onRescan}
                onSelectFile={wordDownloadsSlot.onSelectFile}
                onDeleteFile={wordDownloadsSlot.onDeleteFile}
              />
            ) : (
              <AudioStudioCard
                title={fieldLabels.wordAudio}
                providerBadge={`OpenAI · ${activeVoiceLabel}`}
                accent="indigo"
                sourceText={fields.word}
                existingAnkiAudio={existingWordAudio}
                takes={wordTakes}
                selectedTakeId={selectedWordTakeId}
                generating={wordAudioLoading}
                error={wordAudioError}
                onGenerate={onGenerateWordAudio}
                onSelectTake={onSelectWordTake}
                onDeleteTake={onDeleteWordTake}
                tuningSlot={
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-600">Model</label>
                      <select
                        value={wordModelOverride}
                        onChange={(e) => onChangeWordModelOverride(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="gpt-4o-mini-tts">gpt-4o-mini-tts</option>
                        <option value="tts-1-hd">tts-1-hd</option>
                        <option value="tts-1">tts-1</option>
                        {!['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1'].includes(wordModelOverride) && (
                          <option value={wordModelOverride}>{wordModelOverride}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-600">Tốc độ</label>
                        <span className="font-mono text-[11px] font-semibold text-indigo-700">
                          {wordSpeedOverride}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.75}
                        max={1.2}
                        step={0.05}
                        value={wordSpeedOverride}
                        onChange={(e) => onChangeWordSpeedOverride(Number(e.target.value))}
                        className="mt-2 w-full accent-indigo-600"
                      />
                    </div>
                  </div>
                }
              />
            ))}

          {visibility.exampleAudio && (
            <DownloadsAudioCard
              title={fieldLabels.exampleAudio}
              badgeLabel="ElevenLabs · Downloads"
              sourceLabel={`${fieldLabels.exampleEn}:`}
              emptySourceText={`Chưa có ${fieldLabels.exampleEn}`}
              copyButtonLabel="Copy"
              sourceText={cleanTextForTts(fields.exampleEn)}
              downloadsDir={exampleDownloadsSlot.dir}
              filterMode={exampleDownloadsSlot.filter}
              files={exampleDownloadsSlot.files}
              selectedFileId={exampleDownloadsSlot.selectedFileId}
              existingAnkiAudio={existingExampleAudio}
              loading={exampleDownloadsSlot.loading}
              error={exampleDownloadsSlot.error}
              onChangeFilter={exampleDownloadsSlot.onChangeFilter}
              onRescan={exampleDownloadsSlot.onRescan}
              onSelectFile={exampleDownloadsSlot.onSelectFile}
              onDeleteFile={exampleDownloadsSlot.onDeleteFile}
              onOpenElevenLabsWithText={onOpenElevenLabsWithText}
            />
          )}
        </div>
      )}
    </div>
  );
}
