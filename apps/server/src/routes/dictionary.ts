import type { FastifyInstance } from 'fastify';
import {
  buildCambridgeUrl,
  isSupportedLanguage,
  type CambridgeLookupResult,
  type DictionaryLookupResponse,
  type LanguageCode,
  type OxfordLookupResult,
} from '@ass/shared';
import { clearCambridgeTempAudios, loadSettings } from '../store.js';
import {
  adaptEnglishLookup,
  lookupDictionaryByLang,
  lookupFallbackByLang,
} from '../services/dictionary/registry.js';
import {
  broadcastCambridgeTempAudioList,
  clearActiveSyncMerge,
  getActiveSyncMerge,
  saveCambridgeAudiosToTemp,
  setActiveSyncMerge,
} from '../services/dictionary/syncBuffer.js';
import { broadcastDictionarySync, getConnectedClientCount } from '../inboxHub.js';

function isCambridgeWordAudioEnabled(): boolean {
  const s = loadSettings();
  return s.wordAudioSource === 'folder_scan' && s.wordAudioDownloads.filterMode === 'cambridge_audio';
}

export async function registerDictionaryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/cambridge-audio/clear', async () => {
    const deleted = clearCambridgeTempAudios();
    broadcastCambridgeTempAudioList();
    return { ok: true, deleted };
  });

  app.get<{ Querystring: { word?: string; lang?: string; refresh?: string } }>(
    '/api/dictionary/lookup',
    async (req, reply) => {
      const word = (req.query.word ?? '').trim();
      if (!word) {
        return reply.code(400).send({ error: 'Thiếu tham số word.' });
      }

      const lang: LanguageCode = isSupportedLanguage(req.query.lang) ? req.query.lang : 'en';
      clearActiveSyncMerge(word);
      if (clearCambridgeTempAudios() > 0) {
        broadcastCambridgeTempAudioList();
      }

      const result = await lookupDictionaryByLang(lang, word);
      if (lang === 'en') {
        setActiveSyncMerge(word, {
          ...(result.oxford?.entries?.length ? { oxford: result.oxford } : {}),
          ...(result.cambridge?.entries?.length ? { cambridge: result.cambridge } : {}),
        });
        if (result.cambridge?.audios?.length && isCambridgeWordAudioEnabled()) {
          void saveCambridgeAudiosToTemp(word, result.cambridge.audios);
        }
      }

      const response: DictionaryLookupResponse = { ...result, cached: false };
      return response;
    },
  );

  app.get<{ Querystring: { word?: string; lang?: string } }>(
    '/api/dictionary/fallback',
    async (req, reply) => {
      const word = (req.query.word ?? '').trim();
      if (!word) {
        return reply.code(400).send({ error: 'Thiếu tham số word.' });
      }
      const lang: LanguageCode = isSupportedLanguage(req.query.lang) ? req.query.lang : 'en';
      const result = await lookupFallbackByLang(lang, word);
      return { ...result, cached: false };
    },
  );

  app.post<{ Body: CambridgeLookupResult }>(
    '/api/dictionary/cambridge/import',
    async (req, reply) => {
      const cambridge = req.body;
      const word = cambridge?.word?.trim();
      if (!word || !Array.isArray(cambridge.entries)) {
        return reply.code(400).send({ error: 'Dữ liệu Cambridge đồng bộ không hợp lệ.' });
      }

      const existing = getActiveSyncMerge(word);
      const oxford: OxfordLookupResult = existing?.oxford ?? {
        word,
        sourceUrl: `https://www.oxfordlearnersdictionaries.com/search/american_english/?q=${encodeURIComponent(word)}`,
        entries: [],
      };
      const unified = adaptEnglishLookup(word, oxford, cambridge, { preferSource: 'cambridge' });
      setActiveSyncMerge(word, { cambridge: unified.cambridge, oxford });

      const savedAudiosCount = isCambridgeWordAudioEnabled()
        ? await saveCambridgeAudiosToTemp(word, cambridge.audios)
        : 0;

      broadcastDictionarySync({
        lang: 'en',
        source: 'cambridge',
        word,
        cambridge: unified.cambridge,
        unified,
        receivedAt: new Date().toISOString(),
      });

      return {
        ok: true,
        word,
        entriesCount: cambridge.entries.length,
        savedAudiosCount,
        deliveredToClients: getConnectedClientCount(),
      };
    },
  );

  app.post<{ Body: OxfordLookupResult }>(
    '/api/dictionary/oxford/import',
    async (req, reply) => {
      const oxford = req.body;
      const word = oxford?.word?.trim();
      if (!word || !Array.isArray(oxford.entries)) {
        return reply.code(400).send({ error: 'Dữ liệu Oxford đồng bộ không hợp lệ.' });
      }

      const existing = getActiveSyncMerge(word);
      const cambridge: CambridgeLookupResult = existing?.cambridge ?? {
        word,
        sourceUrl: buildCambridgeUrl(word, loadSettings().cambridgeMode),
        entries: [],
      };
      const unified = adaptEnglishLookup(word, oxford, cambridge, { preferSource: 'oxford' });
      setActiveSyncMerge(word, { oxford, cambridge: unified.cambridge });

      broadcastDictionarySync({
        lang: 'en',
        source: 'oxford',
        word,
        oxford,
        unified,
        receivedAt: new Date().toISOString(),
      });

      return {
        ok: true,
        word,
        entriesCount: oxford.entries.length,
        deliveredToClients: getConnectedClientCount(),
      };
    },
  );

  app.post<{ Body: Omit<DictionaryLookupResponse, 'cached'> }>(
    '/api/dictionary/weblio/import',
    async (req, reply) => {
      const payload = req.body;
      const word = payload?.word?.trim();
      if (!word || !Array.isArray(payload.entries)) {
        return reply.code(400).send({ error: 'Dữ liệu Weblio đồng bộ không hợp lệ.' });
      }

      const unified: Omit<DictionaryLookupResponse, 'cached'> = {
        ...payload,
        lang: 'ja',
        word,
        primaryUrl: payload.primaryUrl || `https://www.weblio.jp/content/${encodeURIComponent(word)}`,
        secondaryUrl: payload.secondaryUrl || `https://jisho.org/search/${encodeURIComponent(word)}`,
        readings: Array.isArray(payload.readings) ? payload.readings : [],
        entries: payload.entries,
      };

      broadcastDictionarySync({
        lang: 'ja',
        source: 'weblio',
        word,
        unified,
        receivedAt: new Date().toISOString(),
      });

      return {
        ok: true,
        word,
        entriesCount: unified.entries.length,
        deliveredToClients: getConnectedClientCount(),
      };
    },
  );
}
