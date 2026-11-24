import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { DownloadsFilterMode } from '@ass/shared';
import { loadSettings, TMP_CAMBRIDGE_AUDIO_DIR } from '../store.js';
import {
  getAudioContentType,
  resolveDownloadAudioPath,
  scanDownloadsAudio,
} from '../services/downloadsScanner.js';
import { sendAudioBuffer } from '../utils/http.js';

function parseExampleDownloadsFilterMode(
  raw: string | undefined,
  fallback: DownloadsFilterMode,
): DownloadsFilterMode {
  if (raw === 'all_audio' || raw === 'elevenlabs_only') {
    return raw;
  }
  return fallback === 'all_audio' ? 'all_audio' : 'elevenlabs_only';
}

function parseWordDownloadsFilterMode(
  raw: string | undefined,
  fallback: DownloadsFilterMode,
): DownloadsFilterMode {
  if (raw === 'all_audio' || raw === 'elevenlabs_only' || raw === 'cambridge_audio') {
    return raw;
  }
  return fallback;
}

export async function registerDownloadsRoutes(app: FastifyInstance): Promise<void> {
  // ---------- ElevenLabs Manual Downloads Auto-Scanner ----------
  app.get<{ Querystring: { filter?: string; dir?: string; maxFiles?: string } }>(
    '/api/downloads/audio',
    async (req) => {
      const settings = loadSettings();
      const filterMode = parseExampleDownloadsFilterMode(
        req.query.filter,
        settings.elevenlabsDownloads.filterMode,
      );
      const dir = req.query.dir?.trim() || settings.elevenlabsDownloads.downloadsDir;
      const maxFiles = req.query.maxFiles
        ? Number(req.query.maxFiles)
        : settings.elevenlabsDownloads.maxFiles;

      return scanDownloadsAudio(dir, { filterMode, maxFiles });
    },
  );

  app.get<{ Params: { id: string } }>('/api/downloads/audio/:id', async (req, reply) => {
    const settings = loadSettings();
    const resolved = resolveDownloadAudioPath(settings.elevenlabsDownloads.downloadsDir, req.params.id);
    if (!resolved) {
      return reply
        .code(404)
        .send({ error: 'Không tìm thấy file âm thanh này trong thư mục Downloads.' });
    }
    const buffer = fs.readFileSync(resolved.filePath);
    return sendAudioBuffer(req, reply, buffer, getAudioContentType(resolved.filename));
  });

  app.delete<{ Params: { id: string } }>('/api/downloads/audio/:id', async (req, reply) => {
    const settings = loadSettings();
    const resolved = resolveDownloadAudioPath(settings.elevenlabsDownloads.downloadsDir, req.params.id);
    if (!resolved) {
      return reply.code(404).send({ error: 'Không tìm thấy file âm thanh để xóa.' });
    }
    fs.unlinkSync(resolved.filePath);
    return { deleted: true, filename: resolved.filename };
  });

  // ---------- Word Audio Folder Auto-Scanner ----------
  app.get<{ Querystring: { filter?: string; dir?: string; maxFiles?: string } }>(
    '/api/word-downloads/audio',
    async (req) => {
      const settings = loadSettings();
      const filterMode = parseWordDownloadsFilterMode(
        req.query.filter,
        settings.wordAudioDownloads.filterMode,
      );
      if (filterMode === 'cambridge_audio') {
        return scanDownloadsAudio(TMP_CAMBRIDGE_AUDIO_DIR, {
          filterMode: 'cambridge_audio',
          maxFiles: 10,
          urlPrefix: '/api/word-downloads/audio',
        });
      }
      const dir = req.query.dir?.trim() || settings.wordAudioDownloads.downloadsDir;
      const maxFiles = req.query.maxFiles
        ? Number(req.query.maxFiles)
        : settings.wordAudioDownloads.maxFiles;

      return scanDownloadsAudio(dir, {
        filterMode,
        maxFiles,
        urlPrefix: '/api/word-downloads/audio',
      });
    },
  );

  app.get<{ Params: { id: string } }>('/api/word-downloads/audio/:id', async (req, reply) => {
    const settings = loadSettings();
    const resolved =
      resolveDownloadAudioPath(TMP_CAMBRIDGE_AUDIO_DIR, req.params.id) ??
      resolveDownloadAudioPath(settings.wordAudioDownloads.downloadsDir, req.params.id);
    if (!resolved) {
      return reply
        .code(404)
        .send({ error: 'Không tìm thấy file âm thanh từ vựng này trong thư mục đã cấu hình.' });
    }
    const buffer = fs.readFileSync(resolved.filePath);
    return sendAudioBuffer(req, reply, buffer, getAudioContentType(resolved.filename));
  });

  app.delete<{ Params: { id: string } }>('/api/word-downloads/audio/:id', async (req, reply) => {
    const settings = loadSettings();
    const resolved =
      resolveDownloadAudioPath(TMP_CAMBRIDGE_AUDIO_DIR, req.params.id) ??
      resolveDownloadAudioPath(settings.wordAudioDownloads.downloadsDir, req.params.id);
    if (!resolved) {
      return reply.code(404).send({ error: 'Không tìm thấy file âm thanh từ vựng để xóa.' });
    }
    fs.unlinkSync(resolved.filePath);
    return { deleted: true, filename: resolved.filename };
  });
}
