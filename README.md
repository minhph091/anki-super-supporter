# AnkiSuperSupporter

Công cụ Studio hỗ trợ **tạo mới** & **bổ sung (Enrich)** thẻ Anki tốc độ cao cho **Tiếng Anh (EN)** và **Tiếng Nhật (JP)**, tích hợp tra từ điển tự động, tạo câu ví dụ bằng Gemini AI, tự động lấy ảnh từ Clipboard, Audio Studio và Browser Extension thời gian thực.

---

## Tính năng nổi bật

### 1. Đa ngôn ngữ (Tiếng Anh & Tiếng Nhật) với Profile riêng biệt
* Mỗi ngôn ngữ lưu riêng **Deck**, **Note Type**, **Field Mapping**, **Custom Fields**, **TTS Instructions** và **Gemini Prompt**.
* **Tiếng Anh (EN):**
  * Tra **Cambridge Dictionary** (chế độ *English* hoặc *Learner's English*, có nguồn dự phòng Free Dictionary API) và **Oxford Learner's Dictionaries** (trích xuất **US IPA** và **Past Simple / Past Participle**).
  * Hỗ trợ định dạng Từ loại (`noun` / `n.` / `n`) và tự động đồng bộ nền từ trình duyệt qua Extension khi trang từ điển chặn bot.
* **Tiếng Nhật (JP):**
  * Tra **Weblio.jp (国語辞典)** (có nguồn dự phòng **Jisho.org**), tự động trích xuất cách đọc (`読み方`) và tự tạo **Furigana** dạng chuẩn Anki (`食[た]べる`).

### 2. Soạn thẻ thông minh & Tự động hóa
* **2 chế độ làm việc:** **Tạo thẻ mới** (cho phép tạo thẻ trùng lặp qua AnkiConnect) và **Bổ sung (Enrich)** hàng loạt cho các thẻ đã có sẵn trong Anki.
* **Tự động điền `Type Answer`:** tự động trích xuất chính xác dạng chia của từ vựng mục tiêu (số nhiều, `-ed`/`-ing`, động từ bất quy tắc, phrasal verb, hoặc thể chia tiếng Nhật) từ câu ví dụ.
* **Trường Example WYSIWYG (`Ctrl+B`):** hỗ trợ in đậm trực quan (`<b>...</b>`), đồng bộ tự động bôi đậm từ vựng mục tiêu cho cả câu ví dụ từ **Gemini AI** lẫn câu gửi từ **Browser Extension** (tránh bôi đậm thừa cả câu).
* **Trường thẻ tùy chỉnh (Custom Fields):** tự thêm bất kỳ trường bổ sung nào từ Note Type Anki của bạn và bật/tắt hiển thị từng trường.

### 3. Tạo câu ví dụ bằng Google Gemini AI
* Kết nối **Google Gemini SDK (`@google/genai`)** qua **Interactions API** (fallback tự động sang `generateContent` khi cần), tối ưu tốc độ phản hồi (timeout 15s, `thinking_level: low/minimal`).
* Tùy biến câu lệnh prompt với biến `{{word}}`, `{{pos}}`, `{{definition}}`, tùy chọn tự động in đậm từ vựng mục tiêu (`<b>...</b>`) và chọn nhanh nhiều thế hệ mô hình (`gemini-3.8-flash`, `gemini-4-hydrogen`, `gemini-3.8-flash-lite`, v.v.).

### 4. Hình ảnh (Tự động bắt Clipboard & Nén ảnh)
* **Windows Clipboard Image Watcher:** chạy nền siêu nhẹ, tự động phát hiện khi bạn chụp màn hình (`Win + Shift + S`) hoặc Copy ảnh từ bất kỳ đâu (hỗ trợ PNG/JPEG/DIBV5/File Explorer, có retry chống khóa clipboard).
* Hỗ trợ **Lấy Clipboard** thủ công, dán trực tiếp (`Ctrl+V`), kéo thả hoặc chọn file; tự động nén tối ưu dung lượng trước khi đưa vào Anki.
* Ảnh tạm lưu trên disk tại `data/tmp-images` trong suốt quá trình soạn thẻ và tự động dọn sạch khi lưu thẻ xong, thay ảnh mới hoặc khởi động lại server.

### 5. Audio Studio (Nghe duyệt trước khi lưu vào Anki)
* **Âm thanh Từ vựng (Word Audio):**
  * **OpenAI TTS:** hỗ trợ `gpt-4o-mini-tts` / `tts-1-hd` với đầy đủ giọng đọc (`alloy`, `marin`, `cedar`, `coral`, ...) và tùy chỉnh tốc độ/hướng dẫn phát âm.
  * **Quét thư mục / Cambridge Audio:**
    * Chế độ **Cambridge Audio**: chỉ tự động tải audio từ Cambridge khi bạn cấu hình nguồn Word Audio là `cambridge_audio` (ưu tiên chọn giọng US).
    * Chế độ **Quét thư mục (`all_audio` / `elevenlabs_only`)**: tự động theo dõi thư mục và mặc định chọn file audio mới nhất.
* **Âm thanh Câu ví dụ (Example Audio):**
  * Tích hợp **ElevenLabs Handoff** (mở nhanh & điền sẵn câu ví dụ vào web ElevenLabs qua Extension) và tự động quét thư mục `Downloads` theo thời gian thực để nghe thử và gắn vào thẻ (có tùy chọn tự xóa file gốc sau khi lưu).

### 6. Browser Extension (Chrome / Edge MV3)
* Hoạt động trên **Gemini**, **Grok**, **ChatGPT**, **Claude**, **Perplexity** (hoặc mọi trang web): bôi đen văn bản → bấm thanh nổi hoặc phím tắt `Alt+1` (Example EN), `Alt+2` (Example VI), `Alt+3` (Word), hay menu chuột phải → gửi thẳng vào Studio qua SSE thời gian thực.
* Đồng bộ 1 chạm hoặc chạy nền từ **Cambridge**, **Oxford**, **Weblio** và hỗ trợ **ElevenLabs Handoff**.

### 7. Bảo mật API Key
* API Key (**OpenAI**, **Gemini**) được mã hóa AES-256-GCM và lưu cục bộ **bên ngoài thư mục dự án** tại `%APPDATA%\AnkiSuperSupporter\vault.enc` (Windows) hoặc `~/.config/AnkiSuperSupporter/vault.enc` (Linux/macOS).

---

## Cấu trúc dự án

```text
AnkiSuperSupporter/
├── apps/
│   ├── server/       # Fastify Local API Server (port 3847) + Watchers + Scrapers + AI/TTS
│   ├── web/          # React + Vite + Tailwind Web Studio (port 5173)
│   └── extension/    # Browser Extension (Chrome / Edge Manifest V3)
├── packages/
│   └── shared/       # Kiểu dữ liệu, định nghĩa ngôn ngữ & tiện ích dùng chung
├── data/             # Dữ liệu tạm trên disk (tmp-images, tmp-audio, tmp-cambridge-audio)
└── start.bat         # Khởi chạy nhanh Server + Web Studio trên Windows
```

---

## Yêu cầu chuẩn bị

1. **Node.js v20+**
2. **Anki Desktop** đã cài add-on **AnkiConnect** (vào Anki → *Tools → Add-ons → Get Add-ons...* → nhập mã `2055492159` rồi khởi động lại Anki).
3. *(Tùy chọn)* API Key của **Google Gemini** (để tạo câu ví dụ bằng AI) và/hoặc **OpenAI** (nếu dùng OpenAI TTS cho âm thanh từ vựng).

---

## Cài đặt & Khởi chạy

### 1. Cài đặt dependencies (chỉ cần chạy lần đầu)
```bash
npm install
```

### 2. Chạy ở chế độ phát triển (Server + Web Studio)
```bash
npm run dev
```
Hoặc nhấp đúp file `start.bat` trên Windows.

* **Web Studio:** `http://localhost:5173`
* **Local API Server:** `http://127.0.0.1:3847`

### 3. Các lệnh build & kiểm thử
```bash
npm run build   # Build lần lượt @ass/shared -> @ass/server -> @ass/web
npm run test    # Chạy unit test cho @ass/server
```

### 4. Cài đặt Browser Extension
1. Mở Chrome / Edge / Brave / Cốc Cốc và truy cập `chrome://extensions` (hoặc `edge://extensions`).
2. Bật **Developer mode (Chế độ nhà phát triển)**.
3. Chọn **Load unpacked (Tải tiện ích đã giải nén)** và trỏ tới thư mục `apps/extension`.
4. Phím tắt khi bôi đen văn bản trên trình duyệt:
   * `Alt + 1`: Gửi vào **Example (EN / JP)**
   * `Alt + 2`: Gửi vào **Example (Tiếng Việt)**
   * `Alt + 3`: Gửi vào **Từ vựng (Word)**

---

## Cấu hình lần đầu trong Web Studio

Mở `http://localhost:5173` → chuyển sang tab **Cài đặt**:
1. **Anki & Ánh xạ trường:** Bấm **Tải Deck & Note Type từ Anki**, chọn Deck / Note Type mặc định, kiểm tra ánh xạ trường cho từng ngôn ngữ (EN / JP) và thêm Custom Fields nếu cần.
2. **AI Ví dụ (Gemini):** Nhập và lưu **Gemini API Key**, chọn mô hình mặc định và tùy chỉnh mẫu prompt.
3. **Âm thanh (Word & Example Audio):** Chọn nguồn Word Audio (OpenAI TTS, Cambridge Audio hoặc Quét thư mục) và kiểm tra đường dẫn thư mục `Downloads`.
4. **Hình ảnh:** Bật/tắt chế độ **Tự động lấy ảnh từ Clipboard**.
5. Bấm **Lưu tất cả cài đặt** để áp dụng.
