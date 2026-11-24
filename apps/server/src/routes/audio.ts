import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { deleteAudioTake, getAudioTake, loadSettings } from '../store.js';
import { generateOpenAIWordAudio } from '../services/tts.js';
import { sendAudioBuffer } from '../utils/http.js';

export async function registerAudioRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      text: string;
      model?: string;
      voice?: string;
      speed?: number;
      instructions?: string;
    };
  }>('/api/audio/word', async (req, reply) => {
    try {
      const settings = loadSettings();
      const take = await generateOpenAIWordAudio(settings, req.body);
      return take;
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : 'Không tạo được âm thanh từ vựng.',
      });
    }
  });

  app.get<{ Params: { id: string } }>('/api/audio/takes/:id', async (req, reply) => {
    const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const take = getAudioTake(safeId);
    if (!take) {
      return reply.code(404).send({ error: 'Không tìm thấy bản thu âm tạm này.' });
    }
    const buffer = fs.readFileSync(take.filePath);
    return sendAudioBuffer(req, reply, buffer, 'audio/mpeg');
  });

  app.delete<{ Params: { id: string } }>('/api/audio/takes/:id', async (req) => {
    const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    return { deleted: deleteAudioTake(safeId) };
  });
}
