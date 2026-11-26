"use client";

import {
  ChangeEvent,
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Columns2,
  Columns3,
  Columns4,
  FolderCog,
  FolderPlus,
  ImagePlus,
  Pencil,
  Play,
  Moon,
  Square,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Select } from "./select";
import { Toast, Toaster } from "./toast";

type ImageItem = {
  id: string;
  url: string;
  name: string;
  collection: string;
  resourceType?: "image" | "video";
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  duration?: number;
};
type SignedUpload = {
  uploadUrl: string;
  params: Record<string, string | number>;
  collection: string;
};
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
// Cloudinary yêu cầu mỗi phần (trừ phần cuối) tối thiểu 5MB.
const CHUNK_BYTES = 20 * 1024 * 1024;
function isVideo(item: ImageItem) {
  return item.resourceType === "video";
}
// Cloudinary tự tạo ảnh đại diện cho video khi đổi đuôi file sang .jpg.
function previewUrl(item: ImageItem) {
  return isVideo(item) ? item.url.replace(/\.[^./]+$/, ".jpg") : item.url;
}
function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
function sendChunk(
  url: string,
  body: FormData,
  headers: Record<string, string>,
  onProgress: (loaded: number) => void,
) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [key, value] of Object.entries(headers))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      let result: Record<string, unknown> = {};
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        // Cloudinary luôn trả JSON; nếu không thì báo lỗi chung bên dưới.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(result);
      else
        reject(
          new Error(
            (result.error as { message?: string } | undefined)?.message ||
              "Upload thất bại.",
          ),
        );
    };
    xhr.onerror = () => reject(new Error("Mất kết nối khi upload."));
    xhr.send(body);
  });
}
// Gửi file thẳng lên Cloudinary; file lớn được chia nhỏ để không vướng giới
// hạn kích thước của một request.
async function uploadToCloudinary(
  file: File,
  signed: SignedUpload,
  onProgress: (fraction: number) => void,
) {
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const single = file.size <= CHUNK_BYTES;
  let result: Record<string, unknown> = {};
  for (let start = 0; start < file.size || start === 0; start += CHUNK_BYTES) {
    const end = Math.min(start + CHUNK_BYTES, file.size);
    const body = new FormData();
    for (const [key, value] of Object.entries(signed.params))
      body.append(key, String(value));
    body.append("file", single ? file : file.slice(start, end), file.name);
    const headers: Record<string, string> = single
      ? {}
      : {
          "X-Unique-Upload-Id": uploadId,
          "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
        };
    result = await sendChunk(signed.uploadUrl, body, headers, (loaded) =>
      onProgress(Math.min(1, (start + loaded) / Math.max(1, file.size))),
    );
    if (single) break;
  }
  return result;
}
const starterCollections = ["Tất cả", "Chưa phân loại"];
const columnOptions = [1, 2, 3, 4] as const;
function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function readSetting(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    // Safari riêng tư có thể chặn localStorage.
    return null;
  }
}
function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Không lưu được thì bỏ qua, đừng để vỡ cả phần hiển thị.
  }
}
const columnIcons = {
  1: Square,
  2: Columns2,
  3: Columns3,
  4: Columns4,
};
// Miếng dưa hấu có mặt cười, dùng cho logo và màn hình trống.
function Melon() {
  return (
    <svg className="melon" viewBox="0 0 64 48" aria-hidden="true">
      <g stroke="#3b2a2f" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M3 8h58a29 29 0 0 1-58 0z" fill="#3fb87a" />
        <path d="M7.5 8h49a24.5 24.5 0 0 1-49 0z" fill="#c9f2d4" />
        <path d="M11 8h42a21 21 0 0 1-42 0z" fill="#ff5d73" />
      </g>
      <g fill="#3b2a2f">
        <circle cx="24" cy="16" r="2.8" />
        <circle cx="40" cy="16" r="2.8" />
        <ellipse cx="22" cy="31" rx="1.3" ry="2.1" transform="rotate(-20 22 31)" />
        <ellipse cx="32" cy="34" rx="1.3" ry="2.1" />
        <ellipse cx="42" cy="31" rx="1.3" ry="2.1" transform="rotate(20 42 31)" />
      </g>
      <circle cx="25" cy="15" r="1" fill="#fff" />
      <circle cx="41" cy="15" r="1" fill="#fff" />
      <ellipse cx="18.5" cy="21" rx="3.2" ry="1.9" fill="#ffb3c1" />
      <ellipse cx="45.5" cy="21" rx="3.2" ry="1.9" fill="#ffb3c1" />
      <path
        d="M28.5 20q3.5 3.5 7 0"
        fill="none"
        stroke="#3b2a2f"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [collections, setCollections] = useState(starterCollections);
  const [activeCollection, setActiveCollection] = useState("Tất cả");
  const [displayLimit, setDisplayLimit] = useState(60);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    fraction: 0,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [movingImage, setMovingImage] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [editingCollection, setEditingCollection] = useState<string | null>(
    null,
  );
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
    null,
  );
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileColumns, setMobileColumns] = useState(2);
  const settingsLoaded = useRef(false);
  const toastId = useRef(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setImages(result.images as ImageItem[]);
        setCollections(result.collections);
        // Bộ sưu tập đã lưu có thể đã bị xóa hoặc đổi tên trên máy khác.
        setActiveCollection((current) =>
          (result.collections as string[]).includes(current)
            ? current
            : "Tất cả",
        );
      })
      .catch((error: unknown) => {
        pushToast(
          error instanceof Error
            ? error.message
            : "Không thể tải thư viện ảnh.",
        );
      });
  }, []);
  useEffect(() => {
    setCollections((current) => {
      const imageCollections = images.map((image) => image.collection);
      const next = [...current, ...imageCollections].filter(
        (collection, index, all) => all.indexOf(collection) === index,
      );
      return next.length === current.length ? current : next;
    });
  }, [images]);
  useEffect(() => {
    const savedTheme = readSetting("mica-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    const savedColumns = Number(readSetting("mica-columns"));
    if (columnOptions.some((option) => option === savedColumns))
      setMobileColumns(savedColumns);
    const savedCollection = readSetting("mica-collection");
    if (savedCollection) setActiveCollection(savedCollection);
    settingsLoaded.current = true;
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (settingsLoaded.current) writeSetting("mica-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (settingsLoaded.current)
      writeSetting("mica-columns", String(mobileColumns));
  }, [mobileColumns]);
  useEffect(() => {
    if (settingsLoaded.current)
      writeSetting("mica-collection", activeCollection);
  }, [activeCollection]);

  useEffect(() => {
    if (!showCollections) setCollectionFilter("");
  }, [showCollections]);

  const filteredImages = useMemo(
    () =>
      activeCollection === "Tất cả"
        ? images
        : images.filter((image) => image.collection === activeCollection),
    [activeCollection, images],
  );
  // Điều hướng theo danh sách đang lọc; ảnh vừa chuyển sang bộ sưu tập khác
  // sẽ không còn trong danh sách nên cả hai nút đều tắt.
  const selectedIndex = selected
    ? filteredImages.findIndex((image) => image.id === selected.id)
    : -1;
  const previousImage =
    selectedIndex > 0 ? filteredImages[selectedIndex - 1] : null;
  const nextImage =
    selectedIndex >= 0 ? (filteredImages[selectedIndex + 1] ?? null) : null;
  const navigationLocked = movingImage || deletingImage || confirmDeleteImage;
  const showSibling = useCallback(
    (target: ImageItem | null) => {
      if (target && !navigationLocked) setSelected(target);
    },
    [navigationLocked],
  );

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        showSibling(event.key === "ArrowLeft" ? previousImage : nextImage);
        return;
      }
      if (event.key !== "Escape") return;
      if (confirmDeleteImage) {
        if (!deletingImage) setConfirmDeleteImage(false);
      } else if (!movingImage) {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    confirmDeleteImage,
    deletingImage,
    movingImage,
    nextImage,
    previousImage,
    selected,
    showSibling,
  ]);
  const visibleImages = filteredImages.slice(0, displayLimit);
  const ColumnIcon = columnIcons[mobileColumns as keyof typeof columnIcons];
  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>([["Tất cả", images.length]]);
    for (const image of images)
      counts.set(image.collection, (counts.get(image.collection) ?? 0) + 1);
    return counts;
  }, [images]);
  const visibleCollections = useMemo(() => {
    const keyword = collectionFilter.trim().toLowerCase();
    return collections
      .filter((item) => item !== "Tất cả")
      .filter((item) => !keyword || item.toLowerCase().includes(keyword));
  }, [collectionFilter, collections]);

  useEffect(() => {
    setDisplayLimit(60);
  }, [activeCollection]);

  const pushToast = useCallback(
    (message: string, tone: Toast["tone"] = "error") => {
      setToasts((current) => [
        ...current.slice(-2),
        { id: toastId.current++, message, tone },
      ]);
    },
    [],
  );
  const dismissToast = useCallback(
    (id: number) => setToasts((current) => current.filter((t) => t.id !== id)),
    [],
  );

  async function uploadFiles(files: FileList | File[]) {
    if (!files.length) return;
    const list = Array.from(files);
    setUploading(true);
    setUploadProgress({ current: 0, total: list.length, fraction: 0 });
    try {
      for (const [index, file] of list.entries()) {
        const resourceType = file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("image/")
            ? "image"
            : null;
        if (!resourceType)
          throw new Error(`"${file.name}" không phải ảnh hoặc video.`);
        const limit =
          resourceType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.size > limit)
          throw new Error(
            `"${file.name}" vượt quá giới hạn ${formatSize(limit)}.`,
          );

        const signResponse = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceType,
            collection:
              activeCollection === "Tất cả"
                ? "Chưa phân loại"
                : activeCollection,
          }),
        });
        const signed = await signResponse.json();
        if (!signResponse.ok) throw new Error(signed.error);

        const result = await uploadToCloudinary(
          file,
          signed as SignedUpload,
          (fraction) =>
            setUploadProgress({
              current: index,
              total: list.length,
              fraction,
            }),
        );
        const item: ImageItem = {
          id: result.public_id as string,
          url: result.secure_url as string,
          resourceType,
          width: result.width as number | undefined,
          height: result.height as number | undefined,
          format: result.format as string | undefined,
          bytes: result.bytes as number | undefined,
          duration: result.duration as number | undefined,
          name: file.name,
          collection: (signed as SignedUpload).collection,
        };
        setImages((current) => [item, ...current]);
        setUploadProgress({
          current: index + 1,
          total: list.length,
          fraction: 0,
        });
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Upload thất bại.");
    } finally {
      setUploading(false);
    }
  }
  function onSelect(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) uploadFiles(event.target.files);
    event.target.value = "";
  }
  async function addCollection() {
    const name = newCollection.trim();
    if (!name || collections.includes(name)) return;
    const response = await fetch("/api/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name }),
    });
    const result = await response.json();
    if (!response.ok) {
      pushToast(result.error || "Không thể tạo bộ sưu tập.");
      return;
    }
    setCollections(result.collections);
    setNewCollection("");
    setShowCollections(false);
    setActiveCollection(name);
  }
  function startEditingCollection(name: string) {
    setEditingCollection(name);
    setCollectionDraft(name);
  }
  async function renameCollection() {
    const nextName = collectionDraft.trim();
    if (!editingCollection || !nextName || collections.includes(nextName))
      return;
    const response = await fetch("/api/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rename",
        oldName: editingCollection,
        name: nextName,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      pushToast(result.error || "Không thể đổi tên bộ sưu tập.");
      return;
    }
    setCollections(result.collections);
    setImages((current) =>
      current.map((image) =>
        image.collection === editingCollection
          ? { ...image, collection: nextName }
          : image,
      ),
    );
    if (activeCollection === editingCollection) setActiveCollection(nextName);
    setEditingCollection(null);
    setCollectionDraft("");
  }
  async function deleteCollection() {
    if (!collectionToDelete) return;
    const response = await fetch("/api/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", oldName: collectionToDelete }),
    });
    const result = await response.json();
    if (!response.ok) {
      pushToast(result.error || "Không thể xóa bộ sưu tập.");
      return;
    }
    setCollections(result.collections);
    setImages((current) =>
      current.map((image) =>
        image.collection === collectionToDelete
          ? { ...image, collection: "Chưa phân loại" }
          : image,
      ),
    );
    if (activeCollection === collectionToDelete) setActiveCollection("Tất cả");
    setEditingCollection(null);
    setCollectionToDelete(null);
  }
  async function moveImage(collection: string) {
    if (!selected || collection === selected.collection) return;
    const image = selected;
    setMovingImage(true);
    try {
      const response = await fetch("/api/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: image.id,
          collection,
          resourceType: image.resourceType,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const moved = { ...image, collection: result.collection as string };
      setImages((current) =>
        current.map((item) => (item.id === image.id ? moved : item)),
      );
      setSelected(moved);
      pushToast(`Đã chuyển sang "${moved.collection}".`, "success");
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Chuyển bộ sưu tập thất bại.",
      );
    } finally {
      setMovingImage(false);
    }
  }
  async function deleteImage() {
    if (!selected) return;
    setDeletingImage(true);
    try {
      const response = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: selected.id,
          resourceType: selected.resourceType,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setImages((current) =>
        current.filter((image) => image.id !== selected.id),
      );
      setSelected(null);
      setConfirmDeleteImage(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Xóa file thất bại.");
    } finally {
      setDeletingImage(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Melon />
          </span>
          <span>DuaHau</span>
        </div>
        <div className="status">
          <span className="status-dot" /> CLOUDINARY LIBRARY
        </div>
        <button
          className="theme-toggle"
          title={
            theme === "light"
              ? "Chuyển sang giao diện tối"
              : "Chuyển sang giao diện sáng"
          }
          aria-label={
            theme === "light"
              ? "Chuyển sang giao diện tối"
              : "Chuyển sang giao diện sáng"
          }
          onClick={() =>
            setTheme((current) => (current === "light" ? "dark" : "light"))
          }
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </header>
      <div className="toolbar">
        <div className="collection-heading">
          <ImagePlus size={15} strokeWidth={1.8} />
          <span>Bộ sưu tập</span>
        </div>
        <Select
          ariaLabel="Chọn bộ sưu tập"
          value={activeCollection}
          onChange={setActiveCollection}
          options={collections.map((collection) => ({
            value: collection,
            label: collection,
            hint: String(collectionCounts.get(collection) ?? 0),
          }))}
        />
        <button
          className="manage-collections"
          onClick={() => setShowCollections(true)}
        >
          <FolderCog size={14} />
          <span>Quản lý</span>
        </button>
        <button
          className="column-toggle"
          title={`Đang hiển thị ${mobileColumns} ảnh mỗi hàng`}
          aria-label={`Đang hiển thị ${mobileColumns} ảnh mỗi hàng, chạm để đổi`}
          onClick={() => setMobileColumns((current) => (current % 4) + 1)}
        >
          <ColumnIcon size={16} strokeWidth={2} />
        </button>
        <label
          className={`upload-button ${uploading ? "is-uploading" : ""}`}
          title={uploading ? "Đang tải lên" : "Tải ảnh hoặc video lên"}
          aria-label={uploading ? "Đang tải lên" : "Tải ảnh hoặc video lên"}
        >
          <Upload size={15} strokeWidth={2} />
          <span>{uploading ? "Đang tải..." : "Tải lên"}</span>
          <input
            ref={inputRef}
            className="upload-input"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onSelect}
            disabled={uploading}
          />
        </label>
      </div>
      {uploading && (
        <div className="upload-progress" aria-live="polite">
          <div className="upload-progress-label">
            <span>
              Đang tải lên{" "}
              {Math.min(uploadProgress.current + 1, uploadProgress.total)}/
              {uploadProgress.total}
            </span>
            <span>{Math.round(uploadProgress.fraction * 100)}%</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={uploadProgress.total}
            aria-valuenow={uploadProgress.current + uploadProgress.fraction}
          >
            <span
              style={{
                width: `${((uploadProgress.current + uploadProgress.fraction) / uploadProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
      <section>
        {visibleImages.length ? (
          <div
            className="grid"
            style={{ "--mobile-columns": mobileColumns } as CSSProperties}
          >
            {visibleImages.map((image, index) => (
              <article
                className="tile"
                key={image.id}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <img src={previewUrl(image)} alt={image.name} loading="lazy" />
                {isVideo(image) && (
                  <span className="tile-video-badge" aria-hidden="true">
                    <Play size={12} fill="currentColor" />
                    {image.duration ? formatDuration(image.duration) : null}
                  </span>
                )}
                <button
                  className="tile-action"
                  title={`Xem ${image.name}`}
                  aria-label={`Xem ${image.name}`}
                  onClick={() => setSelected(image)}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Melon />
            <strong>Chưa có ảnh nào nè!</strong>
            <p>Bấm &ldquo;Tải lên&rdquo; để thêm ảnh hoặc video đầu tiên nha.</p>
          </div>
        )}
        {visibleImages.length < filteredImages.length && (
          <button
            className="load-more"
            onClick={() => setDisplayLimit((current) => current + 60)}
          >
            Tải thêm ảnh
            <span>{filteredImages.length - visibleImages.length} còn lại</span>
          </button>
        )}
      </section>
      {showCollections && (
        <div
          className="modal-backdrop"
          onClick={() => setShowCollections(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Bộ sưu tập</h3>
            <p className="modal-description">Chọn một bộ sưu tập để xem ảnh.</p>
            {collections.length > 8 && (
              <input
                className="collection-filter"
                value={collectionFilter}
                onChange={(event) => setCollectionFilter(event.target.value)}
                placeholder="Lọc bộ sưu tập..."
              />
            )}
            <div className="collection-list">
              {visibleCollections.length === 0 && (
                <p className="collection-empty">
                  Không có bộ sưu tập nào khớp.
                </p>
              )}
              {visibleCollections.map((item) => (
                <div className="collection-row" key={item}>
                  {editingCollection === item ? (
                    <input
                      className="collection-edit-input"
                      autoFocus
                      value={collectionDraft}
                      onChange={(event) =>
                        setCollectionDraft(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") renameCollection();
                        if (event.key === "Escape") setEditingCollection(null);
                      }}
                    />
                  ) : (
                    <button
                      className="collection-row-select"
                      onClick={() => {
                        setActiveCollection(item);
                        setShowCollections(false);
                      }}
                    >
                      <span>{item}</span>
                      <small>{collectionCounts.get(item) ?? 0} ảnh</small>
                    </button>
                  )}
                  <div className="collection-actions">
                    {editingCollection === item ? (
                      <>
                        <button
                          className="collection-edit-action"
                          onClick={renameCollection}
                        >
                          Lưu
                        </button>
                        <button
                          className="collection-cancel-action"
                          onClick={() => setEditingCollection(null)}
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      item !== "Chưa phân loại" && (
                        <button
                          className="collection-edit-action"
                          title={`Đổi tên ${item}`}
                          aria-label={`Đổi tên ${item}`}
                          onClick={() => startEditingCollection(item)}
                        >
                          <Pencil size={16} />
                        </button>
                      )
                    )}
                    {item !== "Chưa phân loại" &&
                      editingCollection !== item && (
                        <button
                          className="collection-delete-action"
                          title={`Xóa ${item}`}
                          aria-label={`Xóa ${item}`}
                          onClick={() => setCollectionToDelete(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
            <input
              autoFocus={!editingCollection}
              value={newCollection}
              onChange={(event) => setNewCollection(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addCollection()}
              placeholder="Ví dụ: Mùa hè 2026"
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCollections(false)}>
                <X size={15} />
                Đóng
              </button>
              <button className="btn primary" onClick={addCollection}>
                Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}
      {collectionToDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setCollectionToDelete(null)}
        >
          <div
            className="modal confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="warning-icon">
              <AlertTriangle size={20} />
            </div>
            <h3>Xóa bộ sưu tập?</h3>
            <p>
              Xóa &ldquo;{collectionToDelete}&rdquo; sẽ chuyển ảnh bên trong về
              &ldquo;Chưa phân loại&rdquo;. Ảnh trên Cloudinary vẫn được giữ
              nguyên.
            </p>
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => setCollectionToDelete(null)}
              >
                Hủy
              </button>
              <button className="btn danger" onClick={deleteCollection}>
                <Trash2 size={15} />
                Xóa bộ sưu tập
              </button>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal image-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <figure
              className="image-modal-frame"
              onTouchStart={(event) => {
                // Vuốt trên video là để tua, không phải chuyển file.
                if (event.target instanceof HTMLVideoElement) {
                  swipeStart.current = null;
                  return;
                }
                const touch = event.touches[0];
                swipeStart.current = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchEnd={(event) => {
                const start = swipeStart.current;
                swipeStart.current = null;
                if (!start) return;
                const touch = event.changedTouches[0];
                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;
                if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
                showSibling(dx > 0 ? previousImage : nextImage);
              }}
            >
              {isVideo(selected) ? (
                <video
                  key={selected.id}
                  src={selected.url}
                  poster={previewUrl(selected)}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img src={selected.url} alt={selected.name} />
              )}
              <figcaption className="image-modal-meta">
                {[
                  selected.format?.toUpperCase(),
                  selected.duration ? formatDuration(selected.duration) : null,
                  selected.bytes ? formatSize(selected.bytes) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </figcaption>
              <button
                className="image-modal-close"
                title="Đóng"
                aria-label="Đóng"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
            </figure>
            <div className="image-modal-bar">
              <button
                className="icon-action"
                title="Trước (←)"
                aria-label="Trước"
                disabled={!previousImage || navigationLocked}
                onClick={() => showSibling(previousImage)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-action"
                title="Tiếp theo (→)"
                aria-label="Tiếp theo"
                disabled={!nextImage || navigationLocked}
                onClick={() => showSibling(nextImage)}
              >
                <ChevronRight size={18} />
              </button>
              <Select
                ariaLabel="Chuyển sang bộ sưu tập"
                value={selected.collection}
                disabled={movingImage}
                onChange={moveImage}
                options={collections
                  .filter((item) => item !== "Tất cả")
                  .map((item) => ({ value: item, label: item }))}
              />
              <button
                className="icon-action danger"
                title={isVideo(selected) ? "Xóa video" : "Xóa ảnh"}
                aria-label={isVideo(selected) ? "Xóa video" : "Xóa ảnh"}
                onClick={() => setConfirmDeleteImage(true)}
                disabled={deletingImage || movingImage}
              >
                <Trash2 size={16} />
              </button>
              <a
                className="icon-action"
                title="Tải xuống"
                aria-label="Tải xuống"
                href={selected.url.replace(
                  "/upload/",
                  "/upload/fl_attachment/",
                )}
                download={selected.name}
              >
                <Download size={16} />
              </a>
            </div>
          </div>
        </div>
      )}
      {selected && confirmDeleteImage && (
        <div
          className="modal-backdrop"
          onClick={() => !deletingImage && setConfirmDeleteImage(false)}
        >
          <div
            className="modal confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="warning-icon">
              <AlertTriangle size={20} />
            </div>
            <h3>{isVideo(selected) ? "Xóa video" : "Xóa ảnh"} hoàn toàn?</h3>
            <p>
              File sẽ bị xóa khỏi Cloudinary và không thể khôi phục.
              {selected.name && ` (${selected.name})`}
            </p>
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => setConfirmDeleteImage(false)}
                disabled={deletingImage}
              >
                Hủy
              </button>
              <button
                className="btn danger"
                onClick={deleteImage}
                disabled={deletingImage}
              >
                <Trash2 size={15} />
                {deletingImage ? "Đang xóa..." : "Xóa hoàn toàn"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
