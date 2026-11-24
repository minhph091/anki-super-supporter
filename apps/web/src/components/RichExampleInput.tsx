import { useEffect, useRef } from 'react';
import { sanitizeAnkiBoldText } from '@ass/shared';

interface RichExampleInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  badgeText?: string | null;
  highlighted?: boolean;
  headerRight?: React.ReactNode;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts our stored Anki-safe text (`She is <b>resilient</b>.\nLine 2`)
 * into clean HTML for the WYSIWYG contentEditable editor.
 */
function valueToEditorHtml(raw: string): string {
  const normalized = sanitizeAnkiBoldText(raw, false);
  if (!normalized) return '';
  const parts = normalized.split(/(<b>[\s\S]*?<\/b>)/gi);
  return parts
    .map((part) => {
      const match = part.match(/^<b>([\s\S]*?)<\/b>$/i);
      if (match) {
        return `<b>${escapeHtml(match[1]).replace(/\n/g, '<br>')}</b>`;
      }
      return escapeHtml(part).replace(/\n/g, '<br>');
    })
    .join('');
}

/**
 * Serializes a contentEditable DOM tree back to clean Anki bold markup (`<b>...</b>` + `\n`),
 * hiding raw tags while preserving exact bold formatting when saving to Anki.
 */
function editorDomToValue(root: HTMLElement): string {
  const serializeNode = (node: Node, inBold: boolean): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').replace(/\u00a0/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'BR') return '\n';

    const styleWeight = el.style?.fontWeight;
    const isBoldTag =
      tag === 'B' ||
      tag === 'STRONG' ||
      styleWeight === 'bold' ||
      styleWeight === '700' ||
      styleWeight === '600';

    const nextBold = inBold || isBoldTag;
    let inner = '';
    el.childNodes.forEach((child) => {
      inner += serializeNode(child, nextBold);
    });

    if (isBoldTag && !inBold && inner.trim()) {
      inner = `<b>${inner}</b>`;
    }

    const isBlock = tag === 'DIV' || tag === 'P' || tag === 'LI';
    if (isBlock) {
      return `\n${inner}`;
    }

    return inner;
  };

  let out = '';
  root.childNodes.forEach((child) => {
    out += serializeNode(child, false);
  });

  out = out
    .replace(/^\n+/, '')
    .replace(/\n$/, '')
    .replace(/<\/b><b>/g, '')
    .replace(/<b>(\s*)<\/b>/g, '$1');

  return out;
}

export function renderBoldPreview(raw: string): React.ReactNode {
  const normalized = sanitizeAnkiBoldText(raw, false);
  const lines = normalized.split('\n');

  return lines.map((line, lineIdx) => {
    const parts = line.split(/(<b>.*?<\/b>)/gi);
    return (
      <span key={lineIdx}>
        {parts.map((part, idx) => {
          const match = part.match(/^<b>(.*?)<\/b>$/i);
          if (match) {
            return (
              <strong key={idx} className="font-semibold text-slate-950">
                {match[1]}
              </strong>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function RichExampleInput({
  label,
  placeholder,
  value,
  onChange,
  rows = 3,
  badgeText,
  highlighted = false,
  headerRight,
}: RichExampleInputProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastEmittedRef.current) return;

    const html = valueToEditorHtml(value);
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
    lastEmittedRef.current = value;
  }, [value]);

  const syncFromDom = () => {
    const el = editorRef.current;
    if (!el) return;
    const serialized = editorDomToValue(el);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  };

  const isEmpty = value.replace(/<\/?b>/gi, '').trim().length === 0;
  const minHeightPx = Math.max(2, rows) * 24 + 16;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-700">{label}</label>
          {badgeText && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
              {badgeText}
            </span>
          )}
        </div>
        {headerRight && <div className="flex items-center gap-1.5">{headerRight}</div>}
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border bg-white transition-all focus-within:border-indigo-500 focus-within:ring-3 focus-within:ring-indigo-500/12 ${highlighted
          ? 'animate-inbox-flash border-indigo-400'
          : 'border-slate-200/90 hover:border-slate-300'
          }`}
      >
        {isEmpty && (
          <div className="pointer-events-none absolute inset-x-3 top-2 select-none text-sm text-slate-400">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          style={{ minHeight: `${minHeightPx}px` }}
          onInput={syncFromDom}
          onPaste={(e) => {
            e.preventDefault();
            const plain = e.clipboardData.getData('text/plain');
            if (plain) {
              document.execCommand('insertText', false, plain);
              syncFromDom();
            }
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
              e.preventDefault();
              document.execCommand('bold', false);
              syncFromDom();
            }
          }}
          className="w-full px-3 py-2 text-sm leading-relaxed text-slate-900 focus:outline-none [&_b]:font-bold [&_b]:text-slate-950 [&_strong]:font-bold [&_strong]:text-slate-950"
        />
      </div>
    </div>
  );
}
