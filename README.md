# Mica

Thư viện ảnh cá nhân dùng Next.js và Cloudinary. Ảnh và video được trình duyệt gửi thẳng lên Cloudinary bằng chữ ký do server route tạo, nên API secret không bị đưa vào browser và không vướng giới hạn kích thước request của server. Ảnh và bộ sưu tập được lưu trên Cloudinary nên có thể xem và quản lý trên nhiều thiết bị.

## Chạy local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`, sau đó điền các biến trong `.env.local`:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Lấy các giá trị này từ Cloudinary Console > Dashboard. Không commit `.env.local` và không đưa API secret vào client code.

## Tính năng

- Upload một hoặc nhiều ảnh/video (ảnh tối đa 15MB, video tối đa 100MB), có hiển thị % tiến trình
- Video lớn được chia phần 20MB khi upload; xem video ngay trong màn hình chi tiết
- Xem ảnh lớn, tải ảnh xuống hoặc xóa khỏi Cloudinary
- Tạo, đổi tên, xóa và lọc bộ sưu tập
- Chuyển ảnh giữa các bộ sưu tập trong màn hình chi tiết
- Chọn số ảnh mỗi hàng trên mobile (1-4), lưu lại theo máy
- Ảnh được lưu vào folder `mica/<collection>` trên Cloudinary
- Danh sách bộ sưu tập được đồng bộ qua file dữ liệu trên Cloudinary.
