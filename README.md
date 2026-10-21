# Tra cứu ngày giỗ — Hướng dẫn triển khai

Ứng dụng web cài được lên điện thoại (PWA) cho **Android và iPhone**: lưu ngày giỗ theo âm lịch Việt Nam, tự tính ngày dương lịch, nhắc trước 5 ngày bằng thông báo kể cả khi không mở ứng dụng.

**Năm thẻ:** Nhập giỗ · Tra cứu (sắp đến / theo năm âm lịch) · **Trang chủ** ở giữa (chỉ xem, đầy đủ chi tiết từng người) · Âm dương (ngày giỗ là nút đỏ) · Bài cúng (tự điền tên, ngày âm, người khấn). Nút bánh răng góc trên: thông báo, sao lưu, xuất lịch, cài ứng dụng.

Toàn bộ các bước dưới đây làm **trên trình duyệt**, không cần gõ lệnh.

---

## Bước 1 — Đưa mã nguồn lên GitHub

1. Giải nén tệp `tra-cuu-ngay-gio.zip` ra một thư mục trên máy tính.
2. Vào https://github.com → bấm **+** (góc trên phải) → **New repository**.
3. Đặt tên `tra-cuu-ngay-gio`, chọn **Private**, bấm **Create repository**.
4. Ở trang vừa tạo, bấm liên kết **uploading an existing file**.
5. Mở thư mục đã giải nén, **chọn tất cả tệp và thư mục bên trong** (api, fonts, icons, lib, tests, app.js, index.html…), kéo thả vào trang GitHub. Dùng Chrome hoặc Edge trên máy tính để kéo được cả thư mục.
6. Chờ tải xong, bấm **Commit changes**.

> Kiểm tra: trong kho phải thấy các thư mục `api`, `fonts`, `icons`, `lib` và tệp `vercel.json` ở ngay cấp đầu (không nằm trong một thư mục con nữa).

## Bước 2 — Tạo dự án trên Vercel

1. Vào https://vercel.com → đăng nhập bằng tài khoản GitHub.
2. Bấm **Add New… → Project** → chọn kho `tra-cuu-ngay-gio` → **Import**.
3. Ở mục **Framework Preset** chọn **Other**. Không cần đổi Build/Output.
4. Mở mục **Environment Variables**, thêm 4 biến (giá trị lấy trong tệp `KHOA-BI-MAT.txt` gửi riêng, **không** đưa tệp này lên GitHub):

   | Tên biến | Giá trị |
   |---|---|
   | `VAPID_PUBLIC_KEY` | khóa công khai |
   | `VAPID_PRIVATE_KEY` | khóa bí mật |
   | `VAPID_SUBJECT` | `mailto:` + email của anh |
   | `CRON_SECRET` | chuỗi bí mật cho lịch chạy hằng ngày |

5. Bấm **Deploy**. Sau 1–2 phút có địa chỉ dạng `https://tra-cuu-ngay-gio.vercel.app`.

## Bước 3 — Gắn cơ sở dữ liệu Upstash Redis (để gửi thông báo)

1. Trong dự án trên Vercel, mở thẻ **Storage** → **Create Database** (hoặc **Browse Marketplace**) → chọn **Upstash for Redis** → gói **Free**.
2. Chọn vùng gần Việt Nam nhất (Singapore nếu có) → **Create** → **Connect** vào dự án `tra-cuu-ngay-gio` (chọn cả Production và Preview).
3. Vercel tự thêm biến `KV_REST_API_URL` và `KV_REST_API_TOKEN`.
4. Vào thẻ **Deployments** → bấm **⋯** ở bản mới nhất → **Redeploy** để áp dụng biến mới.

## Bước 4 — Kiểm tra

1. Mở `https://<địa-chỉ-của-anh>/api/status` → phải thấy `"push":true`. Nếu `false`, mục `missing` cho biết còn thiếu biến nào.
2. Trên điện thoại, cài ứng dụng ra màn hình chính:
   - **Android (Chrome):** mở địa chỉ → bấm **Cài ứng dụng** trong ứng dụng, hoặc menu **⋮ → Cài đặt ứng dụng**.
   - **iPhone (Safari, iOS 16.4 trở lên):** nút **Chia sẻ → Thêm vào MH chính**. Sau đó **mở ứng dụng từ biểu tượng** (bắt buộc với iPhone để có thông báo).
3. Trong ứng dụng: **Cài đặt → Bật thông báo nhắc giỗ** → cho phép → bấm **Gửi thử**. Thông báo thử phải hiện trong vài giây.
4. Lịch chạy hằng ngày: Vercel → dự án → **Settings → Cron Jobs** sẽ thấy `/api/cron` chạy lúc `0 0 * * *` (00:00 UTC = 7:00 sáng giờ Việt Nam; gói miễn phí chạy trong khoảng 7:00–7:59). Có thể bấm **Run** để chạy thử; kết quả xem ở **Logs**.

## Cập nhật ứng dụng sau này

Sửa hoặc tải tệp mới lên GitHub (Add file → Upload files → Commit). Vercel tự triển khai lại. Trên điện thoại sẽ hiện “Đã có phiên bản mới — Cập nhật”. Dữ liệu hồ sơ **không bị mất** khi cập nhật.

---

## Cách hoạt động

| Phần | Nơi chạy |
|---|---|
| Hồ sơ đầy đủ (tên, danh xưng, ngày giỗ, quê, chi họ, ghi chú) | Lưu trên **chính điện thoại** (IndexedDB + bản sao dự phòng), ứng dụng xin quyền lưu trữ bền vững |
| Tính âm lịch | Trên điện thoại và trên máy chủ, cùng một tệp `gio-core.js` |
| Thông báo khi không mở ứng dụng | Vercel Cron gọi `/api/cron` mỗi sáng → gửi Web Push (Google FCM cho Android, Apple cho iPhone) |
| Dữ liệu trên máy chủ (Upstash) | Chỉ gồm: địa chỉ nhận thông báo của máy, tên + danh xưng + ngày/tháng âm và quy tắc. **Không** gửi quê quán, chi họ, ghi chú, năm mất |

### Quy tắc tính ngày giỗ
- Âm lịch Việt Nam tính theo múi giờ UTC+7 (thuật toán thiên văn của Hồ Ngọc Đức). Đã kiểm thử khớp các năm Tết khác Trung Quốc: 1968, 1985, 2007, 2030.
- **Mất vào tháng nhuận:** người dùng chọn giỗ tháng thường hoặc tháng nhuận. Chọn tháng nhuận mà năm đó không có tháng nhuận tương ứng → giỗ tháng thường và ghi chú rõ.
- **Mất tháng thường**, năm có tháng nhuận cùng số → giỗ tháng thường (tháng đầu), có ghi chú.
- **Mất ngày 30**, năm đó tháng thiếu (29 ngày) → theo lựa chọn trong hồ sơ: ngày 29, hoặc mùng 1 tháng sau. Luôn có ghi chú màu đỏ, không đổi ngày âm thầm.
- Khi nhập năm mất, ứng dụng cảnh báo nếu năm đó không có tháng nhuận đã chọn hoặc tháng đó không có ngày 30.

### Kiểm thử tự động (dành cho kỹ thuật viên)
- `node tests/test-lich.js` — kiểm tra âm lịch 1900–2199 (109.573 ngày), các mốc Tết, tháng nhuận, tháng thiếu, quy tắc giỗ, nội dung nhắc.
- `node tests/test-api.js` (cần biến VAPID và CRON_SECRET) — kiểm tra máy chủ với Redis giả lập.
- `node tests/test-ui.js` (cần Playwright) — kiểm tra giao diện trên khung Android và iPhone.
- `node tests/dev-server.js` — chạy thử trên máy tính tại http://localhost:5173.

## Giới hạn cần biết
- **iPhone:** chỉ nhận thông báo khi đã cài ra Màn hình chính và iOS ≥ 16.4. Nếu xóa ứng dụng khỏi màn hình chính, phải bật lại thông báo.
- **Android:** thông báo đi qua Chrome; nếu tắt thông báo của Chrome hoặc máy hạn chế pin (Xiaomi, Oppo, Vivo, Samsung) thì có thể đến chậm.
- Gói Vercel miễn phí chỉ chạy lịch **1 lần/ngày** và giờ chạy dao động trong 1 tiếng.
- Dữ liệu nằm trên từng điện thoại; muốn dùng trên máy khác thì **Sao lưu** rồi **Khôi phục** bằng tệp `.json`. Chưa có đồng bộ nhiều máy theo tài khoản.
- Tệp lịch `.ics`: iPhone giữ giờ nhắc trong tệp; Google Lịch có thể bỏ qua, khi đó đặt thông báo mặc định cho lịch là 5 ngày.
