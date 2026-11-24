import { AlertTriangle, CheckCircle2, Info, RotateCcw, X } from 'lucide-react';
import type { ToastState } from '../hooks/useToast';

interface ToastBannerProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  if (!toast) return null;

  return (
    <div className="fixed right-4 bottom-20 z-50 max-w-md">
      <div
        className={`animate-toast-in flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium shadow-lg ${
          toast.tone === 'success'
            ? 'border-emerald-500/30 bg-emerald-600 text-white'
            : toast.tone === 'error'
              ? 'border-rose-500/30 bg-rose-600 text-white'
              : 'border-slate-700 bg-slate-900 text-white'
        }`}
      >
        {toast.tone === 'success' ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
        ) : toast.tone === 'error' ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-200" />
        ) : (
          <Info className="h-4 w-4 shrink-0 text-indigo-300" />
        )}
        <span className="leading-snug">{toast.text}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={toast.onAction}
            className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/18 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/28"
          >
            <RotateCcw className="h-3 w-3" />
            {toast.actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-1 shrink-0 rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
