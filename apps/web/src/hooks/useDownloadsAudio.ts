import { useCallback, useState } from 'react';
import {
  slugifyFilename,
  type DownloadedAudioFile,
  type DownloadsFilterMode,
  type DownloadsScanResponse,
} from '@ass/shared';
import { api } from '../lib/api';

function findPreferredUsAudio(
  files: DownloadedAudioFile[],
  targetWord?: string,
): DownloadedAudioFile | null {
  const hasUs = (filename: string) =>
    /(?:^|[_\-\s])us(?:[_\-\s.]|$)/i.test(filename) || filename.toUpperCase().includes('US');
  const slug = slugifyFilename(targetWord || '', '', 64);
  if (slug) {
    const exactWordUs = files.find(
      (f) => f.filename.toLowerCase().includes(`_${slug}_`) && hasUs(f.filename),
    );
    if (exactWordUs) return exactWordUs;
  }
  return files.find((f) => hasUs(f.filename)) ?? null;
}

interface UseDownloadsAudioOptions {
  kind: 'example' | 'word';
  initialFilter: DownloadsFilterMode;
  onNotify: (text: string, tone?: 'success' | 'info' | 'error') => void;
}

export function useDownloadsAudio({ kind, initialFilter, onNotify }: UseDownloadsAudioOptions) {
  const [files, setFiles] = useState<DownloadedAudioFile[]>([]);
  const [dir, setDir] = useState('');
  const [filter, setFilter] = useState<DownloadsFilterMode>(initialFilter);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (
      filterOverride?: DownloadsFilterMode,
      options?: { autoSelectUs?: boolean; targetWord?: string },
    ) => {
      const rawFilter = filterOverride ?? filter;
      const effectiveFilter: DownloadsFilterMode =
        kind === 'example'
          ? rawFilter === 'all_audio'
            ? 'all_audio'
            : 'elevenlabs_only'
          : rawFilter;

      setLoading(true);
      setError(null);
      try {
        const res =
          kind === 'word'
            ? await api.listWordDownloadedAudio({ filter: effectiveFilter })
            : await api.listDownloadedAudio({ filter: effectiveFilter });
        setFiles(res.files);
        setDir(res.dir);
        if (res.error) setError(res.error);
        if (kind === 'word') {
          if (effectiveFilter === 'cambridge_audio') {
            if (options?.autoSelectUs) {
              const preferred = findPreferredUsAudio(res.files, options.targetWord);
              if (preferred) setSelectedFileId(preferred.id);
            }
          } else {
            // Non-Cambridge word audio folder scan: default to the newest audio file in folder
            setSelectedFileId(res.files[0]?.id ?? null);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : kind === 'word'
              ? 'Không quét được thư mục âm thanh từ vựng.'
              : 'Không quét được thư mục Downloads.',
        );
      } finally {
        setLoading(false);
      }
    },
    [filter, kind],
  );

  const deleteFile = useCallback(
    async (id: string) => {
      try {
        if (kind === 'word') {
          await api.deleteWordDownloadedAudio(id);
        } else {
          await api.deleteDownloadedAudio(id);
        }
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setSelectedFileId((curr) => (curr === id ? null : curr));
        onNotify(
          kind === 'word'
            ? 'Đã xóa file âm thanh từ vựng khỏi thư mục.'
            : 'Đã xóa file âm thanh khỏi thư mục Downloads.',
          'info',
        );
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Không xóa được file.', 'error');
      }
    },
    [kind, onNotify],
  );

  const handleSseScan = useCallback(
    (scan: DownloadsScanResponse) => {
      if (kind === 'example') {
        setDir(scan.dir);
        setError(scan.error ?? null);
        if (scan.filterMode === filter) {
          setFiles(scan.files);
          if (scan.files[0]) {
            onNotify(`Phát hiện audio mới: ${scan.files[0].filename}`, 'info');
          }
        } else {
          void refresh(filter);
        }
        return;
      }

      // Guard: when Word Audio is on the 'cambridge_audio' tab, only accept scans from tmp-cambridge-audio
      // so changes in the general Downloads folder (e.g. downloading Example Audio) never overwrite Cambridge word audio.
      const isTempCambridgeDir = /tmp-cambridge-audio$/i.test(
        (scan.dir || '').replace(/\\/g, '/'),
      );
      if (filter === 'cambridge_audio' && (!isTempCambridgeDir || scan.filterMode !== 'cambridge_audio')) {
        return;
      }

      if (scan.filterMode === filter) {
        setDir(scan.dir);
        setError(scan.error ?? null);
        setFiles(scan.files);
        if (filter === 'cambridge_audio') {
          if (scan.files.length === 0) {
            setSelectedFileId(null);
          } else {
            setSelectedFileId((curr) => {
              if (curr && scan.files.some((f) => f.id === curr)) {
                return curr;
              }
              return findPreferredUsAudio(scan.files)?.id ?? scan.files[0]?.id ?? null;
            });
          }
        } else {
          // Non-Cambridge word audio folder scan: automatically select the newest audio file
          setSelectedFileId(scan.files[0]?.id ?? null);
        }
        if (scan.files[0]) {
          onNotify(`Phát hiện audio từ vựng mới: ${scan.files[0].filename}`, 'info');
        }
      } else if (scan.filterMode !== 'cambridge_audio' && filter !== 'cambridge_audio') {
        setDir(scan.dir);
        setError(scan.error ?? null);
        void refresh(filter);
      }
    },
    [filter, kind, onNotify, refresh],
  );

  const clearSelection = useCallback((alsoClearFiles = false) => {
    setSelectedFileId(null);
    if (alsoClearFiles) {
      setFiles([]);
    }
  }, []);

  return {
    files,
    setFiles,
    dir,
    setDir,
    filter,
    setFilter,
    selectedFileId,
    setSelectedFileId,
    loading,
    error,
    refresh,
    deleteFile,
    handleSseScan,
    clearSelection,
  };
}
