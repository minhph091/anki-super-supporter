import path from 'node:path';
import {
  cleanupOldAudioTakes,
  loadSettings,
  saveTempImage,
} from '../store.js';
import { DownloadsFolderWatcher, scanDownloadsAudio } from './downloadsScanner.js';
import { ClipboardImageWatcher } from './clipboardWatcher.js';
import { compressImageAdaptive } from './imageCompressor.js';
import {
  broadcastDownloadsUpdated,
  broadcastInboxImage,
  broadcastWordDownloadsUpdated,
  closeAllSseClients,
  getConnectedClientCount,
} from '../inboxHub.js';
import { replaceFilenameExtension } from '../utils/http.js';

const downloadsWatcher = new DownloadsFolderWatcher();
const wordDownloadsWatcher = new DownloadsFolderWatcher();
const clipboardWatcher = new ClipboardImageWatcher();
let periodicCleanupTimer: ReturnType<typeof setInterval> | null = null;
const CLEANUP_INTERVAL_MS = 1000 * 60 * 5; // Every 5 minutes

export function syncDownloadsWatcher(): void {
  const s = loadSettings();
  downloadsWatcher.start(s.elevenlabsDownloads.downloadsDir, () => {
    const latest = loadSettings();
    const scan = scanDownloadsAudio(latest.elevenlabsDownloads.downloadsDir, {
      filterMode: latest.elevenlabsDownloads.filterMode,
      maxFiles: latest.elevenlabsDownloads.maxFiles,
      urlPrefix: '/api/downloads/audio',
    });
    broadcastDownloadsUpdated(scan);
  });

  if (s.wordAudioSource === 'folder_scan') {
    wordDownloadsWatcher.start(s.wordAudioDownloads.downloadsDir, () => {
      const latest = loadSettings();
      // Never scan the general Downloads folder with 'cambridge_audio' filter!
      // Cambridge word audios live exclusively in TMP_CAMBRIDGE_AUDIO_DIR and are broadcast by syncBuffer.ts.
      const folderFilterMode =
        latest.wordAudioDownloads.filterMode === 'cambridge_audio'
          ? 'all_audio'
          : latest.wordAudioDownloads.filterMode;
      const scan = scanDownloadsAudio(latest.wordAudioDownloads.downloadsDir, {
        filterMode: folderFilterMode,
        maxFiles: latest.wordAudioDownloads.maxFiles,
        urlPrefix: '/api/word-downloads/audio',
      });
      broadcastWordDownloadsUpdated(scan);
    });
  } else {
    wordDownloadsWatcher.stop();
  }
}

export function syncClipboardWatcher(): void {
  const s = loadSettings();
  if (s.autoClipboardImage) {
    clipboardWatcher.start((captured) => {
      // Only store background clipboard images when at least one Studio tab is open
      if (getConnectedClientCount() === 0) return;
      void compressImageAdaptive(captured.buffer, {
        fallbackExtension: path.extname(captured.filename),
      })
        .then((optimized) => {
          const meta = saveTempImage(optimized.compressedBytes, optimized.mimeType, {
            filename: replaceFilenameExtension(captured.filename, optimized.extension),
            sourceTitle: 'Clipboard',
          });
          broadcastInboxImage(meta);
        })
        .catch(() => {
          const meta = saveTempImage(captured.buffer, captured.mimeType, {
            filename: captured.filename,
            sourceTitle: 'Clipboard',
          });
          broadcastInboxImage(meta);
        });
    });
  } else {
    clipboardWatcher.stop();
  }
}

export function startAllWatchers(): void {
  syncDownloadsWatcher();
  syncClipboardWatcher();
  if (periodicCleanupTimer) clearInterval(periodicCleanupTimer);
  periodicCleanupTimer = setInterval(() => {
    cleanupOldAudioTakes();
  }, CLEANUP_INTERVAL_MS);
}

export function stopAllWatchers(): void {
  if (periodicCleanupTimer) {
    clearInterval(periodicCleanupTimer);
    periodicCleanupTimer = null;
  }
  closeAllSseClients();
  downloadsWatcher.stop();
  wordDownloadsWatcher.stop();
  clipboardWatcher.stop();
}
