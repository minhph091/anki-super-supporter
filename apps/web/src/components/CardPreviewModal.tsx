import { useEffect, useState } from 'react';
import { Eye, RotateCw, Volume2, X } from 'lucide-react';
import type { CustomFieldConfig } from '@ass/shared';
import { renderBoldPreview } from './RichExampleInput';

interface CardPreviewModalProps {
  open: boolean;
  onClose: () => void;
  deckName: string;
  word: string;
  formattedPos: string;
  ipa: string;
  typeAnswer?: string;
  pastForms?: string;
  furigana?: string;
  definition: string;
  exampleEn: string;
  exampleVi: string;
  imageUrl?: string | null;
  hasWordAudio: boolean;
  hasExampleAudio: boolean;
  customFields: CustomFieldConfig[];
  customValues: Record<string, string>;
  typeAnswerLabel?: string;
  pastFormsLabel?: string;
  furiganaLabel?: string;
  definitionLabel?: string;
  wordAudioLabel?: string;
  exampleAudioLabel?: string;
}

export function CardPreviewModal({
  open,
  onClose,
  deckName,
  word,
  formattedPos,
  ipa,
  typeAnswer = '',
  pastForms = '',
  furigana = '',
  definition,
  exampleEn,
  exampleVi,
  imageUrl,
  hasWordAudio,
  hasExampleAudio,
  customFields,
  customValues,
  typeAnswerLabel = 'Type Answer',
  pastFormsLabel = 'Past Simple and Past Participle',
  furiganaLabel = 'Furigana',
  definitionLabel = 'Definition',
  wordAudioLabel = 'Word Audio',
  exampleAudioLabel = 'Example Audio',
}: CardPreviewModalProps) {
  const [side, setSide] = useState<'front' | 'back'>('back');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filledCustom = customFields.filter((cf) => (customValues[cf.id] ?? '').trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="animate-toast-in w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Xem trước thẻ Anki</h3>
            {deckName && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {deckName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setSide('front')}
                className={`rounded-md px-2.5 py-1 transition ${
                  side === 'front' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Mặt trước
              </button>
              <button
                type="button"
                onClick={() => setSide('back')}
                className={`rounded-md px-2.5 py-1 transition ${
                  side === 'back' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Đầy đủ (Mặt sau)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Card body */}
        <div className="bg-[#f6f7fb] p-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
            {/* Word + POS + IPA */}
            <div className="flex flex-wrap items-baseline justify-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {word.trim() || <span className="text-slate-300">(Chưa nhập từ)</span>}
              </span>
              {formattedPos && (
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold italic text-indigo-700">
                  {formattedPos}
                </span>
              )}
            </div>

            {ipa.trim() && (
              <p className="font-ipa mt-1 text-sm text-slate-500">{ipa.trim()}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {hasWordAudio && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                  <Volume2 className="h-3 w-3" /> {wordAudioLabel}
                </span>
              )}
              {side === 'back' && hasExampleAudio && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <Volume2 className="h-3 w-3" /> {exampleAudioLabel}
                </span>
              )}
            </div>

            {side === 'back' && (
              <div className="mt-5 space-y-3.5 border-t border-slate-100 pt-5 text-left">
                {imageUrl && (
                  <div className="flex justify-center">
                    <img
                      src={imageUrl}
                      alt={word || 'Anki image'}
                      className="max-h-44 rounded-xl border border-slate-200 object-contain"
                    />
                  </div>
                )}

                {typeAnswer.trim() && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {typeAnswerLabel}
                    </div>
                    <p className="mt-1 font-mono text-sm font-medium text-indigo-700">
                      {typeAnswer.trim()}
                    </p>
                  </div>
                )}

                {pastForms.trim() && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {pastFormsLabel}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">{pastForms.trim()}</p>
                  </div>
                )}

                {furigana.trim() && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {furiganaLabel}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">{furigana.trim()}</p>
                  </div>
                )}

                {definition.trim() && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {definitionLabel}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                      {renderBoldPreview(definition)}
                    </p>
                  </div>
                )}

                {(exampleEn.trim() || exampleVi.trim()) && (
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    {exampleEn.trim() && (
                      <p className="text-sm leading-relaxed text-slate-800">
                        {renderBoldPreview(exampleEn)}
                      </p>
                    )}
                    {exampleVi.trim() && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        {renderBoldPreview(exampleVi)}
                      </p>
                    )}
                  </div>
                )}

                {filledCustom.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    {filledCustom.map((cf) => (
                      <div key={cf.id}>
                        <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                          {cf.ankiField.trim() || cf.label}
                        </div>
                        <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                          {cf.allowBold
                            ? renderBoldPreview(customValues[cf.id])
                            : customValues[cf.id]}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Lật sang {side === 'front' ? 'Mặt sau' : 'Mặt trước'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
