import type { FastifyInstance } from 'fastify';
import type { AppSettings } from '@ass/shared';
import {
  deleteStoredOpenAIApiKey,
  getPublicSettings,
  loadSettings,
  saveSettings,
  setStoredOpenAIApiKey,
} from '../store.js';
import { fetchOpenAITtsOptions, previewOpenAIVoice } from '../services/tts.js';
import { syncClipboardWatcher, syncDownloadsWatcher } from '../services/watchers.js';
import { sendAudioBuffer } from '../utils/http.js';

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings', async () => getPublicSettings());

  app.put<{ Body: Partial<AppSettings> }>('/api/settings', async (req) => {
    const next = saveSettings(req.body ?? {});
    syncDownloadsWatcher();
    syncClipboardWatcher();
    return next;
  });

  app.put<{ Body: { apiKey?: string } }>('/api/secrets/openai', async (req, reply) => {
    const key = (req.body?.apiKey ?? '').trim();
    if (!key) {
      return reply.code(400).send({ error: 'API Key không được để trống.' });
    }
    setStoredOpenAIApiKey(key);
    return getPublicSettings();
  });

  app.delete('/api/secrets/openai', async () => {
    deleteStoredOpenAIApiKey();
    return getPublicSettings();
  });

  app.post<{ Body: { apiKey?: string; model?: string } }>(
    '/api/openai/tts-options',
    async (req) => {
      const incomingKey = req.body?.apiKey?.trim();
      if (incomingKey) {
        setStoredOpenAIApiKey(incomingKey);
      }
      return fetchOpenAITtsOptions(incomingKey, req.body?.model);
    },
  );

  app.post<{
    Body: {
      voice?: string;
      model?: string;
      speed?: number;
      instructions?: string;
      text?: string;
      apiKey?: string;
    };
  }>('/api/openai/preview-voice', async (req, reply) => {
    try {
      const settings = loadSettings();
      const buffer = await previewOpenAIVoice(settings, req.body ?? {});
      return sendAudioBuffer(req, reply, buffer, 'audio/mpeg');
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : 'Không nghe thử được giọng OpenAI.',
      });
    }
  });
}
