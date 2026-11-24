import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { AudioTake } from '@ass/shared';
import { formatSeconds, useAudioDurations } from '../lib/useAudioDurations';

interface AudioStudioCardProps {
  title: string;
  subtitle?: string;
  providerBadge: string;
  accent: 'indigo' | 'emerald';
  sourceText: string;
  existingAnkiAudio?: string;
  takes: AudioTake[];
  selectedTakeId: string | null;
  generating: boolean;
  error?: string | null;
  onGenerate: () => void;
  onSelectTake: (id: string | null) => void;
  onDeleteTake: (id: string) => void;
  tuningSlot?: React.ReactNode;
}

export function AudioStudioCard({
  title,
  subtitle,
  providerBadge,
  accent,
  sourceText,
  existingAnkiAudio,
  takes,
  selectedTakeId,
  generating,
  error,
  onGenerate,
  onSelectTake,
  onDeleteTake,
  tuningSlot,
}: AudioStudioCardProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showTuning, setShowTuning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const durationItems = useMemo(
    () => takes.map((t) => ({ id: t.id, url: t.url })),
    [takes],
  );
  const durations = useAudioDurations(durationItems, true);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = (take: AudioTake) => {
    if (playingId === take.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      setProgress(0);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(`${take.url}?t=${Date.now()}`);
    audioRef.current = audio;
    setPlayingId(take.id);
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
    };
    void audio.play().catch(() => setPlayingId(null));
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
            <Volume2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isIndigo
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70'
                    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                }`}
              >
                {providerBadge}
              </span>
              {selectedTakeId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Đã chọn
                </span>
              )}
            </div>
            {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {tuningSlot && (
            <button
              type="button"
              onClick={() => setShowTuning((v) => !v)}
              title="Tinh chỉnh model & tốc độ tạo giọng"
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                showTuning
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={generating || !sourceText.trim()}
            onClick={onGenerate}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-45 ${
              isIndigo
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {takes.length === 0 ? 'Tạo Audio' : 'Tạo bản mới'}
          </button>
        </div>
      </div>

      {/* Compact source text strip */}
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <span className="shrink-0 text-[11px] font-semibold text-slate-400">Đọc từ:</span>
        {sourceText.trim() ? (
          <span className="truncate font-medium text-slate-800">“{sourceText.trim()}”</span>
        ) : (
          <span className="text-amber-600">Nhập từ vựng ở phía trên để tạo âm thanh</span>
        )}
      </div>

      {/* Inline tuning drawer */}
      {showTuning && tuningSlot && (
        <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
          {tuningSlot}
        </div>
      )}

      {existingAnkiAudio && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          <span className="truncate">
            Anki đang có: <code className="font-mono text-[11px]">{existingAnkiAudio}</code>
          </span>
          {selectedTakeId ? (
            <button
              type="button"
              onClick={() => onSelectTake(null)}
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

      {error && (
        <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Takes list */}
      {takes.length > 0 ? (
        <div className="mt-3 space-y-2">
          {takes.map((take, idx) => {
            const isSelected = take.id === selectedTakeId;
            const isPlaying = playingId === take.id;
            const durationLabel = formatSeconds(durations[take.id]);

            return (
              <div
                key={take.id}
                className={`overflow-hidden rounded-xl border transition ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-50/50 shadow-2xs'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => togglePlay(take)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                        isPlaying
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">
                          Bản #{idx + 1}
                        </span>
                        {durationLabel && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                            <Clock className="h-2.5 w-2.5" />
                            {durationLabel}
                          </span>
                        )}
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {take.voice} · {take.model}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(take.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                          {take.params?.speed !== undefined ? ` · ${take.params.speed}x` : ''}
                        </span>
                      </div>

                      {isPlaying && (
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-indigo-100">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all duration-100"
                            style={{ width: `${Math.max(8, progress)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectTake(isSelected ? null : take.id)}
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

                    <button
                      type="button"
                      onClick={() => onDeleteTake(take.id)}
                      title="Xóa bản thu tạm này"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-3 py-3 text-center text-xs text-slate-400">
          Chưa có bản thu.
        </div>
      )}
    </div>
  );
}
