import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const collectionsPublicId = "mica/_collections.json";
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
    overwrite: true,
    invalidate: true,
  });
}

type CloudinaryResource = {
  public_id: string;
  secure_url: string;
  resource_type: "image" | "video";
  created_at?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  duration?: number;
  original_filename?: string;
  context?: { custom?: { collection?: string } };
};

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

type ResourceType = "image" | "video";

function parseResourceType(value: unknown): ResourceType | null {
  return value === "image" || value === "video" ? value : null;
}

// Trình duyệt gửi file thẳng lên Cloudinary; server chỉ ký các tham số upload
// nên API secret không bao giờ rời khỏi server.
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
    const body = (await request.json()) as {
      collection?: string;
      resourceType?: string;
    };
    const collection = body.collection?.trim() || "Chưa phân loại";
    const resourceType = parseResourceType(body.resourceType);

    if (!resourceType) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ file ảnh hoặc video." },
        { status: 400 },
      );
    }
    if (collection === "Tất cả" || collection.length > 200 || /[=|]/.test(collection)) {
      return NextResponse.json(
        { error: "Bộ sưu tập không hợp lệ." },
        { status: 400 },
      );
    }

    const params = {
      timestamp: Math.round(Date.now() / 1000),
      folder: `mica/${collection.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      context: `collection=${collection}`,
    };
    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET,
    );

    return NextResponse.json({
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      params: {
        ...params,
        signature,
        api_key: process.env.CLOUDINARY_API_KEY,
      },
      collection,
    });
  } catch {
    return NextResponse.json(
      { error: "Không thể chuẩn bị upload. Vui lòng thử lại." },
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
    const listResources = (resource_type: ResourceType) =>
      cloudinary.api.resources({
        resource_type,
        type: "upload",
        prefix: "mica/",
        max_results: 500,
        context: true,
      }) as Promise<{ resources: CloudinaryResource[] }>;
    const [imageResult, videoResult, store] = await Promise.all([
      listResources("image"),
      listResources("video"),
      readCollectionStore(),
    ]);
    const resources = [...imageResult.resources, ...videoResult.resources].sort(
      (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
    );

    const images: Array<{ collection: string; [key: string]: unknown }> =
      resources.map((resource) => {
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
            resourceType: resource.resource_type,
            width: resource.width,
            height: resource.height,
            format: resource.format,
            bytes: resource.bytes,
            duration: resource.duration,
            name:
              resource.original_filename || resource.public_id.split("/").pop(),
            collection,
          };
      });

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
      delete store.aliases[name];
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
      delete store.aliases[name];
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

export async function PATCH(request: Request) {
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
    const { publicId, collection, resourceType } = (await request.json()) as {
      publicId?: string;
      collection?: string;
      resourceType?: string;
    };
    const name = collection?.trim();

    if (!publicId || publicId.length > 500 || publicId.includes("..")) {
      return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
    }
    if (!name || name === "Tất cả" || /[=|]/.test(name)) {
      return NextResponse.json(
        { error: "Bộ sưu tập không hợp lệ." },
        { status: 400 },
      );
    }

    const store = await readCollectionStore();
    // Tên vừa bị đổi/xóa vẫn còn alias, đưa về tên đang thực sự dùng.
    const target = resolveCollection(name, store.aliases);
    // GET trả về cả bộ sưu tập suy ra từ folder ảnh, chưa chắc có trong store.
    if (!store.collections.includes(target)) {
      store.collections.push(target);
      await writeCollectionStore(store);
    }

    await cloudinary.api.update(publicId, {
      resource_type: parseResourceType(resourceType) ?? "image",
      type: "upload",
      context: `collection=${target}`,
    });

    return NextResponse.json({ id: publicId, collection: target });
  } catch {
    return NextResponse.json(
      { error: "Không thể chuyển bộ sưu tập. Vui lòng thử lại." },
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
    const { publicId, resourceType } = (await request.json()) as {
      publicId?: string;
      resourceType?: string;
    };
    if (!publicId || publicId.length > 500 || publicId.includes("..")) {
      return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: parseResourceType(resourceType) ?? "image",
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
