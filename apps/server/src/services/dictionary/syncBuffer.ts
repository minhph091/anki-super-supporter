import fs from 'node:fs';
import path from 'node:path';
import {
  slugifyFilename,
  type CambridgeAudioItem,
  type CambridgeLookupResult,
  type OxfordLookupResult,
} from '@ass/shared';
import { clearCambridgeTempAudios, TMP_CAMBRIDGE_AUDIO_DIR } from '../../store.js';
import { scanDownloadsAudio } from '../downloadsScanner.js';
import { broadcastWordDownloadsUpdated } from '../../inboxHub.js';

// Short-lived in-memory merge buffer ONLY for combining sequential Cambridge + Oxford Extension syncs
// within the same active lookup (never used to cache /api/dictionary/lookup responses).
const activeSyncMergeMap = new Map<
  string,
  { oxford?: OxfordLookupResult; cambridge?: CambridgeLookupResult; updatedAt: number }
>();
const SYNC_MERGE_TTL_MS = 1000 * 60 * 3; // 3 minutes

export function getActiveSyncMerge(word: string) {
  const key = word.trim().toLowerCase();
  const rec = activeSyncMergeMap.get(key);
  if (!rec) return null;
  if (Date.now() - rec.updatedAt > SYNC_MERGE_TTL_MS) {
    activeSyncMergeMap.delete(key);
    return null;
  }
  return rec;
}

export function setActiveSyncMerge(
  word: string,
  patch: { oxford?: OxfordLookupResult; cambridge?: CambridgeLookupResult },
) {
  const key = word.trim().toLowerCase();
  const prev = getActiveSyncMerge(word) ?? { updatedAt: Date.now() };
  activeSyncMergeMap.set(key, {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  });
}

export function clearActiveSyncMerge(word: string): void {
  activeSyncMergeMap.delete(word.trim().toLowerCase());
}

export function broadcastCambridgeTempAudioList(): void {
  const scan = scanDownloadsAudio(TMP_CAMBRIDGE_AUDIO_DIR, {
    filterMode: 'cambridge_audio',
    maxFiles: 10,
    urlPrefix: '/api/word-downloads/audio',
  });
  broadcastWordDownloadsUpdated(scan);
}

export async function saveCambridgeAudiosToTemp(
  word: string,
  audios: CambridgeAudioItem[] | undefined,
): Promise<number> {
  clearCambridgeTempAudios();
  if (!Array.isArray(audios) || audios.length === 0) {
    broadcastCambridgeTempAudioList();
    return 0;
  }
  const topTwo = audios.slice(0, 2);
  const slug = slugifyFilename(word, 'word', 32);

  let savedCount = 0;
  const nowSec = Date.now() / 1000;

  for (let i = 0; i < topTwo.length; i++) {
    const item = topTwo[i];
    if (!item) continue;
    let buf: Buffer | null = null;

    if (item.dataBase64 && item.dataBase64.trim()) {
      try {
        const cleanB64 = item.dataBase64.replace(/^data:[^;]+;base64,/i, '').trim();
        const decoded = Buffer.from(cleanB64, 'base64');
        if (decoded.length > 0) buf = decoded;
      } catch {
        buf = null;
      }
    }

    if (
      !buf &&
      item.url &&
      /^https:\/\/dictionary\.cambridge\.org\/(?:[a-z]{2}\/)?media\//i.test(item.url)
    ) {
      try {
        const resp = await fetch(item.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            Referer: 'https://dictionary.cambridge.org/',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const arr = await resp.arrayBuffer();
          if (arr.byteLength > 0) buf = Buffer.from(arr);
        }
      } catch {
        buf = null;
      }
    }

    if (!buf || buf.length === 0) continue;

    const regionTag = item.region === 'us' ? 'US' : item.region === 'uk' ? 'UK' : 'AUDIO';
    const ext = item.url?.toLowerCase().endsWith('.ogg') ? '.ogg' : '.mp3';
    const filename = `Cambridge_${slug}_${regionTag}_${i + 1}${ext}`;
    const mtime = item.region === 'us' ? nowSec + 0.5 : nowSec + i * 0.1;

    try {
      fs.mkdirSync(TMP_CAMBRIDGE_AUDIO_DIR, { recursive: true });
      const fullPath = path.join(TMP_CAMBRIDGE_AUDIO_DIR, filename);
      fs.writeFileSync(fullPath, buf);
      fs.utimesSync(fullPath, mtime, mtime);
      savedCount += 1;
    } catch {
      // ignore temp write error
    }
  }

  broadcastCambridgeTempAudioList();
  return savedCount;
}
