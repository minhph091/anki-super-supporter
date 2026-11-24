import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { cleanTextForTts } from '@ass/shared';

const HANDOFF_TTL_MS = 1000 * 60 * 5; // 5 minutes
let pendingElevenLabsHandoff: { id: string; text: string; createdAt: number } | null = null;

export async function registerHandoffRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { text?: string } }>('/api/handoff/elevenlabs', async (req, reply) => {
    const clean = cleanTextForTts(String(req.body?.text ?? ''));
    if (!clean) {
      return reply.code(400).send({ error: 'Câu ví dụ đang trống.' });
    }
    pendingElevenLabsHandoff = {
      id: crypto.randomUUID(),
      text: clean,
      createdAt: Date.now(),
    };
    return { ok: true, id: pendingElevenLabsHandoff.id, text: clean };
  });

  app.get('/api/handoff/elevenlabs', async () => {
    if (!pendingElevenLabsHandoff) {
      return { pending: false };
    }
    if (Date.now() - pendingElevenLabsHandoff.createdAt > HANDOFF_TTL_MS) {
      pendingElevenLabsHandoff = null;
      return { pending: false };
    }
    return {
      pending: true,
      id: pendingElevenLabsHandoff.id,
      text: pendingElevenLabsHandoff.text,
    };
  });

  app.post<{ Body: { id?: string } }>('/api/handoff/elevenlabs/ack', async (req) => {
    if (pendingElevenLabsHandoff && (!req.body?.id || pendingElevenLabsHandoff.id === req.body.id)) {
      pendingElevenLabsHandoff = null;
      return { cleared: true };
    }
    return { cleared: false };
  });
}
