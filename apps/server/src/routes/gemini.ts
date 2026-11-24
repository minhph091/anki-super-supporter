import type { FastifyInstance } from 'fastify';
import type { GeminiGenerateExamplesRequest } from '@ass/shared';
import {
  deleteStoredGeminiApiKey,
  getPublicSettings,
  loadSettings,
  setStoredGeminiApiKey,
} from '../store.js';
import { fetchGeminiModels, generateGeminiExamples } from '../services/gemini.js';

export async function registerGeminiRoutes(app: FastifyInstance): Promise<void> {
  app.put<{ Body: { apiKey?: string } }>('/api/secrets/gemini', async (req, reply) => {
    const key = (req.body?.apiKey ?? '').trim();
    if (!key) {
      return reply.code(400).send({ error: 'Gemini API Key không được để trống.' });
    }
    setStoredGeminiApiKey(key);
    return getPublicSettings();
  });

  app.delete('/api/secrets/gemini', async () => {
    deleteStoredGeminiApiKey();
    return getPublicSettings();
  });

  app.post<{ Body: { apiKey?: string } }>('/api/gemini/models', async (req) => {
    const incomingKey = req.body?.apiKey?.trim();
    if (incomingKey) {
      setStoredGeminiApiKey(incomingKey);
    }
    return fetchGeminiModels(incomingKey);
  });

  app.post<{ Body: GeminiGenerateExamplesRequest }>(
    '/api/gemini/examples',
    async (req, reply) => {
      try {
        const settings = loadSettings();
        return await generateGeminiExamples(settings, req.body ?? ({} as never));
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : 'Không tạo được câu ví dụ từ Gemini.',
        });
      }
    },
  );
}
