import { FolderSearch, Loader2 } from 'lucide-react';
import type { AppSettings, DownloadsFilterMode, DownloadsScanResponse } from '@ass/shared';

interface DownloadsSettingsSectionProps {
  draft: AppSettings;
  scanCheck: DownloadsScanResponse | null;
  checkingFolder: boolean;
  onChangeDraft: (next: AppSettings) => void;
  onCheckDownloadsFolder: () => void;
}

export function DownloadsSettingsSection({
  draft,
  scanCheck,
  checkingFolder,
  onChangeDraft,
  onCheckDownloadsFolder,
}: DownloadsSettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">ElevenLabs Downloads</h2>
          <p className="text-xs text-slate-500">
            Tự động quét file âm thanh câu ví dụ tải về từ ElevenLabs.
          </p>
        </div>
        <button
          type="button"
          onClick={onCheckDownloadsFolder}
          disabled={checkingFolder}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          {checkingFolder ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderSearch className="h-3.5 w-3.5" />
          )}
          Kiểm tra thư mục
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700">
            Đường dẫn thư mục Downloads
          </label>
          <input
            type="text"
            placeholder="VD: C:\Users\TenBan\Downloads"
            value={draft.elevenlabsDownloads.downloadsDir}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                elevenlabsDownloads: {
                  ...draft.elevenlabsDownloads,
                  downloadsDir: e.target.value,
                },
              })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Bộ lọc file mặc định
          </label>
          <select
            value={draft.elevenlabsDownloads.filterMode}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                elevenlabsDownloads: {
                  ...draft.elevenlabsDownloads,
                  filterMode: e.target.value as DownloadsFilterMode,
                },
              })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 focus:outline-none"
          >
            <option value="elevenlabs_only">Chỉ file ElevenLabs</option>
            <option value="all_audio">Tất cả file audio (.mp3, .wav, .m4a...)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Số file mới nhất hiển thị tối đa
          </label>
          <input
            type="number"
            min={5}
            max={50}
            value={draft.elevenlabsDownloads.maxFiles}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                elevenlabsDownloads: {
                  ...draft.elevenlabsDownloads,
                  maxFiles: Number(e.target.value) || 15,
                },
              })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={draft.elevenlabsDownloads.deleteSourceAfterSave}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  elevenlabsDownloads: {
                    ...draft.elevenlabsDownloads,
                    deleteSourceAfterSave: e.target.checked,
                  },
                })
              }
              className="rounded accent-emerald-600"
            />
            Tự xóa file gốc sau khi lưu vào Anki
          </label>
        </div>
      </div>

      {scanCheck && (
        <div
          className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs ${
            scanCheck.error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {scanCheck.error ? (
            <p>✗ {scanCheck.error}</p>
          ) : (
            <p>
              ✓ Đọc thư mục <code className="font-mono">{scanCheck.dir}</code> thành công — tìm thấy{' '}
              <strong>{scanCheck.files.length}</strong> file audio phù hợp.
              {scanCheck.files[0] && (
                <>
                  {' '}
                  Mới nhất: <code className="font-mono">{scanCheck.files[0].filename}</code>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
