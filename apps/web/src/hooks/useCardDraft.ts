import { useCallback, useEffect, useRef, useState } from 'react';
import {
  normalizePos,
  sanitizeAnkiBoldText,
  stripHtmlToPlainText,
  stripIpaSlashes,
  type AnkiNoteItem,
  type LanguageDefinition,
  type LanguageProfile,
  type TempImageMedia,
} from '@ass/shared';
import { api } from '../lib/api';

export interface CardDraftFields {
  word: string;
  partOfSpeech: string;
  ipa: string;
  typeAnswer: string;
  pastForms: string;
  furigana: string;
  definition: string;
  exampleEn: string;
  exampleVi: string;
  customValues: Record<string, string>;
}

export interface CardDraftSnapshot extends CardDraftFields {
  cardImage: TempImageMedia | null;
}

export interface InboxBadgeState {
  target: string;
  source: string;
}

const EMPTY_DRAFT: CardDraftFields = {
  word: '',
  partOfSpeech: '',
  ipa: '',
  typeAnswer: '',
  pastForms: '',
  furigana: '',
  definition: '',
  exampleEn: '',
  exampleVi: '',
  customValues: {},
};

export function getNoteFieldValue(note: AnkiNoteItem, fieldName: string): string {
  if (!fieldName) return '';
  return note.fields[fieldName]?.value ?? '';
}

interface UseCardDraftOptions {
  enableGlobalPaste: boolean;
  onNotify: (text: string, tone?: 'success' | 'info' | 'error') => void;
  onFlashField: (fieldKey: string) => void;
}

export function useCardDraft({
  enableGlobalPaste,
  onNotify,
  onFlashField,
}: UseCardDraftOptions) {
  const [fields, setFields] = useState<CardDraftFields>(EMPTY_DRAFT);
  const [cardImage, setCardImage] = useState<TempImageMedia | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [lastInboxBadge, setLastInboxBadge] = useState<InboxBadgeState | null>(null);
  const pendingUndoImageTimerRef = useRef<number | null>(null);

  const cancelPendingUndoImageCleanup = useCallback(() => {
    if (pendingUndoImageTimerRef.current) {
      window.clearTimeout(pendingUndoImageTimerRef.current);
      pendingUndoImageTimerRef.current = null;
    }
  }, []);

  const scheduleDelayedImageDelete = useCallback(
    (imageId: string, delayMs = 5600) => {
      cancelPendingUndoImageCleanup();
      pendingUndoImageTimerRef.current = window.setTimeout(() => {
        pendingUndoImageTimerRef.current = null;
        void api.deleteTempImage(imageId).catch(() => {});
      }, delayMs);
    },
    [cancelPendingUndoImageCleanup],
  );

  const setField = useCallback(
    <K extends Exclude<keyof CardDraftFields, 'customValues'>>(
      key: K,
      value: CardDraftFields[K] | ((prev: CardDraftFields[K]) => CardDraftFields[K]),
    ) => {
      setFields((prev) => ({
        ...prev,
        [key]:
          typeof value === 'function'
            ? (value as (p: CardDraftFields[K]) => CardDraftFields[K])(prev[key])
            : value,
      }));
    },
    [],
  );

  const setCustomValue = useCallback((id: string, value: string) => {
    setFields((prev) => ({
      ...prev,
      customValues: { ...prev.customValues, [id]: value },
    }));
  }, []);

  const hasContent = useCallback(
    () =>
      Boolean(
        fields.word.trim() ||
          fields.partOfSpeech.trim() ||
          fields.ipa.trim() ||
          fields.typeAnswer.trim() ||
          fields.pastForms.trim() ||
          fields.furigana.trim() ||
          fields.definition.trim() ||
          fields.exampleEn.trim() ||
          fields.exampleVi.trim() ||
          cardImage !== null ||
          Object.values(fields.customValues).some((v) => v.trim()),
      ),
    [cardImage, fields],
  );

  const captureSnapshot = useCallback(
    (): CardDraftSnapshot => ({
      ...fields,
      customValues: { ...fields.customValues },
      cardImage,
    }),
    [cardImage, fields],
  );

  const restoreSnapshot = useCallback(
    (snapshot: CardDraftSnapshot) => {
      cancelPendingUndoImageCleanup();
      const { cardImage: snapImg, ...rest } = snapshot;
      setFields({
        ...rest,
        customValues: { ...rest.customValues },
      });
      setCardImage(snapImg);
    },
    [cancelPendingUndoImageCleanup],
  );

  const clearDraft = useCallback(
    (deleteServerTempImages = true) => {
      cancelPendingUndoImageCleanup();
      setFields(EMPTY_DRAFT);
      setCardImage(null);
      setLastInboxBadge(null);
      if (deleteServerTempImages) {
        void api.clearTempImages().catch(() => {});
      }
    },
    [cancelPendingUndoImageCleanup],
  );

  const loadFromNote = useCallback(
    (note: AnkiNoteItem, profile: LanguageProfile, langDef: LanguageDefinition): string => {
      cancelPendingUndoImageCleanup();
      const m = profile.fieldMapping;
      const w = stripHtmlToPlainText(getNoteFieldValue(note, m.word));
      const rawPos = stripHtmlToPlainText(getNoteFieldValue(note, m.partOfSpeech));
      const pos = langDef.normalizePos ? normalizePos(rawPos) : rawPos;
      const rawIpa = stripHtmlToPlainText(getNoteFieldValue(note, m.ipa));
      const noteIpa = langDef.stripReadingSlashes ? stripIpaSlashes(rawIpa) : rawIpa;

      const loadedCustom: Record<string, string> = {};
      for (const cf of profile.customFields ?? []) {
        const rawVal = getNoteFieldValue(note, cf.ankiField);
        loadedCustom[cf.id] = cf.allowBold
          ? sanitizeAnkiBoldText(rawVal, false)
          : stripHtmlToPlainText(rawVal);
      }

      setFields({
        word: w,
        partOfSpeech: pos,
        ipa: noteIpa,
        typeAnswer: stripHtmlToPlainText(getNoteFieldValue(note, m.typeAnswer)),
        pastForms: stripHtmlToPlainText(getNoteFieldValue(note, m.pastForms)),
        furigana: stripHtmlToPlainText(getNoteFieldValue(note, m.furigana)),
        definition: sanitizeAnkiBoldText(getNoteFieldValue(note, m.definition), false),
        exampleEn: sanitizeAnkiBoldText(getNoteFieldValue(note, m.exampleEn), false),
        exampleVi: sanitizeAnkiBoldText(getNoteFieldValue(note, m.exampleVi), false),
        customValues: loadedCustom,
      });
      setCardImage(null);
      // Automatically delete any unused temp image when switching to another note
      void api.clearTempImages().catch(() => {});
      return w;
    },
    [cancelPendingUndoImageCleanup],
  );

  const uploadImageDataUrl = useCallback(
    async (dataUrl: string, filename?: string) => {
      cancelPendingUndoImageCleanup();
      setImageUploading(true);
      try {
        const uploaded = await api.uploadTempImage({ dataUrl, filename });
        setCardImage(uploaded);
        setLastInboxBadge(null);
        onFlashField('image');
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Không tải được hình ảnh.', 'error');
      } finally {
        setImageUploading(false);
      }
    },
    [cancelPendingUndoImageCleanup, onFlashField, onNotify],
  );

  const removeImage = useCallback(async () => {
    cancelPendingUndoImageCleanup();
    const id = cardImage?.id;
    setCardImage(null);
    setLastInboxBadge((curr) => (curr?.target === 'image' ? null : curr));
    if (id) {
      await api.deleteTempImage(id).catch(() => {});
    } else {
      await api.clearTempImages().catch(() => {});
    }
  }, [cancelPendingUndoImageCleanup, cardImage?.id]);

  const grabClipboardImage = useCallback(async () => {
    cancelPendingUndoImageCleanup();
    setImageUploading(true);
    try {
      const grabbed = await api.grabClipboardImage();
      setCardImage(grabbed);
      setLastInboxBadge({ target: 'image', source: 'Clipboard' });
      onFlashField('image');
      onNotify('Đã lấy ảnh từ Clipboard.', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không có hình ảnh trong Clipboard.',
        'error',
      );
    } finally {
      setImageUploading(false);
    }
  }, [cancelPendingUndoImageCleanup, onFlashField, onNotify]);

  // Allow Ctrl+V image paste anywhere in Create / Enrich Studio
  useEffect(() => {
    if (!enableGlobalPaste) return;
    const onGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((it) => it.type.startsWith('image/'));
      const file = imageItem?.getAsFile();
      if (!file) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          void uploadImageDataUrl(reader.result, file.name || 'pasted.png');
        }
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener('paste', onGlobalPaste);
    return () => window.removeEventListener('paste', onGlobalPaste);
  }, [enableGlobalPaste, uploadImageDataUrl]);

  return {
    fields,
    setField,
    setCustomValue,
    cardImage,
    setCardImage,
    imageUploading,
    lastInboxBadge,
    setLastInboxBadge,
    hasContent,
    captureSnapshot,
    restoreSnapshot,
    clearDraft,
    scheduleDelayedImageDelete,
    loadFromNote,
    uploadImageDataUrl,
    removeImage,
    grabClipboardImage,
  };
}
