import { useMemo, useRef, useState } from 'react';
import { COMMON_POS_LIST, normalizePos } from '@ass/shared';

interface PosAutocompleteInputProps {
  value: string;
  prioritySuggestions?: string[];
  placeholder?: string;
  onChange: (next: string) => void;
  onAcceptSuggestion: (pos: string) => void;
}

export function PosAutocompleteInput({
  value,
  prioritySuggestions = [],
  placeholder = 'noun, verb, adjective...',
  onChange,
  onAcceptSuggestion,
}: PosAutocompleteInputProps) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const allCandidates = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const item of [...prioritySuggestions, ...COMMON_POS_LIST]) {
      const clean = normalizePos(item);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        ordered.push(clean);
      }
    }
    return ordered;
  }, [prioritySuggestions]);

  const trimmedLower = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!trimmedLower) return allCandidates;
    const starts = allCandidates.filter((c) => c.startsWith(trimmedLower));
    const contains = allCandidates.filter(
      (c) => !c.startsWith(trimmedLower) && c.includes(trimmedLower),
    );
    return [...starts, ...contains];
  }, [allCandidates, trimmedLower]);

  const safeActiveIndex = activeIndex < matches.length ? activeIndex : 0;
  const activeSuggestion = matches[safeActiveIndex] ?? null;

  // Compute inline ghost completion (like Copilot / IDE code assistant)
  const ghostRemainder = useMemo(() => {
    if (!value || !activeSuggestion) return '';
    const lowerVal = value.toLowerCase();
    if (activeSuggestion === lowerVal) return '';
    if (activeSuggestion.startsWith(lowerVal)) {
      return activeSuggestion.slice(value.length);
    }
    return '';
  }, [activeSuggestion, value]);

  const showDropdown =
    focused &&
    matches.length > 0 &&
    (trimmedLower.length > 0
      ? !(matches.length === 1 && matches[0] === trimmedLower)
      : true);

  const accept = (suggestion: string) => {
    onAcceptSuggestion(suggestion);
    setActiveIndex(0);
    setFocused(false);
  };

  return (
    <div className="relative">
      {/* Unified Input + Inline Ghost Text layer */}
      <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white transition hover:border-slate-300 focus-within:border-indigo-500 focus-within:ring-3 focus-within:ring-indigo-500/12">
        {/* Ghost completion overlay (aligned pixel-perfect with input text) */}
        {ghostRemainder && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-pre px-3 py-1.5 text-sm"
          >
            <span className="invisible">{value}</span>
            <span className="text-slate-400">{ghostRemainder}</span>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onFocus={() => {
            setFocused(true);
            setActiveIndex(0);
          }}
          onBlur={() => {
            // Slight delay so click on dropdown item fires before close
            window.setTimeout(() => setFocused(false), 120);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setActiveIndex(0);
            if (!focused) setFocused(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              if (activeSuggestion && trimmedLower.length > 0 && activeSuggestion !== trimmedLower) {
                e.preventDefault();
                accept(activeSuggestion);
              }
              return;
            }

            if (e.key === 'ArrowRight' && ghostRemainder) {
              const el = inputRef.current;
              if (el && el.selectionStart === value.length && el.selectionEnd === value.length) {
                e.preventDefault();
                accept(activeSuggestion!);
              }
              return;
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setFocused(true);
              if (matches.length > 0) {
                setActiveIndex((prev) => (prev + 1) % matches.length);
              }
              return;
            }

            if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (matches.length > 0) {
                setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length);
              }
              return;
            }

            if (e.key === 'Enter' && showDropdown && activeSuggestion) {
              e.preventDefault();
              accept(activeSuggestion);
              return;
            }

            if (e.key === 'Escape') {
              setFocused(false);
            }
          }}
          className="relative z-10 w-full bg-transparent px-3 py-1.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />

        {/* Subtle IDE-style Tab badge when an inline suggestion can be accepted */}
        {ghostRemainder && (
          <span className="pointer-events-none absolute right-2 z-10 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400">
            Tab
          </span>
        )}
      </div>

      {/* IntelliSense-style suggestion list */}
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {matches.slice(0, 7).map((item, idx) => {
            const isActive = idx === safeActiveIndex;
            const isFromDict = prioritySuggestions.some((p) => normalizePos(p) === item);
            return (
              <li key={item}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    accept(item);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    isActive
                      ? 'bg-indigo-50 font-semibold text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{item}</span>
                  <div className="flex items-center gap-1.5">
                    {isFromDict && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        Từ điển
                      </span>
                    )}
                    {isActive && trimmedLower.length > 0 && (
                      <kbd className="rounded border border-indigo-200 bg-white px-1 py-0.2 font-mono text-[9px] text-indigo-600">
                        Tab
                      </kbd>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
