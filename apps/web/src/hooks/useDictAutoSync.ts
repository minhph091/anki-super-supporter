import { useCallback, useEffect, useRef, useState } from 'react';
import { buildCambridgeUrl, type CambridgeDictMode } from '@ass/shared';

export type AutoSyncSite = 'cambridge' | 'oxford';

interface UseDictAutoSyncOptions {
  cambridgeMode?: CambridgeDictMode;
  onNotify: (text: string, tone?: 'success' | 'info' | 'error') => void;
  onNotFound?: (site: AutoSyncSite, word: string) => void;
}

export function useDictAutoSync({
  cambridgeMode = 'english',
  onNotify,
  onNotFound,
}: UseDictAutoSyncOptions) {
  const [autoSyncMessage, setAutoSyncMessage] = useState<string | null>(null);
  const autoSyncTimerRef = useRef<number | null>(null);
  const autoSyncAckTimerRef = useRef<number | null>(null);
  const autoSyncChainTimerRef = useRef<number | null>(null);
  const autoSyncRequestIdRef = useRef<string>('');
  const autoSyncUrlRef = useRef<string>('');
  const autoSyncedWordsRef = useRef<Set<string>>(new Set());
  const warnedMissingExtRef = useRef(false);

  const clearAutoSyncState = useCallback((preserveChain = false) => {
    if (autoSyncTimerRef.current) {
      window.clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    if (autoSyncAckTimerRef.current) {
      window.clearTimeout(autoSyncAckTimerRef.current);
      autoSyncAckTimerRef.current = null;
    }
    if (!preserveChain && autoSyncChainTimerRef.current) {
      window.clearTimeout(autoSyncChainTimerRef.current);
      autoSyncChainTimerRef.current = null;
    }
    setAutoSyncMessage(null);
  }, []);

  const resetWordSyncHistory = useCallback((word: string) => {
    const lower = word.trim().toLowerCase();
    if (!lower) return;
    autoSyncedWordsRef.current.delete(`cambridge:${lower}`);
    autoSyncedWordsRef.current.delete(`oxford:${lower}`);
  }, []);

  const triggerDictAutoSync = useCallback(
    (site: AutoSyncSite, targetWord: string, targetUrl: string, force = false) => {
      const cleanLower = targetWord.trim().toLowerCase();
      if (!cleanLower) return;
      const key = `${site}:${cleanLower}`;
      if (!force && autoSyncedWordsRef.current.has(key)) return;
      autoSyncedWordsRef.current.add(key);

      const isValidCambridgeUrl =
        targetUrl.startsWith('https://dictionary.cambridge.org/dictionary/english/') ||
        targetUrl.startsWith('https://dictionary.cambridge.org/dictionary/learner-english/');
      const safeUrl =
        site === 'oxford'
          ? `https://www.oxfordlearnersdictionaries.com/search/american_english/?q=${encodeURIComponent(targetWord.trim())}`
          : isValidCambridgeUrl
            ? targetUrl
            : buildCambridgeUrl(targetWord, cambridgeMode);

      const reqId = `${site}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      autoSyncRequestIdRef.current = reqId;
      autoSyncUrlRef.current = safeUrl;
      if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current);
      if (autoSyncAckTimerRef.current) window.clearTimeout(autoSyncAckTimerRef.current);

      const isLearnerUrl = safeUrl.includes('/dictionary/learner-english/');
      setAutoSyncMessage(
        site === 'oxford'
          ? `Đang mở tab nền Oxford để lấy IPA cho "${targetWord}"...`
          : isLearnerUrl
            ? `Đang mở tab nền Cambridge Learner's để đồng bộ "${targetWord}"...`
            : `Đang mở tab nền Cambridge để đồng bộ "${targetWord}"...`,
      );

      autoSyncAckTimerRef.current = window.setTimeout(() => {
        if (autoSyncRequestIdRef.current !== reqId) return;
        autoSyncedWordsRef.current.delete(key);
        clearAutoSyncState();
        if (!warnedMissingExtRef.current || force) {
          warnedMissingExtRef.current = true;
          onNotify(
            'Extension chưa phản hồi tự đồng bộ nền — hãy Reload extension ở chrome://extensions rồi nhấn F5 tải lại Studio.',
            'info',
          );
        }
      }, 1500);

      autoSyncTimerRef.current = window.setTimeout(
        () => {
          if (autoSyncRequestIdRef.current === reqId) {
            clearAutoSyncState();
          }
        },
        48000,
      );

      window.postMessage(
        {
          type: site === 'oxford' ? 'ASS_WEB_AUTO_SYNC_OXFORD' : 'ASS_WEB_AUTO_SYNC_CAMBRIDGE',
          requestId: reqId,
          word: targetWord,
          url: safeUrl,
        },
        '*',
      );
    },
    [cambridgeMode, clearAutoSyncState, onNotify],
  );

  const scheduleChainSync = useCallback(
    (site: AutoSyncSite, word: string, url: string, delayMs = 300) => {
      if (autoSyncChainTimerRef.current) {
        window.clearTimeout(autoSyncChainTimerRef.current);
      }
      autoSyncChainTimerRef.current = window.setTimeout(() => {
        autoSyncChainTimerRef.current = null;
        triggerDictAutoSync(site, word, url, true);
      }, delayMs);
    },
    [triggerDictAutoSync],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as
        | {
            type?: string;
            site?: AutoSyncSite;
            requestId?: string;
            word?: string;
            status?: string;
            error?: string;
          }
        | undefined;
      if (!data) return;
      if (data.type === 'ASS_WEB_BRIDGE_READY') {
        warnedMissingExtRef.current = false;
        return;
      }
      if (data.type !== 'ASS_WEB_AUTO_SYNC_STATUS') return;
      if (
        data.requestId &&
        autoSyncRequestIdRef.current &&
        data.requestId !== autoSyncRequestIdRef.current
      ) {
        return;
      }

      if (autoSyncAckTimerRef.current) {
        window.clearTimeout(autoSyncAckTimerRef.current);
        autoSyncAckTimerRef.current = null;
      }

      if (data.status === 'started') {
        warnedMissingExtRef.current = false;
        return;
      }

      const site: AutoSyncSite = data.site === 'oxford' ? 'oxford' : 'cambridge';
      const siteLabel = site === 'oxford' ? 'Oxford' : 'Cambridge';
      const wordKey = data.word ? `${site}:${data.word.trim().toLowerCase()}` : '';
      const activeUrl = autoSyncUrlRef.current;

      // If the unpacked Chrome Extension has not been reloaded yet, its old background.js
      // rejects /dictionary/learner-english/ with status === 'invalid_url'.
      // Automatically fall back to /dictionary/english/ so the user never gets stuck on a 403 error.
      if (
        site === 'cambridge' &&
        data.status === 'invalid_url' &&
        data.word &&
        activeUrl.includes('/dictionary/learner-english/')
      ) {
        onNotify(
          'Hãy vào chrome://extensions bấm Reload (⟳) tiện ích AnkiSuperSupporter rồi nhấn F5 để bật Learner\'s Dictionary (đang tạm đồng bộ bản English thông thường).',
          'info',
        );
        triggerDictAutoSync('cambridge', data.word, buildCambridgeUrl(data.word, 'english'), true);
        return;
      }

      // If a word does not exist in Cambridge Learner's Dictionary (which only has ~35k basic headwords),
      // automatically fall back to standard Cambridge English Dictionary.
      if (
        site === 'cambridge' &&
        data.status === 'not_found' &&
        data.word &&
        activeUrl.includes('/dictionary/learner-english/')
      ) {
        onNotify(
          `Learner's Dictionary không có mục từ "${data.word}" — đang tự động lấy từ Cambridge English thông thường...`,
          'info',
        );
        triggerDictAutoSync('cambridge', data.word, buildCambridgeUrl(data.word, 'english'), true);
        return;
      }

      clearAutoSyncState(data.status === 'completed' && site === 'cambridge');
      if (data.status === 'verification') {
        onNotify(
          `${siteLabel} yêu cầu xác minh trên tab vừa mở — xác nhận xong hệ thống sẽ tự đồng bộ.`,
          'info',
        );
      } else if (data.status === 'not_found' && data.word) {
        onNotFound?.(site, data.word);
        onNotify(`${siteLabel} không có mục từ "${data.word}".`, 'info');
      } else if (data.status === 'context_invalidated') {
        if (wordKey) autoSyncedWordsRef.current.delete(wordKey);
        onNotify('Extension vừa được Reload — hãy nhấn F5 tải lại trang Studio.', 'info');
      } else if (
        data.status === 'error' ||
        data.status === 'tab_failed' ||
        data.status === 'invalid_url'
      ) {
        if (wordKey) autoSyncedWordsRef.current.delete(wordKey);
        onNotify(
          `Không thể mở tab nền ${siteLabel} (${data.error || data.status}). Hãy Reload Extension tại chrome://extensions rồi nhấn F5.`,
          'error',
        );
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [clearAutoSyncState, onNotFound, onNotify, triggerDictAutoSync]);

  return {
    autoSyncMessage,
    triggerDictAutoSync,
    clearAutoSyncState,
    scheduleChainSync,
    resetWordSyncHistory,
  };
}
