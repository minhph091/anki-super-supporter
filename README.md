# AnkiSuperSupporter

Công cụ hỗ trợ tạo mới & bổ sung thẻ Anki tiếng Anh nhanh chóng:
- **Từ loại (Part of Speech)** tùy chọn và định dạng theo ý muốn (`noun` / `n.` / `n`).
- **Oxford UK IPA**: tự động trích xuất phiên âm UK từ Oxford Learner's Dictionaries (hỗ trợ nhiều từ loại + đồng bộ trực tiếp từ trình duyệt qua Extension).
- **Cambridge Dictionary Viewer**: giao diện xem từ điển trực quan để chọn đúng định nghĩa Anh-Anh (hỗ trợ đồng bộ 1 chạm từ trang Cambridge gốc qua Extension hoặc nguồn dự phòng Free Dictionary API).
- **Trường thẻ Anki tùy chỉnh (Custom Fields)**: tự thêm bất kỳ trường bổ sung nào từ Note Type Anki của bạn vào Studio.
- **In đậm trong trường Example (`Ctrl+B` / nút Đậm từ vựng)**: hỗ trợ in đậm chữ trong câu ví dụ (EN & VI) với khung xem trước chuẩn Anki.
- **Browser Extension (Chrome / Edge MV3)**: bôi đen câu ví dụ trên **Grok**, **Gemini** (hoặc mọi trang web) → lọc sạch HTML → gửi thẳng vào trường `Example (EN)`, `Example (Tiếng Việt)` hoặc `Word` theo thời gian thực.
- **Audio Studio (Nghe duyệt trước khi lưu vào Anki)**:
  - Âm thanh từ vựng: **OpenAI TTS** giọng `alloy` (`gpt-4o-mini-tts` / `tts-1-hd`).
  - Âm thanh câu ví dụ: **Tự động theo dõi thư mục Downloads** — bạn tạo audio giọng Mark thủ công trên web ElevenLabs rồi tải xuống, app tự động quét và hiện ngay danh sách file ElevenLabs mới nhất để bạn nghe thử & chọn đưa vào Anki.
- **2 chế độ làm việc**: **Tạo thẻ mới** và **Bổ sung cho thẻ đã có sẵn trong Anki**.

---

## Yêu cầu chuẩn bị

1. **Node.js v20+** (máy hiện tại đã có sẵn Node v22).
2. **Anki Desktop** đã cài add-on **AnkiConnect** (vào Anki → *Tools → Add-ons → Get Add-ons...* → nhập mã `2055492159` rồi khởi động lại Anki).
3. API Key của **OpenAI** (cho giọng từ vựng `alloy`). Không cần API Key ElevenLabs.

---

## Cách chạy dự án

### 1. Cài dependencies (chỉ làm lần đầu)
```bash
npm install
```

### 2. Khởi chạy Server + Web App
```bash
npm run dev
```
Hoặc click đúp vào file `start.bat` trong thư mục dự án.

- **Web Studio**: `http://localhost:5173`
- **Local API Server**: `http://127.0.0.1:3847`

### 3. Cài đặt Browser Extension cho Grok, Gemini, Cambridge & Oxford
1. Mở Chrome / Edge / Brave / Cốc Cốc và truy cập `chrome://extensions` (hoặc `edge://extensions`).
2. Bật **Developer mode (Chế độ nhà phát triển)**.
3. Chọn **Load unpacked (Tải tiện ích đã giải nén)** và trỏ tới thư mục `apps/extension`.
4. Trên **Grok / Gemini**, bôi đen câu ví dụ → bấm nút nổi **→ Example EN** / **→ Example VI** (hoặc `Alt+1` / `Alt+2` / `Alt+3`).
5. Trên **Cambridge / Oxford**, bấm nút **⟳ Đồng bộ → Studio** (góc dưới phải) hoặc **+ Chọn vào Anki** ngay cạnh từng định nghĩa.

### 4. Cấu hình lần đầu trong Web Studio
Mở tab **Cài đặt** trong `http://localhost:5173`:
1. Bấm **Tải Deck & Note Type từ Anki** → chọn Deck, Note Type, ánh xạ các trường chính và thêm các **Trường thẻ Anki bổ sung** nếu cần.
2. Nhập **OpenAI API Key** (mặc định giọng `alloy`).
3. Kiểm tra đường dẫn **Thư mục Downloads** ở mục 3 (mặc định tự nhận thư mục `Downloads` của Windows).
4. Bấm **Lưu tất cả cài đặt**.
