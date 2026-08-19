import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      { error: "Cloudinary chưa được cấu hình. Hãy kiểm tra file .env.local." },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const collection = String(formData.get("collection") || "library");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Không tìm thấy file ảnh." },
        { status: 400 },
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ file ảnh." },
        { status: 400 },
      );
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Ảnh phải nhỏ hơn 15MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder: `mica/${collection.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          },
          (error, response) =>
            error
              ? reject(error)
              : resolve(response as Record<string, unknown>),
        );
        upload.end(buffer);
      },
    );

    return NextResponse.json({
      id: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      name: file.name,
      collection,
    });
  } catch {
    return NextResponse.json(
      { error: "Upload thất bại. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      { error: "Cloudinary chưa được cấu hình. Hãy kiểm tra file .env.local." },
      { status: 503 },
    );
  }

  try {
    const { publicId } = (await request.json()) as { publicId?: string };
    if (!publicId || publicId.length > 500 || publicId.includes("..")) {
      return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });

    if (result.result !== "ok" && result.result !== "not found") {
      return NextResponse.json(
        { error: "Không thể xóa ảnh trên Cloudinary." },
        { status: 502 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Xóa ảnh thất bại. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
