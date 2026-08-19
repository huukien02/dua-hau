# Mica

Thư viện ảnh cá nhân dùng Next.js và Cloudinary. Upload ảnh được xử lý ở server route để API secret không bị đưa vào browser. Ảnh và danh sách ảnh được đọc từ Cloudinary nên có thể xem trên nhiều thiết bị.

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

- Upload một hoặc nhiều ảnh bằng kéo-thả
- Xem ảnh lớn, tải ảnh xuống hoặc xóa khỏi Cloudinary
- Tìm kiếm theo tên file
- Tạo và lọc bộ sưu tập
- Ảnh được lưu vào folder `mica/<collection>` trên Cloudinary
