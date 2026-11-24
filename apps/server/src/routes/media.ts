import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { clearAllTempImages, deleteTempImage, getTempImage, saveTempImage } from '../store.js';
import { grabCurrentClipboardImage } from '../services/clipboardWatcher.js';
import { compressImageAdaptive } from '../services/imageCompressor.js';
import { broadcastInboxImage, getConnectedClientCount } from '../inboxHub.js';
import { replaceFilenameExtension, resolveIncomingImageBuffer } from '../utils/http.js';

export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { dataUrl?: string; imageUrl?: string; filename?: string } }>(
    '/api/media/images',
    async (req, reply) => {
      try {
        const { buffer } = await resolveIncomingImageBuffer(req.body ?? {});
        const optimized = await compressImageAdaptive(buffer, {
          fallbackExtension: req.body?.filename ? path.extname(req.body.filename) : undefined,
        });
        const meta = saveTempImage(optimized.compressedBytes, optimized.mimeType, {
          filename: replaceFilenameExtension(req.body?.filename, optimized.extension),
        });
        return meta;
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : 'Không xử lý được hình ảnh.',
        });
      }
    },
  );

  app.get<{ Params: { id: string } }>('/api/media/images/:id', async (req, reply) => {
    const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const record = getTempImage(safeId);
    if (!record) {
      return reply.code(404).send({ error: 'Không tìm thấy ảnh tạm này.' });
    }
    const buffer = fs.readFileSync(record.filePath);
    return reply
      .code(200)
      .header('Content-Type', record.meta.mimeType)
      .header('Content-Length', buffer.length)
      .header('Cache-Control', 'no-store')
      .send(buffer);
  });

  app.delete<{ Params: { id: string } }>('/api/media/images/:id', async (req) => {
    const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    return { deleted: deleteTempImage(safeId) };
  });

  app.post<{ Body?: { keepIds?: string[] } }>('/api/media/images/clear', async (req) => {
    const keepIds = Array.isArray(req.body?.keepIds) ? req.body.keepIds : [];
    const deleted = clearAllTempImages(keepIds);
    return { ok: true, deleted };
  });

  app.post('/api/clipboard/image/grab', async (_req, reply) => {
    try {
      const captured = await grabCurrentClipboardImage();
      if (!captured) {
        return reply.code(404).send({ error: 'Không có hình ảnh nào trong Clipboard.' });
      }
      const optimized = await compressImageAdaptive(captured.buffer, {
        fallbackExtension: path.extname(captured.filename),
      });
      const meta = saveTempImage(optimized.compressedBytes, optimized.mimeType, {
        filename: replaceFilenameExtension(captured.filename, optimized.extension),
        sourceTitle: 'Clipboard',
      });
      return meta;
    } catch (err) {
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Không đọc được ảnh từ Clipboard.',
      });
    }
  });

  app.post<{
    Body: {
      dataUrl?: string;
      imageUrl?: string;
      filename?: string;
      sourceUrl?: string;
      sourceTitle?: string;
    };
  }>('/api/inbox/image', async (req, reply) => {
    try {
      const { buffer } = await resolveIncomingImageBuffer(req.body ?? {});
      const optimized = await compressImageAdaptive(buffer, {
        fallbackExtension: req.body?.filename ? path.extname(req.body.filename) : undefined,
      });
      const meta = saveTempImage(optimized.compressedBytes, optimized.mimeType, {
        filename: replaceFilenameExtension(req.body?.filename, optimized.extension),
        sourceUrl: req.body?.sourceUrl,
        sourceTitle: req.body?.sourceTitle,
      });
      broadcastInboxImage(meta);
      return {
        ok: true,
        deliveredToClients: getConnectedClientCount(),
        image: meta,
      };
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : 'Không nhận được hình ảnh.',
      });
    }
  });
}
