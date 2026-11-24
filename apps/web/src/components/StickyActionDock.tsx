import { CheckCircle2, Eye, Loader2, Save } from 'lucide-react';
import type { AnkiNoteItem } from '@ass/shared';

interface StickyActionDockProps {
  isEnrichNote: boolean;
  currentEnrichNote: AnkiNoteItem | null;
  ankiDecks: string[];
  activeDeck: string;
  savingCard: boolean;
  onChangeTargetDeck: (deck: string) => void;
  onOpenSettings: () => void;
  onOpenPreview: () => void;
  onSaveCard: (advanceNext: boolean) => void;
}

export function StickyActionDock({
  isEnrichNote,
  currentEnrichNote,
  ankiDecks,
  activeDeck,
  savingCard,
  onChangeTargetDeck,
  onOpenSettings,
  onOpenPreview,
  onSaveCard,
}: StickyActionDockProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {isEnrichNote && currentEnrichNote ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono font-semibold text-indigo-700">
                #{currentEnrichNote.noteId}
              </span>
              <span className="hidden text-slate-500 sm:inline">{currentEnrichNote.modelName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Deck:</span>
              {ankiDecks.length > 0 ? (
                <select
                  value={activeDeck}
                  onChange={(e) => onChangeTargetDeck(e.target.value)}
                  className="max-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  {!activeDeck && <option value="">-- Chọn Deck --</option>}
                  {ankiDecks.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline"
                >
                  {activeDeck || 'Chưa chọn Deck'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPreview}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Xem trước</span>
          </button>

          {isEnrichNote && currentEnrichNote ? (
            <>
              <button
                type="button"
                disabled={savingCard}
                onClick={() => onSaveCard(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Cập nhật
              </button>
              <button
                type="button"
                disabled={savingCard}
                onClick={() => onSaveCard(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingCard ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Cập nhật &amp; Tiếp theo
                <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-indigo-50 sm:inline">
                  Ctrl+↵
                </kbd>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={savingCard}
              onClick={() => onSaveCard(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingCard ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Lưu thẻ vào Anki
              <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-indigo-50 sm:inline">
                Ctrl+↵
              </kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
