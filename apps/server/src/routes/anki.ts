import type { FastifyInstance } from 'fastify';
import type { SaveCardPayload } from '@ass/shared';
import { loadSettings } from '../store.js';
import {
  findAndLoadNotes,
  getAnkiStatus,
  getDeckNames,
  getModelFieldNames,
  getModelNames,
} from '../services/ankiconnect.js';
import { CardSaveError, saveCardToAnki } from '../services/cardSaver.js';

export async function registerAnkiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/anki/status', async () => {
    const settings = loadSettings();
    return getAnkiStatus(settings.ankiConnectUrl);
  });

  app.get('/api/anki/meta', async (_req, reply) => {
    try {
      const settings = loadSettings();
      const [decks, models] = await Promise.all([
        getDeckNames(settings.ankiConnectUrl),
        getModelNames(settings.ankiConnectUrl),
      ]);
      return { decks, models };
    } catch (err) {
      return reply.code(502).send({
        error: err instanceof Error ? err.message : 'Lỗi kết nối AnkiConnect.',
      });
    }
  });

  app.get<{ Querystring: { modelName?: string } }>('/api/anki/model-fields', async (req, reply) => {
    const modelName = req.query.modelName?.trim();
    if (!modelName) {
      return reply.code(400).send({ error: 'Thiếu modelName.' });
    }
    try {
      const settings = loadSettings();
      const fields = await getModelFieldNames(settings.ankiConnectUrl, modelName);
      return { modelName, fields };
    } catch (err) {
      return reply.code(502).send({
        error: err instanceof Error ? err.message : 'Không lấy được danh sách trường từ Anki.',
      });
    }
  });

  app.get<{ Querystring: { query?: string; limit?: string } }>(
    '/api/anki/notes',
    async (req, reply) => {
      const query = req.query.query?.trim();
      if (!query) {
        return reply.code(400).send({ error: 'Thiếu truy vấn tìm kiếm Anki.' });
      }
      const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 300);
      try {
        const settings = loadSettings();
        const notes = await findAndLoadNotes(settings.ankiConnectUrl, query, limit);
        return { notes };
      } catch (err) {
        return reply.code(502).send({
          error: err instanceof Error ? err.message : 'Không tải được danh sách thẻ từ Anki.',
        });
      }
    },
  );

  app.post<{ Body: SaveCardPayload }>('/api/anki/save', async (req, reply) => {
    try {
      const settings = loadSettings();
      return await saveCardToAnki(req.body, settings);
    } catch (err) {
      if (err instanceof CardSaveError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Lỗi khi lưu thẻ vào Anki.',
      });
    }
  });
}
