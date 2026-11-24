import { CheckCircle2, ChevronLeft, ChevronRight, FolderSync, Loader2 } from 'lucide-react';
import { stripHtmlToPlainText, type AnkiNoteItem, type FieldMapping } from '@ass/shared';

export type EnrichPreset =
  | 'missing_any_audio'
  | 'missing_word_audio'
  | 'missing_ex_audio'
  | 'missing_ipa'
  | 'all'
  | 'custom';

interface EnrichQueueBarProps {
  ankiDecks: string[];
  enrichDeck: string;
  enrichPreset: EnrichPreset;
  customQuery: string;
  enrichNotes: AnkiNoteItem[];
  enrichIndex: number;
  updatedNoteIds: Set<number>;
  loadingNotes: boolean;
  fieldMapping: FieldMapping;
  onChangeDeck: (deck: string) => void;
  onChangePreset: (preset: EnrichPreset) => void;
  onChangeCustomQuery: (q: string) => void;
  onLoadNotes: () => void;
  onSelectIndex: (index: number) => void;
}

export function EnrichQueueBar({
  ankiDecks,
  enrichDeck,
  enrichPreset,
  customQuery,
  enrichNotes,
  enrichIndex,
  updatedNoteIds,
  loadingNotes,
  fieldMapping,
  onChangeDeck,
  onChangePreset,
  onChangeCustomQuery,
  onLoadNotes,
  onSelectIndex,
}: EnrichQueueBarProps) {
  const updatedCount = enrichNotes.filter((n) => updatedNoteIds.has(n.noteId)).length;

  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-600">
            Deck trong Anki
          </label>
          <select
            value={enrichDeck}
            onChange={(e) => onChangeDeck(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
          >
            <option value="">Tất cả Deck</option>
            {ankiDecks.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[200px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-600">
            Bộ lọc thẻ cần bổ sung
          </label>
          <select
            value={enrichPreset}
            onChange={(e) => onChangePreset(e.target.value as EnrichPreset)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
          >
            <option value="missing_any_audio">Thiếu Audio (Từ hoặc Câu)</option>
            <option value="missing_word_audio">Thiếu Audio Từ vựng</option>
            <option value="missing_ex_audio">Thiếu Audio Câu ví dụ</option>
            <option value="missing_ipa">Thiếu US IPA</option>
            <option value="all">Tất cả thẻ trong Deck</option>
            <option value="custom">Truy vấn Anki tùy chỉnh...</option>
          </select>
        </div>

        {enrichPreset === 'custom' && (
          <div className="min-w-[240px] flex-[1.5]">
            <label className="block text-[11px] font-semibold text-slate-600">
              Truy vấn Anki (Query)
            </label>
            <input
              type="text"
              placeholder='VD: deck:"English" "IPA:"'
              value={customQuery}
              onChange={(e) => onChangeCustomQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLoadNotes();
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/12 focus:outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={onLoadNotes}
          disabled={loadingNotes}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loadingNotes ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderSync className="h-3.5 w-3.5" />
          )}
          Tải danh sách thẻ
        </button>

        {enrichNotes.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {updatedCount > 0 && (
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đã cập nhật {updatedCount}/{enrichNotes.length}
              </span>
            )}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1">
              <button
                type="button"
                disabled={enrichIndex <= 0}
                onClick={() => onSelectIndex(enrichIndex - 1)}
                title="Thẻ trước (Alt+←)"
                className="rounded-lg p-1 text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1.5 text-xs font-semibold text-slate-700">
                {enrichIndex + 1} / {enrichNotes.length}
              </span>
              <button
                type="button"
                disabled={enrichIndex >= enrichNotes.length - 1}
                onClick={() => onSelectIndex(enrichIndex + 1)}
                title="Thẻ tiếp theo (Alt+→)"
                className="rounded-lg p-1 text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Horizontal queue strip so user can see & jump to any loaded note */}
      {enrichNotes.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {enrichNotes.map((note, idx) => {
              const wordVal =
                stripHtmlToPlainText(note.fields[fieldMapping.word]?.value ?? '') ||
                `#${note.noteId}`;
              const isCurrent = idx === enrichIndex;
              const isDone = updatedNoteIds.has(note.noteId);
              const missingIpa =
                fieldMapping.ipa && !(note.fields[fieldMapping.ipa]?.value ?? '').trim();
              const missingWordAudio =
                fieldMapping.wordAudio && !(note.fields[fieldMapping.wordAudio]?.value ?? '').trim();
              const missingExAudio =
                fieldMapping.exampleAudio &&
                !(note.fields[fieldMapping.exampleAudio]?.value ?? '').trim();

              return (
                <button
                  key={note.noteId}
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                    isCurrent
                      ? 'border-indigo-500 bg-indigo-600 font-semibold text-white shadow-xs'
                      : isDone
                        ? 'border-emerald-200 bg-emerald-50/70 font-medium text-emerald-800 hover:border-emerald-300'
                        : 'border-slate-200 bg-slate-50/70 font-medium text-slate-700 hover:border-indigo-300 hover:bg-white'
                  }`}
                >
                  <span className={`text-[10px] ${isCurrent ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {idx + 1}.
                  </span>
                  <span className="max-w-[140px] truncate">{wordVal}</span>
                  {isDone ? (
                    <CheckCircle2
                      className={`h-3 w-3 shrink-0 ${isCurrent ? 'text-emerald-200' : 'text-emerald-600'}`}
                    />
                  ) : (
                    <span className="inline-flex items-center gap-0.5">
                      {missingIpa && (
                        <span
                          title="Thiếu IPA"
                          className={`h-1.5 w-1.5 rounded-full ${
                            isCurrent ? 'bg-amber-300' : 'bg-amber-400'
                          }`}
                        />
                      )}
                      {(missingWordAudio || missingExAudio) && (
                        <span
                          title="Thiếu Audio"
                          className={`h-1.5 w-1.5 rounded-full ${
                            isCurrent ? 'bg-rose-300' : 'bg-rose-400'
                          }`}
                        />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Thiếu IPA
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Thiếu Audio
            </span>
            <span className="ml-auto hidden sm:inline">
              Phím tắt: <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-600">Alt+←</kbd> /{' '}
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-600">Alt+→</kbd> chuyển thẻ
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
