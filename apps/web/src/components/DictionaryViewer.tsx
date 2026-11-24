import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckSquare,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import {
  getLanguageDefinition,
  getLanguagePrimaryUrl,
  getLanguageSecondaryUrl,
  normalizePos,
  stripIpaSlashes,
  type CambridgeDictMode,
  type DictionaryLookupResponse,
  type LanguageCode,
} from '@ass/shared';

interface DictionaryViewerProps {
  lang: LanguageCode;
  cambridgeMode?: CambridgeDictMode;
  word: string;
  selectedPos: string;
  currentReading?: string;
  loading: boolean;
  autoSyncMessage?: string | null;
  fallbackLoading?: boolean;
  lookup?: DictionaryLookupResponse | null;
  selectedSenseIds: string[];
  onToggleSense: (
    senseId: string,
    definition: string,
    entryPos: string,
    guideword?: string,
  ) => void;
  onClearSelectedSenses: () => void;
  onUseExample: (example: string) => void;
  onSelectPos: (pos: string) => void;
  onSelectReading: (reading: string, autoFields?: Record<string, string>) => void;
  onRefresh: () => void;
  onLoadFallback: () => void;
  onSyncOxford?: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  A2: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  B1: 'bg-sky-100 text-sky-800 ring-sky-200',
  B2: 'bg-blue-100 text-blue-800 ring-blue-200',
  C1: 'bg-violet-100 text-violet-800 ring-violet-200',
  C2: 'bg-purple-100 text-purple-800 ring-purple-200',
  N5: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  N4: 'bg-sky-100 text-sky-800 ring-sky-200',
  N3: 'bg-blue-100 text-blue-800 ring-blue-200',
  N2: 'bg-violet-100 text-violet-800 ring-violet-200',
  N1: 'bg-rose-100 text-rose-800 ring-rose-200',
};

export function DictionaryViewer({
  lang,
  cambridgeMode = 'english',
  word,
  selectedPos,
  currentReading = '',
  loading,
  autoSyncMessage,
  fallbackLoading,
  lookup,
  selectedSenseIds,
  onToggleSense,
  onClearSelectedSenses,
  onUseExample,
  onSelectPos,
  onSelectReading,
  onRefresh,
  onLoadFallback,
  onSyncOxford,
}: DictionaryViewerProps) {
  const langDef = getLanguageDefinition(lang);
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [senseQuery, setSenseQuery] = useState('');
  const [recentlyAddedExample, setRecentlyAddedExample] = useState<string | null>(null);

  // Reset local filters when language or word changes
  useEffect(() => {
    setActiveFilter('');
    setSenseQuery('');
  }, [lang, lookup?.word]);

  const normalizedSelectedPos = langDef.normalizePos
    ? normalizePos(selectedPos)
    : selectedPos.trim();
  const normalizedCurrentReading = langDef.stripReadingSlashes
    ? stripIpaSlashes(currentReading)
    : currentReading.trim();
  const entries = lookup?.entries ?? [];
  const oxfordEntries = useMemo(
    () =>
      lang === 'en'
        ? (lookup?.oxford?.entries ?? []).filter(
            (e) =>
              Boolean(stripIpaSlashes(e.usIpa || '')) ||
              Boolean(stripIpaSlashes(e.ukIpa || '')) ||
              Boolean(e.pastForms),
          )
        : [],
    [lang, lookup?.oxford?.entries],
  );

  const filterMode = langDef.viewerFilterMode;

  const filterPills = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      const key = filterMode === 'pos' ? entry.pos : entry.sourceName;
      if (key) set.add(key);
    }
    return Array.from(set);
  }, [entries, filterMode]);

  const totalSensesCount = useMemo(() => {
    return entries.reduce(
      (sum, entry) =>
        sum + entry.blocks.reduce((bSum, b) => bSum + b.senses.length, 0),
      0,
    );
  }, [entries]);

  const visibleEntries = useMemo(() => {
    const filtered = !activeFilter
      ? entries
      : entries.filter((e) =>
        filterMode === 'pos'
          ? normalizePos(e.pos) === normalizePos(activeFilter)
          : e.sourceName === activeFilter,
      );

    const base = filtered.length > 0 ? filtered : entries;
    const q = senseQuery.trim().toLowerCase();
    if (!q) return base;

    return base
      .map((entry) => ({
        ...entry,
        blocks: entry.blocks
          .map((block) => ({
            ...block,
            senses: block.senses.filter(
              (s) =>
                s.definition.toLowerCase().includes(q) ||
                (block.guideword && block.guideword.toLowerCase().includes(q)) ||
                s.examples.some((ex) => ex.toLowerCase().includes(q)),
            ),
          }))
          .filter((block) => block.senses.length > 0),
      }))
      .filter((entry) => entry.blocks.length > 0);
  }, [activeFilter, entries, filterMode, senseQuery]);

  const primaryUrl = lookup?.primaryUrl || getLanguagePrimaryUrl(lang, word, cambridgeMode);

  const oxfordIpaOptions = useMemo(() => {
    if (lang !== 'en') return [];
    const oxEntries = lookup?.oxford?.entries ?? [];
    const list: Array<{
      id: string;
      label: 'US' | 'UK';
      pos: string;
      ipa: string;
      autoFields?: Record<string, string>;
    }> = [];
    const pushOpt = (opt: (typeof list)[number]) => {
      if (!opt.ipa) return;
      if (list.some((x) => x.label === opt.label && x.pos === opt.pos && x.ipa === opt.ipa)) return;
      list.push(opt);
    };
    for (const item of oxEntries) {
      const us = stripIpaSlashes(item.usIpa || '');
      const uk = stripIpaSlashes(item.ukIpa || '');
      const autoFields = item.pastForms ? { pastForms: item.pastForms } : undefined;
      if (us) {
        pushOpt({
          id: `ox_btn_${item.id}_us`,
          label: 'US',
          pos: item.pos,
          ipa: us,
          autoFields,
        });
      }
      if (uk && uk !== us) {
        pushOpt({
          id: `ox_btn_${item.id}_uk`,
          label: 'UK',
          pos: item.pos,
          ipa: uk,
          autoFields,
        });
      }
    }
    list.sort((a, b) => (a.label === 'US' ? 0 : 1) - (b.label === 'US' ? 0 : 1));
    return list;
  }, [lang, lookup?.oxford?.entries]);

  const secondaryUrl =
    (lang === 'en' && oxfordEntries.length > 0 && lookup?.secondaryUrl
      ? lookup.secondaryUrl
      : undefined) ||
    (lang !== 'en' && lookup?.secondaryUrl ? lookup.secondaryUrl : undefined) ||
    getLanguageSecondaryUrl(lang, word);

  const handleInsertExample = (ex: string) => {
    onUseExample(ex);
    setRecentlyAddedExample(ex);
    window.setTimeout(() => {
      setRecentlyAddedExample((curr) => (curr === ex ? null : curr));
    }, 1500);
  };

  const headerGradient =
    langDef.accentTheme === 'rose'
      ? 'from-[#3b1526] via-[#531d35] to-[#6a2544]'
      : 'from-[#1b2750] via-[#223469] to-[#283c7a]';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Editorial Dictionary Header */}
      <div className={`border-b border-slate-200/80 bg-gradient-to-br ${headerGradient} px-4 py-3 text-white`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/12 text-amber-300">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold tracking-tight">{langDef.viewerTitle}</h2>
                <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                  {lang === 'en' && cambridgeMode === 'learner-english'
                    ? "EN · Learner's"
                    : langDef.shortLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {word.trim() && (
              <>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  title="Tải mới lại từ điển"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-white/22 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
                <a
                  href={primaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-white/22"
                >
                  {langDef.primarySourceLabel}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {langDef.secondarySourceLabel && (
                  <a
                    href={secondaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-white/22"
                  >
                    {langDef.secondarySourceLabel}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filter pills & sense counter */}
        {filterPills.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('')}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${!activeFilter
                ? 'bg-amber-400 text-slate-950 shadow-2xs'
                : 'bg-white/12 text-blue-100 hover:bg-white/22'
                }`}
            >
              Tất cả
            </button>
            {filterPills.map((pill) => {
              const active = activeFilter === pill;
              return (
                <button
                  key={pill}
                  type="button"
                  onClick={() => {
                    setActiveFilter(pill);
                    if (filterMode === 'pos') onSelectPos(pill);
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${active
                    ? 'bg-amber-400 text-slate-950 shadow-2xs'
                    : 'bg-white/12 text-blue-100 hover:bg-white/22'
                    }`}
                >
                  {pill}
                </button>
              );
            })}

            {selectedSenseIds.length > 0 && (
              <button
                type="button"
                onClick={onClearSelectedSenses}
                title="Bỏ chọn tất cả định nghĩa đã tick"
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30 transition hover:bg-emerald-400/30"
              >
                Đã chọn {selectedSenseIds.length}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Oxford IPA selector strip (EN) — always visible once a word is looked up */}
      {lang === 'en' && lookup && (
        <div className="border-b border-sky-100 bg-sky-50/60 px-3.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wider text-sky-800 uppercase">
              Oxford IPA
            </span>
            {oxfordIpaOptions.length > 0 || oxfordEntries.some((e) => e.pastForms) ? (
              <>
                {oxfordIpaOptions.map((opt) => {
                  const isActive =
                    Boolean(currentReading) && stripIpaSlashes(currentReading || '') === opt.ipa;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onSelectReading(opt.ipa, opt.autoFields);
                        if (opt.pos && !selectedPos) onSelectPos(opt.pos);
                      }}
                      title={`Click để chọn Oxford ${opt.label} IPA${opt.pos ? ` (${opt.pos})` : ''}`}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-800 shadow-2xs'
                          : 'border-sky-200/90 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold ${
                          opt.label === 'UK' ? 'text-amber-700' : 'text-sky-700'
                        }`}
                      >
                        {opt.label}
                      </span>
                      {opt.pos && <span className="italic text-slate-400">{opt.pos}</span>}
                      <span className="font-ipa">{opt.ipa}</span>
                    </button>
                  );
                })}
                {oxfordEntries
                  .filter((e) => Boolean(e.pastForms))
                  .map((ox) => {
                    const oxIpa = stripIpaSlashes(ox.usIpa || ox.ukIpa || '');
                    return (
                      <button
                        key={`ox_vf_${ox.id}`}
                        type="button"
                        onClick={() =>
                          onSelectReading(oxIpa || normalizedCurrentReading, {
                            pastForms: ox.pastForms!,
                          })
                        }
                        title="Click để điền Past Simple & Past Participle từ Oxford"
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-medium text-emerald-800 transition hover:border-emerald-400"
                      >
                        <span className="text-[10px] font-bold text-emerald-700">V2, V3</span>
                        <span>{ox.pastForms}</span>
                      </button>
                    );
                  })}
              </>
            ) : autoSyncMessage?.includes('Oxford') ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Đang lấy IPA từ Oxford...
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Chưa có IPA từ Oxford</span>
                {onSyncOxford && word.trim() && (
                  <button
                    type="button"
                    onClick={onSyncOxford}
                    title="Tự động mở tab nền Oxford American English để lấy IPA"
                    className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-800 transition hover:bg-sky-100/70"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Lấy Oxford
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick search inside senses when there are many definitions */}
      {totalSensesCount > 4 && (
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={senseQuery}
              onChange={(e) => setSenseQuery(e.target.value)}
              placeholder={`Lọc nhanh trong ${totalSensesCount} định nghĩa...`}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-7 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            {senseQuery && (
              <button
                type="button"
                onClick={() => setSenseQuery('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {loading || (autoSyncMessage && entries.length === 0) ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                {autoSyncMessage ? 'Đang tự động đồng bộ từ điển...' : 'Đang tra từ điển...'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {autoSyncMessage || langDef.viewerLoadingHint}
              </p>
            </div>
          </div>
        ) : !lookup ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2.5 px-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-500">
              Nhập từ {langDef.name.toLowerCase()} và nhấn{' '}
              <span className="font-semibold text-indigo-600">Enter</span> để tra từ điển
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div>
            {autoSyncMessage && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-800">
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
                <span>{autoSyncMessage}</span>
              </div>
            )}
            <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {lookup.entryError || `Không tìm thấy mục từ trên ${langDef.primarySourceLabel}.`}
              </p>
              <div className="rounded-xl border border-amber-200/70 bg-white p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">
                  Mẹo lấy định nghĩa trực tiếp qua Browser Extension:
                </p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 leading-relaxed">
                  <li>
                    Bấm <strong>Mở trang {langDef.primarySourceLabel} gốc</strong> bên dưới.
                  </li>
                  <li>
                    Trên trang từ điển, bấm{' '}
                    <strong>⟳ Đồng bộ {langDef.primarySourceLabel} → Studio</strong> hoặc bấm{' '}
                    <strong>+ Chọn vào Anki</strong> cạnh định nghĩa bạn muốn.
                  </li>
                </ol>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={primaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d2a57] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#283c7a]"
                >
                  Mở trang {langDef.primarySourceLabel} gốc
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  disabled={fallbackLoading || !word.trim()}
                  onClick={onLoadFallback}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${fallbackLoading ? 'animate-spin' : ''}`} />
                  {langDef.fallbackLabel}
                </button>
              </div>
            </div>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-slate-400">
            <p>Không có định nghĩa nào khớp từ khóa “{senseQuery}”.</p>
            <button
              type="button"
              onClick={() => setSenseQuery('')}
              className="font-semibold text-indigo-600 hover:underline"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {autoSyncMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-800">
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
                <span>{autoSyncMessage}</span>
              </div>
            )}
            {visibleEntries.map((entry) => {
              const isPosMatched =
                Boolean(normalizedSelectedPos) &&
                (lang === 'en'
                  ? normalizePos(entry.pos) === normalizedSelectedPos
                  : entry.pos === normalizedSelectedPos);

              return (
                <section
                  key={entry.id}
                  className={`rounded-xl border p-3.5 transition ${isPosMatched
                    ? 'border-indigo-300/90 bg-indigo-50/25'
                    : 'border-slate-200/80 bg-slate-50/40'
                    }`}
                >
                  {/* Entry header */}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-base font-bold tracking-tight text-[#1b2750]">
                        {entry.headword}
                      </h3>
                      {entry.pos && (
                        <button
                          type="button"
                          onClick={() => onSelectPos(entry.pos)}
                          title="Chọn từ loại này cho thẻ Anki"
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold italic transition ${isPosMatched
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-200/80 text-slate-700 hover:bg-indigo-100 hover:text-indigo-800'
                            }`}
                        >
                          {entry.pos}
                        </button>
                      )}
                      {entry.reading && (
                        <button
                          type="button"
                          onClick={() => onSelectReading(entry.reading!, entry.autoFields)}
                          title={`Click để dùng ${lang === 'ja' ? '読み方' : 'Cambridge US IPA'} này`}
                          className={`font-ipa rounded-md border px-2 py-0.5 text-xs transition ${
                            normalizedCurrentReading ===
                            (lang === 'en' ? stripIpaSlashes(entry.reading) : entry.reading.trim())
                              ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-800'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
                          }`}
                        >
                          {lang === 'ja' ? `読み方 ${entry.reading}` : `US ${entry.reading}`}
                        </button>
                      )}
                      {lang === 'en' && entry.altReading && (
                        <button
                          type="button"
                          onClick={() => onSelectReading(entry.altReading!, entry.autoFields)}
                          title="Click để dùng Cambridge UK IPA này"
                          className={`font-ipa rounded-md border px-2 py-0.5 text-xs transition ${
                            normalizedCurrentReading === stripIpaSlashes(entry.altReading)
                              ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                          }`}
                        >
                          UK {entry.altReading}
                        </button>
                      )}
                    </div>

                    {entry.sourceName && lang !== 'en' && (
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200/60">
                        {entry.sourceName}
                      </span>
                    )}
                  </div>

                  {/* Sense Blocks */}
                  <div className="mt-3 space-y-3">
                    {entry.blocks.map((block) => (
                      <div key={block.id} className="space-y-2">
                        {block.guideword && (
                          <div className="inline-block rounded-md bg-[#1d2a57] px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
                            {block.guideword}
                          </div>
                        )}

                        {block.senses.map((sense) => {
                          const isSelected = selectedSenseIds.includes(sense.id);
                          const levelClass = sense.level
                            ? LEVEL_COLORS[sense.level] ?? 'bg-slate-200 text-slate-800 ring-slate-300'
                            : '';

                          return (
                            <div
                              key={sense.id}
                              onClick={() =>
                                onToggleSense(
                                  sense.id,
                                  sense.definition,
                                  entry.pos,
                                  block.guideword,
                                )
                              }
                              className={`cursor-pointer rounded-xl border p-3 transition ${isSelected
                                ? 'border-indigo-500 bg-indigo-50/75 ring-2 ring-indigo-500/15'
                                : 'border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-2xs'
                                }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 shrink-0 text-indigo-600">
                                  {isSelected ? (
                                    <CheckSquare className="h-4 w-4" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-300" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {sense.level && (
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${levelClass}`}
                                      >
                                        {sense.level}
                                      </span>
                                    )}
                                    <p className="text-[13px] font-medium leading-snug text-slate-900">
                                      {sense.definition}
                                    </p>
                                  </div>

                                  {sense.examples.length > 0 && (
                                    <ul className="mt-2 space-y-1.5 border-l-2 border-slate-200/90 pl-2.5">
                                      {sense.examples.slice(0, 3).map((ex, idx) => {
                                        const justAdded = recentlyAddedExample === ex;
                                        return (
                                          <li
                                            key={idx}
                                            className="group flex items-start justify-between gap-2 text-xs italic leading-relaxed text-slate-600"
                                          >
                                            <span>{ex}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleInsertExample(ex);
                                              }}
                                              title="Đưa câu ví dụ này vào trường Example"
                                              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold not-italic transition ${justAdded
                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                                : 'border-slate-200 bg-white text-slate-500 opacity-80 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 group-hover:opacity-100'
                                                }`}
                                            >
                                              <span className="inline-flex items-center gap-0.5">
                                                {justAdded ? (
                                                  <>
                                                    <Check className="h-2.5 w-2.5" /> Đã chèn
                                                  </>
                                                ) : (
                                                  <>
                                                    <Plus className="h-2.5 w-2.5" /> Ví dụ
                                                  </>
                                                )}
                                              </span>
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
