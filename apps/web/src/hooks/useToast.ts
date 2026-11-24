import { useCallback, useRef, useState } from 'react';

export interface ToastState {
  id: number;
  text: string;
  tone: 'success' | 'info' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [flashField, setFlashField] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const triggerFieldFlash = useCallback((fieldKey: string) => {
    setFlashField(fieldKey);
    window.setTimeout(() => {
      setFlashField((curr) => (curr === fieldKey ? null : curr));
    }, 950);
  }, []);

  const showToast = useCallback(
    (
      text: string,
      tone: 'success' | 'info' | 'error' = 'info',
      action?: { label: string; onClick: () => void },
    ) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      const id = Date.now();
      setToast({
        id,
        text,
        tone,
        actionLabel: action?.label,
        onAction: action?.onClick,
      });
      toastTimerRef.current = window.setTimeout(
        () => {
          setToast((curr) => (curr?.id === id ? null : curr));
        },
        action ? 5500 : 3500,
      );
    },
    [],
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  return {
    toast,
    showToast,
    dismissToast,
    flashField,
    triggerFieldFlash,
  };
}
