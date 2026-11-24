import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  DownloadedAudioFile,
  DownloadsFilterMode,
  DownloadsScanResponse,
} from '@ass/shared';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac', '.flac']);
const fileIdToNameCache = new Map<string, string>();

export function getDefaultDownloadsDir(): string {
  return path.join(os.homedir(), 'Downloads');
}

export function isAudioFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.crdownload') || lower.endsWith('.tmp') || lower.endsWith('.part')) {
    return false;
  }
  const ext = path.extname(lower);
  return AUDIO_EXTENSIONS.has(ext);
}

export function isElevenLabsFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.includes('elevenlabs') || lower.startsWith('eleven_') || lower.includes('11labs');
}

export function isCambridgeFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.startsWith('cambridge_') || lower.includes('_cambridge_') || lower.includes('cambridge');
}

/**
 * Generates a short, URL-safe, deterministic 16-char hex ID for any filename
 * (avoids URL length / Fastify maxParamLength issues with long ElevenLabs filenames).
 */
export function encodeFileId(filename: string): string {
  const id = crypto.createHash('sha256').update(filename).digest('hex').slice(0, 16);
  fileIdToNameCache.set(id, filename);
  return id;
}

export function getAudioContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.webm') return 'audio/webm';
  if (ext === '.aac') return 'audio/aac';
  if (ext === '.flac') return 'audio/flac';
  return 'audio/mpeg';
}

export function resolveDownloadsDir(configuredDir?: string): string {
  const cleaned = configuredDir?.trim();
  return cleaned ? path.resolve(cleaned) : getDefaultDownloadsDir();
}

export function resolveDownloadAudioPath(
  configuredDir: string | undefined,
  fileId: string,
): { filePath: string; filename: string } | null {
  const safeId = fileId.trim();
  if (!/^[a-f0-9]{16}$/i.test(safeId)) return null;

  const dir = resolveDownloadsDir(configuredDir);
  if (!fs.existsSync(dir)) return null;

  let filename = fileIdToNameCache.get(safeId);

  // Fallback scan if server restarted or cache hasn't indexed this file yet
  if (!filename || !fs.existsSync(path.join(dir, filename))) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !isAudioFilename(entry.name)) continue;
        const computed = encodeFileId(entry.name);
        if (computed === safeId) {
          filename = entry.name;
          break;
        }
      }
    } catch {
      return null;
    }
  }

  if (!filename || !isAudioFilename(filename)) return null;

  const fullPath = path.resolve(dir, filename);
  if (path.dirname(fullPath).toLowerCase() !== path.resolve(dir).toLowerCase()) {
    return null;
  }
  if (!fs.existsSync(fullPath)) return null;

  return { filePath: fullPath, filename };
}

export function scanDownloadsAudio(
  configuredDir: string | undefined,
  options: { filterMode?: DownloadsFilterMode; maxFiles?: number; urlPrefix?: string } = {},
): DownloadsScanResponse {
  const dir = resolveDownloadsDir(configuredDir);
  const filterMode: DownloadsFilterMode = options.filterMode ?? 'elevenlabs_only';
  const maxFiles = Math.min(Math.max(options.maxFiles ?? 15, 1), 100);
  const urlPrefix = options.urlPrefix ?? '/api/downloads/audio';

  if (!fs.existsSync(dir)) {
    return {
      dir,
      filterMode,
      files: [],
      error: `Không tìm thấy thư mục: ${dir}`,
    };
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const items: DownloadedAudioFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!isAudioFilename(entry.name)) continue;

      const isEl = isElevenLabsFilename(entry.name);
      const isCam = isCambridgeFilename(entry.name);
      if (filterMode === 'elevenlabs_only' && !isEl) continue;
      if (filterMode === 'cambridge_audio' && !isCam) continue;

      const fullPath = path.join(dir, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.size === 0) continue;

      const id = encodeFileId(entry.name);
      items.push({
        id,
        filename: entry.name,
        sizeBytes: stat.size,
        modifiedAt: new Date(stat.mtimeMs).toISOString(),
        modifiedMs: stat.mtimeMs,
        isElevenLabs: isEl,
        isCambridge: isCam,
        url: `${urlPrefix}/${id}`,
      });
    }

    items.sort((a, b) => b.modifiedMs - a.modifiedMs);

    return {
      dir,
      filterMode,
      files: items.slice(0, maxFiles),
    };
  } catch (err) {
    return {
      dir,
      filterMode,
      files: [],
      error: `Không thể đọc thư mục ${dir}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export class DownloadsFolderWatcher {
  private watcher: fs.FSWatcher | null = null;
  private watchedDir = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  start(dir: string, onChange: () => void): void {
    const target = resolveDownloadsDir(dir);
    if (this.watcher && this.watchedDir.toLowerCase() === target.toLowerCase()) {
      return;
    }

    this.stop();

    if (!fs.existsSync(target)) return;

    try {
      this.watchedDir = target;
      this.watcher = fs.watch(target, (_eventType, filename) => {
        if (filename && String(filename).toLowerCase().endsWith('.crdownload')) {
          return;
        }
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          onChange();
        }, 450);
      });
      this.watcher.on('error', () => {
        this.stop();
      });
    } catch {
      this.stop();
    }
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {
        // ignore
      }
      this.watcher = null;
    }
    this.watchedDir = '';
  }
}
