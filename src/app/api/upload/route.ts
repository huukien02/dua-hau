import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const collectionsPublicId = "mica/_collections";
type CollectionStore = {
  collections: string[];
  aliases: Record<string, string>;
};

function defaultCollectionStore(): CollectionStore {
  return { collections: ["Tất cả", "Chưa phân loại"], aliases: {} };
}

async function readCollectionStore(): Promise<CollectionStore> {
  try {
    const resource = await cloudinary.api.resource(collectionsPublicId, {
      resource_type: "raw",
      type: "upload",
    });
    const response = await fetch(`${resource.secure_url}?t=${Date.now()}`);
    if (!response.ok) throw new Error("Unable to read collection store");
    const value = (await response.json()) as Partial<CollectionStore>;
    return {
      collections: Array.isArray(value.collections)
        ? value.collections
        : defaultCollectionStore().collections,
      aliases: value.aliases || {},
    };
  } catch {
    return defaultCollectionStore();
  }
}

async function writeCollectionStore(store: CollectionStore) {
  const data = Buffer.from(JSON.stringify(store)).toString("base64");
  await cloudinary.uploader.upload(`data:application/json;base64,${data}`, {
    public_id: collectionsPublicId,
    resource_type: "raw",
    format: "json",
    overwrite: true,
    invalidate: true,
  });
}

function resolveCollection(
  collection: string,
  aliases: Record<string, string>,
) {
  let current = collection;
  const visited = new Set<string>();
  while (aliases[current] && !visited.has(current)) {
    visited.add(current);
    current = aliases[current];
  }
  return current;
}

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
            context: { collection },
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

export async function GET() {
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
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "mica/",
      max_results: 500,
      context: true,
    });
    const store = await readCollectionStore();

    const images: Array<{ collection: string; [key: string]: unknown }> =
      result.resources.map(
        (resource: {
          public_id: string;
          secure_url: string;
          width?: number;
          height?: number;
          format?: string;
          original_filename?: string;
          context?: { custom?: { collection?: string } };
        }) => {
          const folderCollection = resource.public_id
            .replace(/^mica\//, "")
            .split("/")[0];
          const collection = resolveCollection(
            resource.context?.custom?.collection ||
              (folderCollection === "chua-phan-loai"
                ? "Chưa phân loại"
                : folderCollection),
            store.aliases,
          );
          return {
            id: resource.public_id,
            url: resource.secure_url,
            width: resource.width,
            height: resource.height,
            format: resource.format,
            name:
              resource.original_filename || resource.public_id.split("/").pop(),
            collection,
          };
        },
      );

    const imageCollections = images.map((image) => image.collection);
    const collections = [...store.collections, ...imageCollections].filter(
      (collection, index, all) => all.indexOf(collection) === index,
    );

    return NextResponse.json({ images, collections });
  } catch {
    return NextResponse.json(
      { error: "Không thể tải thư viện ảnh. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
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
    const body = (await request.json()) as {
      action?: "add" | "rename" | "delete";
      name?: string;
      oldName?: string;
    };
    const store = await readCollectionStore();
    const name = body.name?.trim();
    const oldName = body.oldName?.trim();

    if (body.action === "add" && name && !store.collections.includes(name)) {
      store.collections.push(name);
    } else if (
      body.action === "rename" &&
      oldName &&
      name &&
      name !== "Tất cả" &&
      name !== "Chưa phân loại" &&
      !store.collections.includes(name)
    ) {
      store.collections = store.collections.map((item) =>
        item === oldName ? name : item,
      );
      store.aliases[oldName] = name;
    } else if (
      body.action === "delete" &&
      oldName &&
      oldName !== "Tất cả" &&
      oldName !== "Chưa phân loại"
    ) {
      store.collections = store.collections.filter((item) => item !== oldName);
      store.aliases[oldName] = "Chưa phân loại";
    } else {
      return NextResponse.json(
        { error: "Collection không hợp lệ." },
        { status: 400 },
      );
    }

    await writeCollectionStore(store);
    return NextResponse.json({ collections: store.collections });
  } catch {
    return NextResponse.json(
      { error: "Không thể đồng bộ bộ sưu tập." },
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
