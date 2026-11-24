import { useCallback, useState } from 'react';
import type { AnkiNoteItem, FieldMapping } from '@ass/shared';
import type { EnrichPreset } from '../components/EnrichQueueBar';
import { api } from '../lib/api';

interface UseEnrichQueueOptions {
  fieldMapping: FieldMapping;
  onLoadNote: (note: AnkiNoteItem) => void;
  onNotify: (text: string, tone?: 'success' | 'info' | 'error') => void;
}

export function useEnrichQueue({ fieldMapping, onLoadNote, onNotify }: UseEnrichQueueOptions) {
  const [enrichDeck, setEnrichDeck] = useState('');
  const [enrichPreset, setEnrichPreset] = useState<EnrichPreset>('missing_any_audio');
  const [customQuery, setCustomQuery] = useState('');
  const [enrichNotes, setEnrichNotes] = useState<AnkiNoteItem[]>([]);
  const [enrichIndex, setEnrichIndex] = useState(0);
  const [updatedNoteIds, setUpdatedNoteIds] = useState<Set<number>>(() => new Set());
  const [loadingNotes, setLoadingNotes] = useState(false);

  const buildQuery = useCallback((): string => {
    if (enrichPreset === 'custom') return customQuery.trim();
    const deckPart = enrichDeck ? `deck:"${enrichDeck}"` : '';
    const m = fieldMapping;
    let filterPart = '';
    if (enrichPreset === 'missing_word_audio' && m.wordAudio) {
      filterPart = `"${m.wordAudio}:"`;
    } else if (enrichPreset === 'missing_ex_audio' && m.exampleAudio) {
      filterPart = `"${m.exampleAudio}:"`;
    } else if (enrichPreset === 'missing_any_audio') {
      const parts = [
        m.wordAudio && `"${m.wordAudio}:"`,
        m.exampleAudio && `"${m.exampleAudio}:"`,
      ].filter(Boolean);
      filterPart = parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0] || '';
    } else if (enrichPreset === 'missing_ipa' && m.ipa) {
      filterPart = `"${m.ipa}:"`;
    }
    return [deckPart, filterPart].filter(Boolean).join(' ').trim() || 'deck:*';
  }, [customQuery, enrichDeck, enrichPreset, fieldMapping]);

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const q = buildQuery();
      const res = await api.findAnkiNotes(q, 100);
      setEnrichNotes(res.notes);
      setEnrichIndex(0);
      setUpdatedNoteIds(new Set());
      if (res.notes.length > 0) {
        onLoadNote(res.notes[0]);
        onNotify(`Đã tải ${res.notes.length} thẻ từ Anki.`, 'info');
      } else {
        onNotify('Không có thẻ nào khớp bộ lọc này.', 'info');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Không tải được thẻ từ Anki.', 'error');
    } finally {
      setLoadingNotes(false);
    }
  }, [buildQuery, onLoadNote, onNotify]);

  const selectIndex = useCallback(
    (nextIdx: number) => {
      if (nextIdx < 0 || nextIdx >= enrichNotes.length) return;
      setEnrichIndex(nextIdx);
      onLoadNote(enrichNotes[nextIdx]);
    },
    [enrichNotes, onLoadNote],
  );

  const markUpdated = useCallback((noteId: number) => {
    setUpdatedNoteIds((prev) => {
      const next = new Set(prev);
      next.add(noteId);
      return next;
    });
  }, []);

  return {
    enrichDeck,
    setEnrichDeck,
    enrichPreset,
    setEnrichPreset,
    customQuery,
    setCustomQuery,
    enrichNotes,
    setEnrichNotes,
    enrichIndex,
    setEnrichIndex,
    updatedNoteIds,
    loadingNotes,
    loadNotes,
    selectIndex,
    markUpdated,
  };
}
