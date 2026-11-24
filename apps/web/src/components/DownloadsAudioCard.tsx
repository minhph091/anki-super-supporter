import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  FolderSearch,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { DownloadedAudioFile, DownloadsFilterMode } from '@ass/shared';
import { formatSeconds, useAudioDurations } from '../lib/useAudioDurations';

interface DownloadsAudioCardProps {
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  accent?: 'emerald' | 'indigo';
  sourceLabel?: string;
  emptySourceText?: string;
  copyButtonLabel?: string;
  emptyListHint?: string;
  showDurationSeconds?: boolean;
  showCambridgeTab?: boolean;
  sourceText: string;
  downloadsDir: string;
  filterMode: DownloadsFilterMode;
  files: DownloadedAudioFile[];
  selectedFileId: string | null;
  existingAnkiAudio?: string;
  loading: boolean;
  error?: string | null;
  onChangeFilter: (mode: DownloadsFilterMode) => void;
  onRescan: () => void;
  onSelectFile: (id: string | null) => void;
  onDeleteFile: (id: string) => void;
  onOpenElevenLabsWithText?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 15) return 'vừa tải xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}

export function DownloadsAudioCard({
  title = 'Example Audio',
  subtitle = '',
  badgeLabel = 'ElevenLabs · Downloads',
  accent = 'emerald',
  sourceLabel = 'Câu sạch:',
  emptySourceText = 'Chưa có câu ví dụ',
  copyButtonLabel = 'Copy',
  emptyListHint,
  showDurationSeconds = false,
  showCambridgeTab = false,
  sourceText,
  downloadsDir,
  filterMode,
  files,
  selectedFileId,
  existingAnkiAudio,
  loading,
  error,
  onChangeFilter,
  onRescan,
  onSelectFile,
  onDeleteFile,
  onOpenElevenLabsWithText,
}: DownloadsAudioCardProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const durationItems = useMemo(
    () => files.map((f) => ({ id: f.id, url: f.url })),
    [files],
  );
  const durations = useAudioDurations(durationItems, showDurationSeconds);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Auto-reset 2-step delete confirm after 3 seconds
  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = window.setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => window.clearTimeout(t);
  }, [confirmDeleteId]);

  const togglePlay = async (file: DownloadedAudioFile) => {
    setPlayError(null);

    if (playingId === file.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      setProgress(0);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(`${file.url}?t=${Date.now()}`);
    audioRef.current = audio;
    setPlayingId(file.id);
    setProgress(0);

    audio.ontimeupdate = () => {
      if (audio.duration > 0) {
        setProgress(Math.min(100, (audio.currentTime / audio.duration) * 100));
      }
    };
    audio.onended = () => {
      setPlayingId(null);
      setProgress(0);
    };
    audio.onerror = () => {
      setPlayingId(null);
      setProgress(0);
      setPlayError(`Không phát được file "${file.filename}". Hãy bấm Quét lại hoặc kiểm tra file.`);
    };

    try {
      await audio.play();
    } catch (err) {
      setPlayingId(null);
      setProgress(0);
      setPlayError(
        `Lỗi phát âm thanh "${file.filename}": ${err instanceof Error ? err.message : 'Không thể phát.'}`,
      );
    }
  };

  const handleCopyCleanText = async () => {
    if (!sourceText.trim()) return;
    try {
      await navigator.clipboard.writeText(sourceText.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const isIndigo = accent === 'indigo';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              isIndigo ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <FolderSearch className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                  isIndigo
                    ? 'bg-indigo-50 text-indigo-700 ring-indigo-200/70'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                    isIndigo ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}
                />
                {badgeLabel}
              </span>
              {selectedFileId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Đã chọn
                </span>
              )}
            </div>
            {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onOpenElevenLabsWithText && (
            <button
              type="button"
              onClick={onOpenElevenLabsWithText}
              title="Mở ElevenLabs và tự động điền câu ví dụ vào ô nhập liệu (qua Extension)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
            >
              {sourceText.trim() ? 'Mở & Điền ElevenLabs' : 'Mở ElevenLabs'}
              <ExternalLink className="h-3 w-3" />
            </button>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={onRescan}
            title="Quét lại thư mục"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              onOpenElevenLabsWithText
                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                : isIndigo
                  ? 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'
                  : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Quét lại
          </button>
        </div>
      </div>

      {/* Source text + quick copy */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-slate-400">{sourceLabel} </span>
          {sourceText.trim() ? (
            <span className="italic text-slate-800">“{sourceText.trim()}”</span>
          ) : (
            <span className="text-amber-600">{emptySourceText}</span>
          )}
        </div>
        {sourceText.trim() && (
          <button
            type="button"
            onClick={() => void handleCopyCleanText()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Đã copy' : copyButtonLabel}
          </button>
        )}
      </div>

      {/* Filter bar + watched folder */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => onChangeFilter('elevenlabs_only')}
            className={`rounded-md px-2.5 py-1 font-semibold transition ${
              filterMode === 'elevenlabs_only'
                ? isIndigo
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chỉ file ElevenLabs
          </button>
          <button
            type="button"
            onClick={() => onChangeFilter('all_audio')}
            className={`rounded-md px-2.5 py-1 font-semibold transition ${
              filterMode === 'all_audio'
                ? isIndigo
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả audio mới nhất
          </button>
          {showCambridgeTab && (
            <button
              type="button"
              onClick={() => onChangeFilter('cambridge_audio')}
              className={`rounded-md px-2.5 py-1 font-semibold transition ${
                filterMode === 'cambridge_audio'
                  ? isIndigo
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audio Cambridge
            </button>
          )}
        </div>

        <span
          className="max-w-xs truncate font-mono text-[10px] text-slate-400"
          title={filterMode === 'cambridge_audio' ? 'Lưu tạm · tự xóa khi lưu thẻ / tra từ mới / tải lại trang' : downloadsDir}
        >
          {filterMode === 'cambridge_audio' ? 'Lưu tạm · tự xóa' : downloadsDir || 'Downloads'}
        </span>
      </div>

      {existingAnkiAudio && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          <span className="truncate">
            Anki đang có: <code className="font-mono text-[11px]">{existingAnkiAudio}</code>
          </span>
          {selectedFileId ? (
            <button
              type="button"
              onClick={() => onSelectFile(null)}
              className="shrink-0 font-semibold text-amber-800 underline hover:text-amber-950"
            >
              Giữ bản cũ
            </button>
          ) : (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              Đang giữ bản cũ
            </span>
          )}
        </div>
      )}

      {(error || playError) && (
        <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {playError || error}
        </div>
      )}

      {/* Scanned files list */}
      {files.length > 0 ? (
        <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-0.5">
          {files.map((file, idx) => {
            const isSelected = file.id === selectedFileId;
            const isPlaying = playingId === file.id;
            const isConfirmingDelete = confirmDeleteId === file.id;
            const durationLabel = showDurationSeconds ? formatSeconds(durations[file.id]) : null;

            return (
              <div
                key={file.id}
                className={`overflow-hidden rounded-xl border transition ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-50/55 shadow-2xs'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => void togglePlay(file)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                        isPlaying
                          ? isIndigo
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-emerald-600 text-white shadow-xs'
                          : isIndigo
                            ? 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      title={isPlaying ? 'Dừng phát' : 'Nghe thử'}
                    >
                      {isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 pl-0.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {idx === 0 && (
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              isIndigo
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            Mới nhất
                          </span>
                        )}
                        {durationLabel && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                            <Clock className="h-2.5 w-2.5" />
                            {durationLabel}
                          </span>
                        )}
                        <span
                          className="truncate text-xs font-semibold text-slate-800"
                          title={file.filename}
                        >
                          {file.filename}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatRelativeTime(file.modifiedMs)} · {formatSize(file.sizeBytes)}
                      </p>

                      {isPlaying && (
                        <div
                          className={`mt-1.5 h-1 w-full overflow-hidden rounded-full ${
                            isIndigo ? 'bg-indigo-100' : 'bg-emerald-100'
                          }`}
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-100 ${
                              isIndigo ? 'bg-indigo-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.max(8, progress)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectFile(isSelected ? null : file.id)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đang chọn
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5 text-slate-400" />
                          Chọn dùng
                        </>
                      )}
                    </button>

                    {isConfirmingDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          onDeleteFile(file.id);
                        }}
                        className="rounded-lg bg-rose-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-rose-700"
                        title="Bấm lần nữa để xác nhận xóa file khỏi ổ cứng"
                      >
                        Xóa file?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(file.id)}
                        title="Xóa file này khỏi thư mục (cần xác nhận)"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-3 py-3 text-center text-xs text-slate-400">
          {filterMode === 'cambridge_audio'
            ? 'Chưa có file Audio Cambridge. Tra từ tiếng Anh để tự động tải 2 file audio đầu tiên từ Cambridge.'
            : emptyListHint || 'Chưa có file audio trong thư mục.'}
        </div>
      )}
    </div>
  );
}
