# Portfolio · Vũ Quốc Hùng

Site tĩnh (HTML/CSS/JS thuần, không cần build) gồm 3 trang:

| Trang | File | Nội dung |
|---|---|---|
| General | `index.html` | Giới thiệu, 5 nút liên hệ, 6 certificate mới nhất, 4 project mới nhất |
| Certificates | `certificates.html` | Tất cả certificate, có ô tìm kiếm + lọc |
| Projects | `projects.html` | Tất cả project, có ô tìm kiếm + lọc theo tag |

## Deploy lên Vercel

1. Tạo repo mới trên GitHub, upload toàn bộ nội dung thư mục này (hoặc `git push`).
2. Vào vercel.com → **Add New → Project** → chọn repo → **Deploy**.
   Framework chọn **Other**, không cần Build Command hay Output Directory.
3. Xong. Mỗi lần commit lên GitHub, Vercel tự deploy lại sau khoảng 30 giây.

## Thêm certificate

Mở `data/certificates.json` (sửa ngay trên GitHub bằng nút bút chì cũng được) và thêm một mục:

```json
{
  "title": "Tên khoá học / chứng chỉ",
  "issuer": "Nơi cấp (Coursera, Stanford, ...)",
  "date": "2026-11-10",
  "link": "https://link-xac-thuc",
  "image": "certs/ten-anh.jpg"
}
```

- Bắt buộc: chỉ `title`. `issuer`, `date`, `link`, `image` đều tuỳ chọn.
- Có `link` → hiện nút **View**. Có `image` → hiện ảnh, bấm vào ảnh mở ảnh lớn.
- Ảnh: hoặc upload vào thư mục `certs/` rồi ghi `"image": "certs/ten-anh.jpg"`, hoặc dán thẳng URL ảnh ở ngoài (không cần upload).
- Không có ảnh thì tự hiện khung màu với chữ cái đầu. Ảnh lỗi cũng tự về khung này.
- Xem mẫu trong `data/certificates.example.json`.

## Thêm project

Mở `data/projects.json`:

```json
{
  "title": "Tên project",
  "role": "Dòng nhỏ phía trên tiêu đề (tuỳ chọn)",
  "desc": "Mô tả ngắn",
  "date": "2026-11",
  "link": "https://demo-hoac-bai-viet",
  "github": "https://github.com/HungVulkan/ten-repo",
  "image": "projects/ten-anh.png",
  "tags": ["STM32", "SPI"]
}
```

Chỉ `title` là bắt buộc. `link` và `github` có thể có cả hai, một trong hai, hoặc không có.

## Thứ tự tự sắp xếp

Mới nhất lên đầu, theo trường `date` (`YYYY-MM-DD` hoặc `YYYY-MM`).
Nếu hai mục cùng ngày, hoặc không điền `date`, thì **mục nằm dưới trong file được coi là mới hơn**.
Vậy nên bạn cứ thêm mục mới ở cuối file là nó lên đầu trang. Mục không có `date` sẽ xếp sau các mục có `date`, vì vậy nên điền `date` cho chắc.

Lưu ý: các `date` hiện có trong `data/projects.json` là ngày ước chừng, bạn hãy sửa lại cho đúng.

## Chỉnh nội dung khác

- Thông tin cá nhân, 5 nút liên hệ, phần "What I work with": sửa trong `index.html`.
- Màu sắc: các biến ở đầu `assets/style.css` (`--bg` là màu be, `--pcb` là xanh mạch in, `--copper` là màu đồng).

## Chạy thử trên máy

Mở trực tiếp file bằng trình duyệt sẽ không đọc được JSON, nên chạy một server nhỏ:

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```
