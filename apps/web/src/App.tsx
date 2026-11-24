import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  autoBoldTargetWordInExample,
  buildJapaneseFurigana,
  cleanTextForTts,
  createDefaultLanguageProfile,
  DEFAULT_FIELD_VISIBILITY,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_SETTINGS,
  extractTypeAnswerFromExample,
  formatPosForAnki,
  formatPosWithGuideword,
  getLanguageDefinition,
  languageHasField,
  normalizePos,
  stripIpaSlashes,
  stripPosGuideword,
  type AnkiNoteItem,
  type AppSettings,
  type AudioTake,
  type DictionaryLookupResponse,
  type DictionarySyncEvent,
  type DownloadsFilterMode,
  type InboxMessage,
  type LanguageCode,
  type TempImageMedia,
  type ToggleableFieldKey,
} from '@ass/shared';
import { api } from './lib/api';
import { useToast } from './hooks/useToast';
import { useDownloadsAudio } from './hooks/useDownloadsAudio';
import { useDictAutoSync } from './hooks/useDictAutoSync';
import { useSseInbox } from './hooks/useSseInbox';
import { useEnrichQueue } from './hooks/useEnrichQueue';
import { getNoteFieldValue, useCardDraft } from './hooks/useCardDraft';
import { CardComposer } from './components/CardComposer';
import { CardPreviewModal } from './components/CardPreviewModal';
import { DictionaryViewer } from './components/DictionaryViewer';
import { EnrichQueueBar } from './components/EnrichQueueBar';
import { GeminiExamplesModal } from './components/GeminiExamplesModal';
import { SettingsView, type SettingsSection } from './components/SettingsView';
import { StudioHeader, type AppTab } from './components/StudioHeader';
import { ToastBanner } from './components/ToastBanner';
import { StickyActionDock } from './components/StickyActionDock';

export function App() {
  const [tab, setTab] = useState<AppTab>('create');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('anki');
  const [geminiModalOpen, setGeminiModalOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ankiStatus, setAnkiStatus] = useState<{ connected: boolean; version?: number }>({
    connected: false,
  });
  const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
  const [targetDeck, setTargetDeck] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const wordInputRef = useRef<HTMLInputElement | null>(null);

  const { toast, showToast, dismissToast, flashField, triggerFieldFlash } = useToast();

  // Card draft & image state
  const draft = useCardDraft({
    enableGlobalPaste: tab !== 'settings',
    onNotify: showToast,
    onFlashField: triggerFieldFlash,
  });

  // Dictionary lookup state
  const [dictLoading, setDictLoading] = useState(false);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [dictData, setDictData] = useState<DictionaryLookupResponse | null>(null);
  const [selectedSenses, setSelectedSenses] = useState<
    Array<{ id: string; text: string; pos?: string; guideword?: string }>
  >([]);

  // OpenAI Word Audio takes state
  const [wordTakes, setWordTakes] = useState<AudioTake[]>([]);
  const [selectedWordTakeId, setSelectedWordTakeId] = useState<string | null>(null);
  const [wordAudioLoading, setWordAudioLoading] = useState(false);
  const [wordAudioError, setWordAudioError] = useState<string | null>(null);
  const [wordModelOverride, setWordModelOverride] = useState<string>('gpt-4o-mini-tts');
  const [wordSpeedOverride, setWordSpeedOverride] = useState(1.0);

  // Reusable download folder scanners
  const wordDownloads = useDownloadsAudio({
    kind: 'word',
    initialFilter: 'cambridge_audio',
    onNotify: showToast,
  });
  const exampleDownloads = useDownloadsAudio({
    kind: 'example',
    initialFilter: 'elevenlabs_only',
    onNotify: showToast,
  });

  // Extension background auto-sync state machine
  const {
    autoSyncMessage,
    triggerDictAutoSync,
    clearAutoSyncState,
    scheduleChainSync,
    resetWordSyncHistory,
  } = useDictAutoSync({
    cambridgeMode: settings.cambridgeMode || 'english',
    onNotify: showToast,
    onNotFound: useCallback((site: 'cambridge' | 'oxford', missingWord: string) => {
      if (site === 'cambridge') {
        setDictData((prev) =>
          prev
            ? {
                ...prev,
                entryError: `Không tìm thấy mục từ "${missingWord}" trên Cambridge Dictionary.`,
              }
            : prev,
        );
      }
    }, []),
  });

  const activeLang: LanguageCode = settings.activeLanguage || 'en';
  const activeLangDef = useMemo(() => getLanguageDefinition(activeLang), [activeLang]);
  const activeProfile = useMemo(
    () => settings.languageProfiles?.[activeLang] ?? createDefaultLanguageProfile(activeLang),
    [activeLang, settings.languageProfiles],
  );

  const refreshAnkiStatus = useCallback(async () => {
    try {
      const status = await api.getAnkiStatus();
      setAnkiStatus(status);
      if (status.connected) {
        const meta = await api.getAnkiMeta();
        setAnkiDecks(meta.decks);
      }
    } catch {
      setAnkiStatus({ connected: false });
    }
  }, []);

  const handleLookup = useCallback(
    async (targetWord: string, refresh = false, langOverride?: LanguageCode) => {
      const clean = targetWord.trim();
      if (!clean) return;
      const lookupLang = langOverride ?? activeLang;
      const lookupLangDef = getLanguageDefinition(lookupLang);
      clearAutoSyncState();
      if (lookupLang === 'en') resetWordSyncHistory(clean);
      if (wordDownloads.filter === 'cambridge_audio') wordDownloads.clearSelection(true);

      setDictLoading(true);
      try {
        const res = await api.lookupDictionary(clean, lookupLang, refresh);
        setDictData(res);
        setSelectedSenses([]);

        const readingItems = res.readings ?? [];
        if (readingItems.length > 0) {
          const matched =
            (lookupLangDef.normalizePos && draft.fields.partOfSpeech
              ? readingItems.find(
                  (r) => normalizePos(r.pos) === normalizePos(draft.fields.partOfSpeech),
                )
              : undefined) ?? readingItems[0];
          const formattedReading = lookupLangDef.stripReadingSlashes
            ? stripIpaSlashes(matched.reading)
            : matched.reading;
          draft.setField('ipa', formattedReading);
          if (!draft.fields.partOfSpeech && matched.pos) {
            draft.setField('partOfSpeech', matched.pos);
          }

          if (languageHasField(lookupLang, 'pastForms')) {
            const matchedPastForms =
              matched.autoFields?.pastForms ||
              readingItems.find((r) => r.autoFields?.pastForms)?.autoFields?.pastForms ||
              '';
            if (tab !== 'enrich') {
              draft.setField('pastForms', matchedPastForms);
            } else if (matchedPastForms) {
              draft.setField('pastForms', (curr) => (curr.trim() ? curr : matchedPastForms));
            }
          }
          if (languageHasField(lookupLang, 'furigana')) {
            const matchedFurigana =
              matched.autoFields?.furigana || buildJapaneseFurigana(clean, formattedReading);
            if (tab !== 'enrich') {
              draft.setField('furigana', matchedFurigana);
            } else if (matchedFurigana) {
              draft.setField('furigana', (curr) => (curr.trim() ? curr : matchedFurigana));
            }
          }
        } else {
          if (tab !== 'enrich') {
            draft.setField('pastForms', '');
            draft.setField('furigana', '');
          }
          const entryWithReading = res.entries.find((e) => e.reading);
          if (entryWithReading?.reading) {
            const val = lookupLangDef.stripReadingSlashes
              ? stripIpaSlashes(entryWithReading.reading)
              : entryWithReading.reading;
            draft.setField('ipa', val);
            if (languageHasField(lookupLang, 'furigana')) {
              const fg =
                entryWithReading.autoFields?.furigana || buildJapaneseFurigana(clean, val);
              if (tab !== 'enrich' || fg) draft.setField('furigana', fg);
            }
          }
          if (!draft.fields.partOfSpeech && res.entries[0]?.pos) {
            draft.setField('partOfSpeech', res.entries[0].pos);
          }
        }

        if (lookupLang === 'en') {
          const isFallbackOnly =
            res.entries.length > 0 && res.entries.every((e) => e.id.startsWith('fdict_'));
          const hasNoCambridgeEntries = res.entries.length === 0;
          const hasNoOxfordEntries = (res.oxford?.entries?.length ?? 0) === 0;
          if (hasNoCambridgeEntries || isFallbackOnly) {
            triggerDictAutoSync('cambridge', clean, res.primaryUrl, refresh);
          } else if (hasNoOxfordEntries) {
            triggerDictAutoSync('oxford', clean, res.secondaryUrl || '', refresh);
          }
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Lỗi khi tra từ điển.', 'error');
      } finally {
        setDictLoading(false);
      }
    },
    [
      activeLang,
      clearAutoSyncState,
      draft,
      resetWordSyncHistory,
      showToast,
      tab,
      triggerDictAutoSync,
      wordDownloads,
    ],
  );

  const loadNoteIntoEditor = useCallback(
    (note: AnkiNoteItem) => {
      const w = draft.loadFromNote(note, activeProfile, activeLangDef);
      setWordTakes([]);
      setSelectedWordTakeId(null);
      wordDownloads.clearSelection(wordDownloads.filter === 'cambridge_audio');
      exampleDownloads.clearSelection(false);
      setWordAudioError(null);
      setSelectedSenses([]);

      if (w) {
        void handleLookup(w);
      } else {
        void api.clearCambridgeAudios().catch(() => {});
        setDictData(null);
      }
    },
    [activeLangDef, activeProfile, draft, exampleDownloads, handleLookup, wordDownloads],
  );

  const enrichQueue = useEnrichQueue({
    fieldMapping: activeProfile.fieldMapping,
    onLoadNote: loadNoteIntoEditor,
    onNotify: showToast,
  });

  // Load settings & status on mount; clear any leftover temporary Cambridge audio & unused temp images
  useEffect(() => {
    void api.clearCambridgeAudios().catch(() => {});
    void api.clearTempImages().catch(() => {});
    api
      .getSettings()
      .then((s) => {
        setSettings(s);
        setWordModelOverride(s.openai.model);
        setWordSpeedOverride(s.openai.speed);
        const initialWordFilter: DownloadsFilterMode =
          s.wordAudioDownloads.filterMode || 'cambridge_audio';
        const initialExampleFilter: DownloadsFilterMode =
          s.elevenlabsDownloads.filterMode === 'all_audio' ? 'all_audio' : 'elevenlabs_only';
        wordDownloads.setFilter(initialWordFilter);
        wordDownloads.setDir(s.wordAudioDownloads.downloadsDir);
        exampleDownloads.setFilter(initialExampleFilter);
        exampleDownloads.setDir(s.elevenlabsDownloads.downloadsDir);
        enrichQueue.setEnrichDeck(s.defaultDeck);
        setTargetDeck(s.defaultDeck);
        void exampleDownloads.refresh(initialExampleFilter);
        if (s.wordAudioSource === 'folder_scan') {
          if (initialWordFilter === 'cambridge_audio') {
            wordDownloads.clearSelection(true);
          } else {
            void wordDownloads.refresh(initialWordFilter);
          }
        }
      })
      .catch(() => {
        void exampleDownloads.refresh();
      });
    void refreshAnkiStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshAnkiStatus]);

  // SSE stream handlers
  const handleInboxMessage = useCallback(
    (msg: InboxMessage) => {
      const sourceHost = msg.sourceUrl
        ? new URL(msg.sourceUrl).hostname.replace(/^www\./, '')
        : 'Extension';

      if (msg.target === 'word') {
        draft.setField('word', msg.text);
        draft.setLastInboxBadge({ target: 'word', source: sourceHost });
        triggerFieldFlash('word');
        showToast(`Đã nhận từ "${msg.text}" từ ${sourceHost}`, 'info');
        void handleLookup(msg.text);
      } else if (msg.target === 'example_en') {
        const formattedExample = settings.gemini.boldTargetWord
          ? autoBoldTargetWordInExample(msg.text, draft.fields.word, {
              lang: activeLang,
              pastForms: draft.fields.pastForms,
            })
          : msg.text;
        draft.setField('exampleEn', (prev) =>
          msg.mode === 'append' && prev.trim()
            ? `${prev.trim()}\n${formattedExample}`
            : formattedExample,
        );
        draft.setLastInboxBadge({ target: 'example_en', source: sourceHost });
        triggerFieldFlash('example_en');
        showToast(`Đã nhận Example (EN) từ ${sourceHost}`, 'success');
      } else if (msg.target === 'example_vi') {
        draft.setField('exampleVi', (prev) =>
          msg.mode === 'append' && prev.trim() ? `${prev.trim()}\n${msg.text}` : msg.text,
        );
        draft.setLastInboxBadge({ target: 'example_vi', source: sourceHost });
        triggerFieldFlash('example_vi');
        showToast(`Đã nhận Example (VI) từ ${sourceHost}`, 'success');
      } else if (msg.target === 'definition') {
        draft.setField('definition', (prev) =>
          msg.mode === 'append' && prev.trim() ? `${prev.trim()}\n${msg.text}` : msg.text,
        );
        triggerFieldFlash('definition');
        showToast(`Đã nhận định nghĩa từ ${sourceHost}`, 'success');
      } else if (msg.target === 'ipa') {
        const clean = stripIpaSlashes(msg.text);
        draft.setField('ipa', clean);
        triggerFieldFlash('ipa');
        showToast(`Đã nhận IPA "${clean}" từ ${sourceHost}`, 'success');
      }
    },
    [activeLang, draft, handleLookup, settings.gemini.boldTargetWord, showToast, triggerFieldFlash],
  );

  const handleInboxImage = useCallback(
    (img: TempImageMedia) => {
      const sourceLabel = img.sourceUrl
        ? new URL(img.sourceUrl).hostname.replace(/^www\./, '')
        : img.sourceTitle || 'Clipboard';
      draft.setCardImage(img);
      draft.setLastInboxBadge({ target: 'image', source: sourceLabel });
      triggerFieldFlash('image');
      showToast(`Đã tự động lấy ảnh từ ${sourceLabel}`, 'success');
    },
    [draft, showToast, triggerFieldFlash],
  );

  const handleDictionarySync = useCallback(
    (sync: DictionarySyncEvent) => {
      if (sync.word) {
        draft.setField('word', (curr) => (curr.trim() ? curr : sync.word));
      }

      if (sync.source === 'weblio' && sync.unified) {
        const synced = sync.unified;
        setDictData({ ...synced, cached: false });
        setSelectedSenses([]);
        const rd = synced.readings[0]?.reading || synced.entries[0]?.reading || '';
        if (rd) {
          draft.setField('ipa', rd);
          const fg =
            synced.readings[0]?.autoFields?.furigana || buildJapaneseFurigana(synced.word, rd);
          if (fg) draft.setField('furigana', fg);
        }
        if (synced.entries[0]?.pos) {
          draft.setField('partOfSpeech', (curr) => curr || synced.entries[0].pos);
        }
        showToast(`Đã đồng bộ Weblio "${synced.word}"${rd ? ` (${rd})` : ''}!`, 'success');
      } else if (sync.source === 'cambridge' && sync.unified) {
        const synced = sync.unified;
        clearAutoSyncState();
        setDictData({ ...synced, cached: false });
        setSelectedSenses([]);
        if (synced.entries[0]?.pos) {
          draft.setField('partOfSpeech', (curr) => curr || synced.entries[0].pos);
        }
        const preferredReading =
          synced.readings.find((r) => r.label === 'US') ??
          synced.readings[0] ??
          (() => {
            const eUs = synced.entries.find((e) => e.reading);
            if (eUs?.reading) return { reading: eUs.reading, label: 'US' as const };
            const eUk = synced.entries.find((e) => e.altReading);
            if (eUk?.altReading) return { reading: eUk.altReading, label: 'UK' as const };
            return undefined;
          })();
        const ipaVal = stripIpaSlashes(preferredReading?.reading || '');
        const ukSet = new Set(
          [
            ...synced.readings
              .filter((r) => r.label === 'UK')
              .map((r) => stripIpaSlashes(r.reading)),
            ...synced.entries.map((e) => stripIpaSlashes(e.altReading || '')),
          ].filter(Boolean),
        );
        const hasOxfordUs = Boolean(synced.oxford?.entries.some((e) => e.usIpa));
        if (ipaVal) {
          draft.setField('ipa', (curr) => {
            const cleanCurr = stripIpaSlashes(curr);
            if (!cleanCurr) return ipaVal;
            if (preferredReading?.label === 'US' && ukSet.has(cleanCurr)) return ipaVal;
            if (!hasOxfordUs) return ipaVal;
            return curr;
          });
        }
        showToast(
          `Đã đồng bộ Cambridge "${synced.word}" (${synced.entries.length} mục từ)!`,
          'success',
        );

        if (
          settings.wordAudioSource === 'folder_scan' &&
          settings.wordAudioDownloads.filterMode === 'cambridge_audio'
        ) {
          wordDownloads.setFilter('cambridge_audio');
          void wordDownloads.refresh('cambridge_audio', {
            autoSelectUs: true,
            targetWord: synced.word,
          });
        }

        if ((synced.oxford?.entries?.length ?? 0) === 0) {
          scheduleChainSync('oxford', synced.word, synced.secondaryUrl || '', 300);
        }
      } else if (sync.source === 'oxford' && sync.unified) {
        const synced = sync.unified;
        clearAutoSyncState();
        setDictData((prev) => {
          if (
            prev &&
            prev.lang === 'en' &&
            prev.word.trim().toLowerCase() === synced.word.trim().toLowerCase() &&
            synced.entries.length === 0 &&
            prev.entries.length > 0
          ) {
            return {
              ...synced,
              cached: false,
              entries: prev.entries,
              cambridge: prev.cambridge,
              primaryUrl: prev.primaryUrl || synced.primaryUrl,
            };
          }
          return { ...synced, cached: false };
        });
        const oxIpa = stripIpaSlashes(
          (synced.readings.find((r) => r.label === 'US') ?? synced.readings[0])?.reading || '',
        );
        const oxPastForms =
          synced.readings.find((r) => r.autoFields?.pastForms)?.autoFields?.pastForms || '';
        if (oxIpa) {
          draft.setField('ipa', oxIpa);
          if (synced.readings[0]?.pos) {
            draft.setField('partOfSpeech', (curr) => curr || synced.readings[0].pos);
          }
        }
        if (oxPastForms) draft.setField('pastForms', oxPastForms);
        showToast(
          oxPastForms
            ? `Đã đồng bộ Oxford (${oxIpa || 'IPA'} · ${oxPastForms})!`
            : `Đã đồng bộ Oxford US IPA "${oxIpa || ''}"!`,
          'success',
        );
      }
    },
    [
      clearAutoSyncState,
      draft,
      scheduleChainSync,
      settings.wordAudioDownloads.filterMode,
      settings.wordAudioSource,
      showToast,
      wordDownloads,
    ],
  );

  const sseConnected = useSseInbox({
    onInbox: handleInboxMessage,
    onInboxImage: handleInboxImage,
    onDictionarySync: handleDictionarySync,
    onDownloadsUpdated: exampleDownloads.handleSseScan,
    onWordDownloadsUpdated: wordDownloads.handleSseScan,
  });

  const currentEnrichNote: AnkiNoteItem | null =
    tab === 'enrich' && enrichQueue.enrichNotes.length > 0
      ? (enrichQueue.enrichNotes[enrichQueue.enrichIndex] ?? null)
      : null;

  const resetEditor = useCallback(
    (withUndo = false) => {
      const hadContent = draft.hasContent();
      const snapshot = draft.captureSnapshot();
      const hasUndoableImage = Boolean(withUndo && hadContent && snapshot.cardImage?.id);

      draft.clearDraft(!hasUndoableImage);
      if (hasUndoableImage && snapshot.cardImage?.id) {
        // Delete the temp image file automatically if the user does not click Undo within 5.6s
        draft.scheduleDelayedImageDelete(snapshot.cardImage.id, 5600);
      }

      setDictData(null);
      setSelectedSenses([]);
      clearAutoSyncState();
      setWordTakes([]);
      setSelectedWordTakeId(null);
      wordDownloads.clearSelection(wordDownloads.filter === 'cambridge_audio');
      exampleDownloads.clearSelection(false);
      void api.clearCambridgeAudios().catch(() => {});
      setWordAudioError(null);

      if (withUndo && hadContent) {
        showToast('Đã xóa trắng biểu mẫu.', 'info', {
          label: 'Hoàn tác',
          onClick: () => {
            draft.restoreSnapshot(snapshot);
            dismissToast();
          },
        });
      }
    },
    [clearAutoSyncState, dismissToast, draft, exampleDownloads, showToast, wordDownloads],
  );

  const handleSwitchLanguage = useCallback(
    async (nextLang: LanguageCode) => {
      if (nextLang === activeLang) return;
      const nextProfile =
        settings.languageProfiles?.[nextLang] ?? createDefaultLanguageProfile(nextLang);
      setSettings((prev) => ({
        ...prev,
        activeLanguage: nextLang,
        defaultDeck: nextProfile.defaultDeck,
        defaultNoteType: nextProfile.defaultNoteType,
        posFormat: nextProfile.posFormat,
        fieldMapping: nextProfile.fieldMapping,
        visibleFields: nextProfile.visibleFields,
        customFields: nextProfile.customFields,
      }));
      setTargetDeck(nextProfile.defaultDeck);
      enrichQueue.setEnrichDeck(nextProfile.defaultDeck);
      enrichQueue.setEnrichNotes([]);
      resetEditor(false);
      showToast(`Đã chuyển sang chế độ ${getLanguageDefinition(nextLang).name}.`, 'info');
      try {
        const updated = await api.saveSettings({ activeLanguage: nextLang });
        setSettings(updated);
      } catch {
        // ignore save error, local state already switched
      }
    },
    [activeLang, enrichQueue, resetEditor, settings.languageProfiles, showToast],
  );

  const handleSelectPos = (nextPos: string) => {
    let resolvedPos = nextPos;
    if (activeLangDef.normalizePos && nextPos.trim() && !/\([^)]*\)\s*$/.test(nextPos.trim())) {
      const targetNorm = normalizePos(nextPos);
      const matchingGuidewords = selectedSenses
        .filter((s) => !s.pos || normalizePos(s.pos) === targetNorm)
        .map((s) => s.guideword || '')
        .filter(Boolean);
      if (matchingGuidewords.length > 0) {
        resolvedPos = formatPosWithGuideword(nextPos, matchingGuidewords);
      }
    }
    draft.setField('partOfSpeech', resolvedPos);
    const norm = activeLangDef.normalizePos ? normalizePos(resolvedPos) : resolvedPos.trim();
    const rdMatch = dictData?.readings.find((r) =>
      activeLangDef.normalizePos ? normalizePos(r.pos) === norm : r.pos === norm,
    );
    if (rdMatch) {
      draft.setField(
        'ipa',
        activeLangDef.stripReadingSlashes ? stripIpaSlashes(rdMatch.reading) : rdMatch.reading,
      );
      if (rdMatch.autoFields?.pastForms) draft.setField('pastForms', rdMatch.autoFields.pastForms);
      if (rdMatch.autoFields?.furigana) draft.setField('furigana', rdMatch.autoFields.furigana);
      return;
    }
    const entryMatch = dictData?.entries.find(
      (e) =>
        (activeLangDef.normalizePos ? normalizePos(e.pos) === norm : e.pos === norm) &&
        Boolean(e.reading),
    );
    if (entryMatch?.reading) {
      draft.setField(
        'ipa',
        activeLangDef.stripReadingSlashes
          ? stripIpaSlashes(entryMatch.reading)
          : entryMatch.reading,
      );
      if (entryMatch.autoFields?.furigana) {
        draft.setField('furigana', entryMatch.autoFields.furigana);
      }
    }
  };

  const handleToggleCambridgeSense = (
    senseId: string,
    senseText: string,
    entryPos: string,
    guideword?: string,
  ) => {
    const exists = selectedSenses.some((s) => s.id === senseId);
    const next = exists
      ? selectedSenses.filter((s) => s.id !== senseId)
      : [...selectedSenses, { id: senseId, text: senseText, pos: entryPos, guideword }];

    setSelectedSenses(next);
    draft.setField('definition', next.map((s) => s.text).join('\n'));

    if (activeLangDef.normalizePos) {
      const currentBasePos = stripPosGuideword(draft.fields.partOfSpeech);
      const posFieldVisible =
        activeProfile.visibleFields?.partOfSpeech ?? DEFAULT_FIELD_VISIBILITY.partOfSpeech;
      if (currentBasePos || (posFieldVisible && entryPos)) {
        const targetBasePos = !exists && entryPos ? entryPos : currentBasePos || entryPos;
        const matchingGuidewords = next
          .filter((s) => !s.pos || normalizePos(s.pos) === normalizePos(targetBasePos))
          .map((s) => s.guideword || '')
          .filter(Boolean);
        const nextPosValue = formatPosWithGuideword(targetBasePos, matchingGuidewords);
        if (nextPosValue) {
          if (normalizePos(targetBasePos) !== normalizePos(draft.fields.partOfSpeech)) {
            handleSelectPos(nextPosValue);
          } else {
            draft.setField('partOfSpeech', nextPosValue);
          }
        }
      }
    } else if (!draft.fields.partOfSpeech && entryPos) {
      handleSelectPos(entryPos);
    }
  };

  const handleClearSelectedSenses = () => {
    setSelectedSenses([]);
    draft.setField('definition', '');
    if (activeLangDef.normalizePos && draft.fields.partOfSpeech.trim()) {
      const basePos = stripPosGuideword(draft.fields.partOfSpeech);
      if (basePos !== draft.fields.partOfSpeech.trim()) {
        draft.setField('partOfSpeech', basePos);
      }
    }
  };

  const handleGenerateWordAudio = async () => {
    setWordAudioLoading(true);
    setWordAudioError(null);
    try {
      const take = await api.generateWordAudio({
        text: draft.fields.word,
        model: wordModelOverride,
        voice: activeProfile.ttsVoice || settings.openai.voice || 'alloy',
        speed: wordSpeedOverride,
        instructions: activeProfile.ttsInstructions || settings.openai.instructions,
      });
      setWordTakes((prev) => [...prev, take]);
      setSelectedWordTakeId(take.id);
    } catch (err) {
      setWordAudioError(err instanceof Error ? err.message : 'Lỗi tạo audio từ vựng.');
    } finally {
      setWordAudioLoading(false);
    }
  };

  const handleDeleteWordTake = async (id: string) => {
    await api.deleteAudioTake(id).catch(() => {});
    setWordTakes((prev) => prev.filter((t) => t.id !== id));
    if (selectedWordTakeId === id) setSelectedWordTakeId(null);
  };

  const handleOpenElevenLabsWithText = async () => {
    const clean = cleanTextForTts(draft.fields.exampleEn);
    const targetUrl = 'https://elevenlabs.io/app/speech-synthesis/text-to-speech';
    if (clean) {
      try {
        await api.sendElevenLabsHandoff(clean);
        showToast(
          'Đã gửi câu ví dụ sang ElevenLabs (Extension sẽ tự điền vào ô nhập).',
          'success',
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Không gửi được câu sang hàng đợi ElevenLabs.',
          'error',
        );
      }
    }
    window.open(targetUrl, 'ass_elevenlabs');
  };

  const handleLoadFallbackDictionary = async () => {
    const clean = draft.fields.word.trim();
    if (!clean) return;
    setFallbackLoading(true);
    try {
      const res = await api.lookupFallbackDictionary(clean, activeLang);
      setDictData((prev) => ({
        ...res,
        readings: res.readings.length > 0 ? res.readings : (prev?.readings ?? []),
      }));
      if (res.readings[0]?.reading) {
        const rd = activeLangDef.stripReadingSlashes
          ? stripIpaSlashes(res.readings[0].reading)
          : res.readings[0].reading;
        draft.setField('ipa', (curr) => (curr.trim() ? curr : rd));
        if (languageHasField(activeLang, 'furigana')) {
          const fg = res.readings[0].autoFields?.furigana || buildJapaneseFurigana(clean, rd);
          if (fg) draft.setField('furigana', (curr) => (curr.trim() ? curr : fg));
        }
      }
      if (res.entries.length > 0) {
        showToast(activeLangDef.fallbackToastMessage, 'info');
      } else if (res.entryError) {
        showToast(res.entryError, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không tải được nguồn dự phòng.', 'error');
    } finally {
      setFallbackLoading(false);
    }
  };

  const activeDeck = targetDeck || activeProfile.defaultDeck;

  const handleSaveCard = useCallback(
    async (advanceNext = false) => {
      if (!draft.fields.word.trim()) {
        showToast('Vui lòng nhập từ vựng trước khi lưu.', 'error');
        wordInputRef.current?.focus();
        return;
      }

      setSavingCard(true);
      try {
        const isUpdate = tab === 'enrich' && currentEnrichNote !== null;
        const vis = { ...DEFAULT_FIELD_VISIBILITY, ...(activeProfile.visibleFields ?? {}) };
        const isWordFolderMode = settings.wordAudioSource === 'folder_scan';
        const includeWordAudio = isUpdate || vis.wordAudio;
        const includeExampleAudio = isUpdate || vis.exampleAudio;
        const includeImage = isUpdate || vis.image;
        const hasNewWordAudio = includeWordAudio
          ? isWordFolderMode
            ? Boolean(wordDownloads.selectedFileId)
            : Boolean(selectedWordTakeId)
          : false;

        await api.saveCardToAnki({
          lang: activeLang,
          mode: isUpdate ? 'update' : 'create',
          noteId: isUpdate ? currentEnrichNote.noteId : undefined,
          deckName: activeDeck,
          modelName: isUpdate ? currentEnrichNote.modelName : activeProfile.defaultNoteType,
          values: {
            word: draft.fields.word,
            partOfSpeech: isUpdate || vis.partOfSpeech ? draft.fields.partOfSpeech : '',
            ipa: isUpdate || vis.ipa ? draft.fields.ipa : '',
            typeAnswer: isUpdate || vis.typeAnswer ? draft.fields.typeAnswer : '',
            pastForms:
              languageHasField(activeLang, 'pastForms') && (isUpdate || vis.pastForms)
                ? draft.fields.pastForms
                : '',
            furigana:
              languageHasField(activeLang, 'furigana') && (isUpdate || vis.furigana)
                ? draft.fields.furigana
                : '',
            definition: isUpdate || vis.definition ? draft.fields.definition : '',
            exampleEn: isUpdate || vis.exampleEn ? draft.fields.exampleEn : '',
            exampleVi: isUpdate || vis.exampleVi ? draft.fields.exampleVi : '',
          },
          customValues: draft.fields.customValues,
          imageTempId: includeImage ? (draft.cardImage?.id ?? null) : null,
          keepExistingImage: isUpdate && !draft.cardImage,
          wordAudioTakeId: includeWordAudio && !isWordFolderMode ? selectedWordTakeId : null,
          wordDownloadFileId:
            includeWordAudio && isWordFolderMode ? wordDownloads.selectedFileId : null,
          exampleDownloadFileId: includeExampleAudio ? exampleDownloads.selectedFileId : null,
          keepExistingWordAudio: isUpdate && !hasNewWordAudio,
          keepExistingExampleAudio: isUpdate && !exampleDownloads.selectedFileId,
        });

        if (exampleDownloads.selectedFileId && settings.elevenlabsDownloads.deleteSourceAfterSave) {
          void exampleDownloads.refresh();
        }
        if (isWordFolderMode && wordDownloads.filter === 'cambridge_audio') {
          wordDownloads.clearSelection(true);
        } else if (
          isWordFolderMode &&
          wordDownloads.selectedFileId &&
          settings.wordAudioDownloads.deleteSourceAfterSave
        ) {
          void wordDownloads.refresh();
        }

        if (isUpdate) {
          enrichQueue.markUpdated(currentEnrichNote.noteId);
          showToast(`Đã cập nhật thẻ "${draft.fields.word}" vào Anki!`, 'success');
          if (advanceNext && enrichQueue.enrichIndex + 1 < enrichQueue.enrichNotes.length) {
            enrichQueue.selectIndex(enrichQueue.enrichIndex + 1);
          }
        } else {
          showToast(`Đã tạo thẻ "${draft.fields.word}" thành công trong Anki!`, 'success');
          resetEditor(false);
          window.setTimeout(() => wordInputRef.current?.focus(), 60);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Lưu thẻ vào Anki thất bại.', 'error');
      } finally {
        setSavingCard(false);
      }
    },
    [
      activeDeck,
      activeLang,
      activeProfile.defaultNoteType,
      activeProfile.visibleFields,
      currentEnrichNote,
      draft.cardImage,
      draft.fields,
      enrichQueue,
      exampleDownloads,
      resetEditor,
      selectedWordTakeId,
      settings.elevenlabsDownloads.deleteSourceAfterSave,
      settings.wordAudioDownloads.deleteSourceAfterSave,
      settings.wordAudioSource,
      showToast,
      tab,
      wordDownloads,
    ],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (tab === 'settings') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!savingCard) {
          const isEnrich = tab === 'enrich' && currentEnrichNote !== null;
          void handleSaveCard(isEnrich);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        wordInputRef.current?.focus();
        wordInputRef.current?.select();
        return;
      }

      if (tab === 'enrich' && enrichQueue.enrichNotes.length > 0 && e.altKey) {
        if (e.key === 'ArrowLeft' && enrichQueue.enrichIndex > 0) {
          e.preventDefault();
          enrichQueue.selectIndex(enrichQueue.enrichIndex - 1);
        } else if (
          e.key === 'ArrowRight' &&
          enrichQueue.enrichIndex < enrichQueue.enrichNotes.length - 1
        ) {
          e.preventDefault();
          enrichQueue.selectIndex(enrichQueue.enrichIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentEnrichNote, enrichQueue, handleSaveCard, savingCard, tab]);

  const existingWordAudio = currentEnrichNote
    ? getNoteFieldValue(currentEnrichNote, activeProfile.fieldMapping.wordAudio)
    : '';
  const existingExampleAudio = currentEnrichNote
    ? getNoteFieldValue(currentEnrichNote, activeProfile.fieldMapping.exampleAudio)
    : '';
  const existingImage = currentEnrichNote
    ? getNoteFieldValue(currentEnrichNote, activeProfile.fieldMapping.image)
    : '';

  const readingOptions = dictData?.readings ?? [];
  const hasOxfordPastForms = useMemo(
    () => readingOptions.some((r) => Boolean(r.autoFields?.pastForms)),
    [readingOptions],
  );
  const formattedPosPreview = useMemo(
    () =>
      activeLangDef.supportsPosFormat
        ? formatPosForAnki(draft.fields.partOfSpeech, activeProfile.posFormat)
        : '',
    [activeLangDef.supportsPosFormat, activeProfile.posFormat, draft.fields.partOfSpeech],
  );

  // Extract the vocabulary word (or its inflected/conjugated variant) from the active example sentence
  const extractedTypeAnswer = useMemo(
    () =>
      extractTypeAnswerFromExample(draft.fields.word, draft.fields.exampleEn, {
        lang: activeLang,
        pastForms: draft.fields.pastForms,
      }),
    [activeLang, draft.fields.exampleEn, draft.fields.pastForms, draft.fields.word],
  );

  const lastAutoTypeAnswerRef = useRef<string>('');

  // Automatically sync Type Answer from the example sentence whenever the extracted variant updates,
  // unless the user manually typed an unrelated custom value.
  useEffect(() => {
    const curr = draft.fields.typeAnswer.trim();
    const cleanWord = draft.fields.word.trim();
    if (!cleanWord) {
      if (curr === lastAutoTypeAnswerRef.current && curr !== '') {
        draft.setField('typeAnswer', '');
      }
      lastAutoTypeAnswerRef.current = '';
      return;
    }

    const nextAuto = extractedTypeAnswer || cleanWord;
    const isAutoManaged =
      curr === '' ||
      curr === lastAutoTypeAnswerRef.current ||
      curr.toLowerCase() === cleanWord.toLowerCase();

    if (isAutoManaged && curr !== nextAuto) {
      draft.setField('typeAnswer', nextAuto);
      lastAutoTypeAnswerRef.current = nextAuto;
    } else if (curr === nextAuto) {
      lastAutoTypeAnswerRef.current = nextAuto;
    }
  }, [draft, extractedTypeAnswer]);

  const hasWordAudioSelected =
    settings.wordAudioSource === 'folder_scan'
      ? Boolean(wordDownloads.selectedFileId)
      : Boolean(selectedWordTakeId);

  const effectiveVisibleFields = useMemo(
    () => ({ ...DEFAULT_FIELD_VISIBILITY, ...(activeProfile.visibleFields ?? {}) }),
    [activeProfile.visibleFields],
  );

  const isFieldShown = useCallback(
    (key: ToggleableFieldKey, currentValue?: string) => {
      if (effectiveVisibleFields[key]) return true;
      if (tab === 'enrich' && currentEnrichNote && currentValue?.trim()) return true;
      return false;
    },
    [currentEnrichNote, effectiveVisibleFields, tab],
  );

  const visibility = {
    pos: isFieldShown('partOfSpeech', draft.fields.partOfSpeech),
    ipa: isFieldShown('ipa', draft.fields.ipa),
    typeAnswer: isFieldShown('typeAnswer', draft.fields.typeAnswer),
    pastForms:
      languageHasField(activeLang, 'pastForms') &&
      isFieldShown('pastForms', draft.fields.pastForms),
    furigana:
      languageHasField(activeLang, 'furigana') && isFieldShown('furigana', draft.fields.furigana),
    definition: isFieldShown('definition', draft.fields.definition),
    exampleEn: isFieldShown('exampleEn', draft.fields.exampleEn),
    exampleVi: isFieldShown('exampleVi', draft.fields.exampleVi),
    image: isFieldShown('image', existingImage || draft.cardImage?.id),
    wordAudio: isFieldShown('wordAudio', existingWordAudio),
    exampleAudio: isFieldShown('exampleAudio', existingExampleAudio),
  };

  const fieldMetaMap = useMemo(
    () => new Map(activeLangDef.fields.map((f) => [f.key, f])),
    [activeLangDef],
  );

  const fieldLabels = useMemo(() => {
    const m = activeProfile.fieldMapping;
    const fallback = (key: keyof typeof m, def: string) =>
      m[key].trim() || fieldMetaMap.get(key)?.defaultAnkiField || def;
    return {
      word: fallback('word', 'Word'),
      partOfSpeech: fallback('partOfSpeech', 'Part of Speech'),
      ipa: fallback('ipa', 'IPA'),
      typeAnswer: fallback('typeAnswer', 'Type Answer'),
      pastForms: fallback('pastForms', 'Past Simple and Past Participle'),
      furigana: fallback('furigana', 'Furigana'),
      definition: fallback('definition', 'Definition'),
      exampleEn: fallback('exampleEn', 'Example'),
      exampleVi: fallback('exampleVi', 'Example (VI)'),
      image: fallback('image', 'Image'),
      wordAudio: fallback('wordAudio', 'Word Audio'),
      exampleAudio: fallback('exampleAudio', 'Example Audio'),
    };
  }, [activeProfile.fieldMapping, fieldMetaMap]);

  const needsSetup = !ankiStatus.connected || !activeDeck || !activeProfile.defaultNoteType;
  const activeVoiceLabel = settings.openai.voice || 'alloy';
  const wordAudioBadgeSummary =
    settings.wordAudioSource === 'folder_scan'
      ? 'Quét thư mục Từ vựng'
      : `OpenAI (${activeVoiceLabel})`;

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <StudioHeader
        tab={tab}
        activeLang={activeLang}
        activeLangDef={activeLangDef}
        wordAudioBadgeSummary={wordAudioBadgeSummary}
        enrichCount={enrichQueue.enrichNotes.length}
        missingOpenAIKey={settings.wordAudioSource === 'openai_tts' && !settings.openai.hasApiKey}
        sseConnected={sseConnected}
        ankiStatus={ankiStatus}
        shortcutsOpen={shortcutsOpen}
        onChangeTab={setTab}
        onSwitchLanguage={(code) => void handleSwitchLanguage(code)}
        onRefreshAnkiStatus={() => void refreshAnkiStatus()}
        onToggleShortcuts={() => setShortcutsOpen((v) => !v)}
        onCloseShortcuts={() => setShortcutsOpen(false)}
      />

      <ToastBanner toast={toast} onDismiss={dismissToast} />

      <main className="mx-auto max-w-[1600px] px-4 pt-4 pb-24">
        {tab === 'settings' ? (
          <SettingsView
            settings={settings}
            initialSection={settingsSection}
            onSettingsSaved={(next) => {
              const prevMode = settings.cambridgeMode || 'english';
              const nextMode = next.cambridgeMode || 'english';
              setSettings(next);
              setWordModelOverride(next.openai.model);
              setWordSpeedOverride(next.openai.speed);
              wordDownloads.setFilter(next.wordAudioDownloads.filterMode);
              wordDownloads.setDir(next.wordAudioDownloads.downloadsDir);
              exampleDownloads.setFilter(next.elevenlabsDownloads.filterMode);
              exampleDownloads.setDir(next.elevenlabsDownloads.downloadsDir);
              if (!enrichQueue.enrichDeck) enrichQueue.setEnrichDeck(next.defaultDeck);
              setTargetDeck(next.defaultDeck);
              void exampleDownloads.refresh(next.elevenlabsDownloads.filterMode);
              if (next.wordAudioSource === 'folder_scan') {
                void wordDownloads.refresh(next.wordAudioDownloads.filterMode);
              }
              if (prevMode !== nextMode && draft.fields.word.trim()) {
                resetWordSyncHistory(draft.fields.word.trim());
                setDictData(null);
              }
            }}
            onAnkiStatusRefresh={() => void refreshAnkiStatus()}
          />
        ) : (
          <div className="space-y-4">
            {needsSetup && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    {!ankiStatus.connected
                      ? 'Chưa kết nối được Anki Desktop (hãy mở Anki và cài add-on AnkiConnect).'
                      : 'Bạn chưa chọn Deck hoặc Note Type mặc định để lưu thẻ.'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!ankiStatus.connected && (
                    <button
                      type="button"
                      onClick={() => void refreshAnkiStatus()}
                      className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100/60"
                    >
                      Thử kết nối lại
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTab('settings')}
                    className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                  >
                    Mở Cài đặt
                  </button>
                </div>
              </div>
            )}

            {tab === 'enrich' && (
              <EnrichQueueBar
                ankiDecks={ankiDecks}
                enrichDeck={enrichQueue.enrichDeck}
                enrichPreset={enrichQueue.enrichPreset}
                customQuery={enrichQueue.customQuery}
                enrichNotes={enrichQueue.enrichNotes}
                enrichIndex={enrichQueue.enrichIndex}
                updatedNoteIds={enrichQueue.updatedNoteIds}
                loadingNotes={enrichQueue.loadingNotes}
                fieldMapping={activeProfile.fieldMapping}
                onChangeDeck={enrichQueue.setEnrichDeck}
                onChangePreset={enrichQueue.setEnrichPreset}
                onChangeCustomQuery={enrichQueue.setCustomQuery}
                onLoadNotes={() => void enrichQueue.loadNotes()}
                onSelectIndex={enrichQueue.selectIndex}
              />
            )}

            <div className="grid gap-4 lg:grid-cols-12">
              <CardComposer
                activeLang={activeLang}
                activeLangDef={activeLangDef}
                fieldMetaMap={fieldMetaMap}
                fieldLabels={fieldLabels}
                visibility={visibility}
                fields={draft.fields}
                customFields={activeProfile.customFields ?? []}
                wordInputRef={wordInputRef}
                flashField={flashField}
                lastInboxBadge={draft.lastInboxBadge}
                dictLoading={dictLoading}
                dictData={dictData}
                hasOxfordPastForms={hasOxfordPastForms}
                formattedPosPreview={formattedPosPreview}
                extractedTypeAnswer={extractedTypeAnswer}
                cardImage={draft.cardImage}
                existingImage={existingImage}
                imageUploading={draft.imageUploading}
                wordAudioSource={settings.wordAudioSource}
                activeVoiceLabel={activeVoiceLabel}
                existingWordAudio={existingWordAudio}
                existingExampleAudio={existingExampleAudio}
                wordTakes={wordTakes}
                selectedWordTakeId={selectedWordTakeId}
                wordAudioLoading={wordAudioLoading}
                wordAudioError={wordAudioError}
                wordModelOverride={wordModelOverride}
                wordSpeedOverride={wordSpeedOverride}
                wordDownloadsSlot={{
                  dir: wordDownloads.dir,
                  filter: wordDownloads.filter,
                  files: wordDownloads.files,
                  selectedFileId: wordDownloads.selectedFileId,
                  loading: wordDownloads.loading,
                  error: wordDownloads.error,
                  onChangeFilter: (mode) => {
                    wordDownloads.setFilter(mode);
                    void wordDownloads.refresh(mode, {
                      autoSelectUs: mode === 'cambridge_audio',
                      targetWord: draft.fields.word,
                    });
                  },
                  onRescan: () =>
                    void wordDownloads.refresh(wordDownloads.filter, {
                      autoSelectUs: wordDownloads.filter === 'cambridge_audio',
                      targetWord: draft.fields.word,
                    }),
                  onSelectFile: wordDownloads.setSelectedFileId,
                  onDeleteFile: (id) => void wordDownloads.deleteFile(id),
                }}
                exampleDownloadsSlot={{
                  dir: exampleDownloads.dir,
                  filter: exampleDownloads.filter,
                  files: exampleDownloads.files,
                  selectedFileId: exampleDownloads.selectedFileId,
                  loading: exampleDownloads.loading,
                  error: exampleDownloads.error,
                  onChangeFilter: (mode) => {
                    exampleDownloads.setFilter(mode);
                    void exampleDownloads.refresh(mode);
                  },
                  onRescan: () => void exampleDownloads.refresh(exampleDownloads.filter),
                  onSelectFile: exampleDownloads.setSelectedFileId,
                  onDeleteFile: (id) => void exampleDownloads.deleteFile(id),
                }}
                onChangeField={(k, v) => draft.setField(k, v)}
                onChangeCustomValue={draft.setCustomValue}
                onLookup={() => void handleLookup(draft.fields.word)}
                onResetEditor={() => resetEditor(true)}
                onSelectPos={handleSelectPos}
                onGrabClipboardImage={() => void draft.grabClipboardImage()}
                onUploadImageDataUrl={(dataUrl, filename) =>
                  void draft.uploadImageDataUrl(dataUrl, filename)
                }
                onRemoveImage={() => void draft.removeImage()}
                onOpenSettings={() => setTab('settings')}
                onGenerateWordAudio={() => void handleGenerateWordAudio()}
                onSelectWordTake={setSelectedWordTakeId}
                onDeleteWordTake={(id) => void handleDeleteWordTake(id)}
                onChangeWordModelOverride={setWordModelOverride}
                onChangeWordSpeedOverride={setWordSpeedOverride}
                onOpenElevenLabsWithText={() => void handleOpenElevenLabsWithText()}
                onOpenGeminiModal={() => setGeminiModalOpen(true)}
              />

              <div className="lg:col-span-5 lg:sticky lg:top-[4.25rem] lg:h-[calc(100vh-9.75rem)]">
                <DictionaryViewer
                  lang={activeLang}
                  cambridgeMode={settings.cambridgeMode || 'english'}
                  word={draft.fields.word}
                  selectedPos={draft.fields.partOfSpeech}
                  currentReading={draft.fields.ipa}
                  loading={dictLoading}
                  autoSyncMessage={autoSyncMessage}
                  fallbackLoading={fallbackLoading}
                  lookup={dictData}
                  selectedSenseIds={selectedSenses.map((s) => s.id)}
                  onToggleSense={handleToggleCambridgeSense}
                  onClearSelectedSenses={handleClearSelectedSenses}
                  onUseExample={(ex) => {
                    draft.setField('exampleEn', ex);
                    triggerFieldFlash('example_en');
                    showToast(
                      `Đã chèn câu ví dụ từ ${activeLangDef.primarySourceLabel} vào ${fieldLabels.exampleEn}.`,
                      'info',
                    );
                  }}
                  onSelectPos={handleSelectPos}
                  onSelectReading={(val, autoFields) => {
                    const formatted = activeLangDef.stripReadingSlashes
                      ? stripIpaSlashes(val)
                      : val;
                    draft.setField('ipa', formatted);
                    if (autoFields?.pastForms) draft.setField('pastForms', autoFields.pastForms);
                    if (autoFields?.furigana) {
                      draft.setField('furigana', autoFields.furigana);
                    } else if (languageHasField(activeLang, 'furigana')) {
                      const fg = buildJapaneseFurigana(draft.fields.word, formatted);
                      if (fg) draft.setField('furigana', fg);
                    }
                  }}
                  onRefresh={() => void handleLookup(draft.fields.word, true)}
                  onLoadFallback={() => void handleLoadFallbackDictionary()}
                  onSyncOxford={() =>
                    triggerDictAutoSync(
                      'oxford',
                      draft.fields.word.trim(),
                      dictData?.secondaryUrl || '',
                      true,
                    )
                  }
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {tab !== 'settings' && (
        <StickyActionDock
          isEnrichNote={tab === 'enrich'}
          currentEnrichNote={currentEnrichNote}
          ankiDecks={ankiDecks}
          activeDeck={activeDeck}
          savingCard={savingCard}
          onChangeTargetDeck={setTargetDeck}
          onOpenSettings={() => setTab('settings')}
          onOpenPreview={() => setPreviewOpen(true)}
          onSaveCard={(advanceNext) => void handleSaveCard(advanceNext)}
        />
      )}

      <CardPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        deckName={activeDeck}
        word={draft.fields.word}
        formattedPos={visibility.pos ? formattedPosPreview || draft.fields.partOfSpeech : ''}
        ipa={visibility.ipa ? draft.fields.ipa : ''}
        typeAnswer={visibility.typeAnswer ? draft.fields.typeAnswer : ''}
        pastForms={visibility.pastForms ? draft.fields.pastForms : ''}
        furigana={visibility.furigana ? draft.fields.furigana : ''}
        definition={visibility.definition ? draft.fields.definition : ''}
        exampleEn={visibility.exampleEn ? draft.fields.exampleEn : ''}
        exampleVi={visibility.exampleVi ? draft.fields.exampleVi : ''}
        imageUrl={visibility.image ? (draft.cardImage?.url ?? null) : null}
        hasWordAudio={
          visibility.wordAudio && Boolean(hasWordAudioSelected || existingWordAudio.trim())
        }
        hasExampleAudio={
          visibility.exampleAudio &&
          Boolean(exampleDownloads.selectedFileId || existingExampleAudio.trim())
        }
        customFields={activeProfile.customFields ?? []}
        customValues={draft.fields.customValues}
        typeAnswerLabel={fieldLabels.typeAnswer}
        pastFormsLabel={fieldLabels.pastForms}
        furiganaLabel={fieldLabels.furigana}
        definitionLabel={fieldLabels.definition}
        wordAudioLabel={fieldLabels.wordAudio}
        exampleAudioLabel={fieldLabels.exampleAudio}
      />

      <GeminiExamplesModal
        open={geminiModalOpen}
        lang={activeLang}
        word={draft.fields.word}
        pos={draft.fields.partOfSpeech}
        definition={draft.fields.definition}
        defaultModel={settings.gemini?.model || DEFAULT_GEMINI_MODEL}
        defaultPromptTemplate={activeProfile.geminiPrompt || activeLangDef.defaultGeminiPrompt}
        exampleCount={settings.gemini?.exampleCount || 4}
        hasApiKey={Boolean(settings.gemini?.hasApiKey)}
        targetFieldLabel={fieldLabels.exampleEn}
        viFieldLabel={fieldLabels.exampleVi}
        onClose={() => setGeminiModalOpen(false)}
        onApplyExample={(pair, mode) => {
          if (mode === 'replace_target') {
            draft.setField('exampleEn', pair.target);
            triggerFieldFlash('example_en');
            showToast(`Đã chèn câu ví dụ (${activeLangDef.shortLabel}) từ Gemini AI.`, 'success');
            setGeminiModalOpen(false);
          } else if (mode === 'append_both') {
            draft.setField('exampleEn', (prev) =>
              prev.trim() ? `${prev.trim()}\n${pair.target}` : pair.target,
            );
            triggerFieldFlash('example_en');
            if (pair.vi) {
              draft.setField('exampleVi', (prev) =>
                prev.trim() ? `${prev.trim()}\n${pair.vi}` : pair.vi,
              );
              triggerFieldFlash('example_vi');
            }
            showToast(
              `Đã nối thêm cặp câu ví dụ (${activeLangDef.shortLabel} – VI) vào thẻ.`,
              'success',
            );
          } else {
            draft.setField('exampleEn', pair.target);
            triggerFieldFlash('example_en');
            if (pair.vi) {
              draft.setField('exampleVi', pair.vi);
              triggerFieldFlash('example_vi');
            }
            showToast(
              `Đã chọn cặp câu ví dụ (${activeLangDef.shortLabel} – VI) từ Gemini AI.`,
              'success',
            );
            setGeminiModalOpen(false);
          }
        }}
        onSavePromptAndModelDefault={async (nextModel, nextPrompt) => {
          try {
            const updated = await api.saveSettings({
              gemini: {
                ...settings.gemini,
                model: nextModel,
                apiKey: '',
              },
              languageProfiles: {
                ...settings.languageProfiles,
                [activeLang]: {
                  ...activeProfile,
                  geminiPrompt: nextPrompt,
                },
              },
            });
            setSettings(updated);
            showToast('Đã lưu Prompt & Mô hình Gemini làm mặc định.', 'success');
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : 'Không lưu được cấu hình mặc định.',
              'error',
            );
          }
        }}
        onOpenDeepSettings={() => {
          setGeminiModalOpen(false);
          setSettingsSection('gemini');
          setTab('settings');
        }}
      />
    </div>
  );
}

export default App;
