import { Chrome, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: 'Ctrl + Enter', desc: 'Lưu thẻ (hoặc Cập nhật & Thẻ tiếp theo)' },
  { keys: 'Ctrl + K', desc: 'Đưa con trỏ nhanh về ô Từ vựng (Word)' },
  { keys: 'Ctrl + B', desc: 'In đậm đoạn chữ đang bôi đen trong Example' },
  { keys: 'Alt + ← / →', desc: 'Chuyển thẻ trước / sau trong chế độ Bổ sung' },
  { keys: 'Alt + 1 / 2', desc: '(Extension) Gửi text bôi đen → Example EN / VI' },
  { keys: 'Alt + 3', desc: '(Extension) Gửi text bôi đen → Word & Tra từ' },
];

export function ExtensionSettingsSection() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-indigo-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 text-indigo-950">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Chrome className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold">Browser Extension</h2>
            <p className="text-xs text-slate-500">
              Gửi text từ Grok/Gemini, đồng bộ từ điển &amp; tự điền ElevenLabs.
            </p>
          </div>
        </div>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700">
          <li>
            Mở <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">chrome://extensions</code>{' '}
            hoặc{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">edge://extensions</code>.
          </li>
          <li>
            Bật <strong>Developer mode</strong> ở góc trên bên phải.
          </li>
          <li>
            Chọn <strong>Load unpacked</strong> → trỏ vào thư mục{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">apps/extension</code>.
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-900">Bảng phím tắt nhanh</h3>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs"
            >
              <span className="text-slate-600">{s.desc}</span>
              <kbd className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 shadow-2xs">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
