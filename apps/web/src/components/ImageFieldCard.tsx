import { useRef, useState } from 'react';
import { ClipboardPaste, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import type { TempImageMedia } from '@ass/shared';

interface ImageFieldCardProps {
  label: string;
  image: TempImageMedia | null;
  existingAnkiImage?: string;
  uploading: boolean;
  badgeText?: string | null;
  highlighted?: boolean;
  onGrabClipboard: () => void;
  onUploadDataUrl: (dataUrl: string, filename?: string) => void;
  onRemoveImage: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.readAsDataURL(file);
  });
}

export function ImageFieldCard({
  label,
  image,
  existingAnkiImage,
  uploading,
  badgeText,
  highlighted = false,
  onGrabClipboard,
  onUploadDataUrl,
  onRemoveImage,
}: ImageFieldCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl) {
      onUploadDataUrl(dataUrl, file.name);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-700">{label}</label>
          {badgeText && (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200/70">
              {badgeText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={uploading}
            onClick={onGrabClipboard}
            title="Lấy ngay ảnh đang nằm trong Clipboard"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
          >
            <ClipboardPaste className="h-3 w-3" />
            Lấy Clipboard
          </button>
          {image && (
            <button
              type="button"
              onClick={onRemoveImage}
              className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" />
              Xóa
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          void handleFile(f);
          e.target.value = '';
        }}
      />

      {existingAnkiImage && !image && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-900">
          <span className="truncate">
            Anki đang có: <code className="font-mono text-[11px]">{existingAnkiImage}</code>
          </span>
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            Đang giữ ảnh cũ
          </span>
        </div>
      )}

      {image ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
            highlighted
              ? 'animate-inbox-flash border-indigo-400 bg-indigo-50/30'
              : dragging
                ? 'border-indigo-400 bg-indigo-50/40'
                : 'border-slate-200/90 bg-slate-50/60'
          }`}
        >
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer"
            title="Bấm để xem ảnh kích thước gốc"
            className="block h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <img
              src={image.url}
              alt={image.filename}
              className="h-full w-full object-contain"
            />
          </a>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800" title={image.filename}>
              {image.filename}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {formatSize(image.sizeBytes)} · {image.mimeType.replace('image/', '').toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Đổi ảnh
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onPaste={(e) => {
            const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
            const file = item?.getAsFile();
            if (file) {
              e.preventDefault();
              void handleFile(file);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-3.5 py-2.5 transition focus:border-indigo-500 focus:outline-none ${
            dragging
              ? 'border-indigo-500 bg-indigo-50/50'
              : highlighted
                ? 'animate-inbox-flash border-indigo-400 bg-indigo-50/30'
                : 'border-slate-200 bg-slate-50/40 hover:border-indigo-300 hover:bg-indigo-50/20'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-2xs ring-1 ring-slate-200/80">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </div>
            <span>
              {uploading ? 'Đang tải ảnh...' : 'Copy ảnh ở bất kỳ đâu để tự nhận, hoặc chọn file'}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <Upload className="h-3 w-3" />
            Chọn ảnh
          </span>
        </div>
      )}
    </div>
  );
}
