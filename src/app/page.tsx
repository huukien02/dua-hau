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
  Download,
  Columns2,
  Columns3,
  Columns4,
  FolderCog,
  FolderPlus,
  ImagePlus,
  Images,
  Pencil,
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
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};
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

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [collections, setCollections] = useState(starterCollections);
  const [activeCollection, setActiveCollection] = useState("Tất cả");
  const [displayLimit, setDisplayLimit] = useState(60);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setImages(result.images as ImageItem[]);
        setCollections(result.collections);
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
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (confirmDeleteImage) {
        if (!deletingImage) setConfirmDeleteImage(false);
      } else if (!movingImage) {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmDeleteImage, deletingImage, movingImage, selected]);

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
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    try {
      for (const [index, file] of Array.from(files).entries()) {
        const body = new FormData();
        body.append("file", file);
        body.append(
          "collection",
          activeCollection === "Tất cả" ? "Chưa phân loại" : activeCollection,
        );
        const response = await fetch("/api/upload", { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setImages((current) => [result as ImageItem, ...current]);
        setUploadProgress({ current: index + 1, total: files.length });
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
        body: JSON.stringify({ publicId: image.id, collection }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const moved = { ...image, collection: result.collection as string };
      setImages((current) =>
        current.map((item) => (item.id === image.id ? moved : item)),
      );
      setSelected(moved);
      pushToast(`Đã chuyển ảnh sang "${moved.collection}".`, "success");
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
        body: JSON.stringify({ publicId: selected.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setImages((current) =>
        current.filter((image) => image.id !== selected.id),
      );
      setSelected(null);
      setConfirmDeleteImage(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Xóa ảnh thất bại.");
    } finally {
      setDeletingImage(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">H</span>
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
          title={uploading ? "Đang tải ảnh lên" : "Tải ảnh lên"}
          aria-label={uploading ? "Đang tải ảnh lên" : "Tải ảnh lên"}
        >
          <Upload size={15} strokeWidth={2} />
          <span>{uploading ? "Đang tải..." : "Tải ảnh"}</span>
          <input
            ref={inputRef}
            className="upload-input"
            type="file"
            accept="image/*"
            multiple
            onChange={onSelect}
            disabled={uploading}
          />
        </label>
      </div>
      {uploading && (
        <div className="upload-progress" aria-live="polite">
          <div className="upload-progress-label">
            <span>Đang tải ảnh lên</span>
            <span>
              {uploadProgress.current}/{uploadProgress.total}
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={uploadProgress.total}
            aria-valuenow={uploadProgress.current}
          >
            <span
              style={{
                width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
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
                <img src={image.url} alt={image.name} />
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
          <div className="empty" title="Chưa có ảnh trong thư viện">
            <Images size={34} strokeWidth={1.4} aria-hidden="true" />
            <span className="sr-only">
              Chưa có ảnh trong thư viện. Upload ảnh đầu tiên để bắt đầu.
            </span>
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
            <figure className="image-modal-frame">
              <img src={selected.url} alt={selected.name} />
              <figcaption className="image-modal-meta">
                {[
                  selected.format?.toUpperCase(),
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
                title="Xóa ảnh"
                aria-label="Xóa ảnh"
                onClick={() => setConfirmDeleteImage(true)}
                disabled={deletingImage || movingImage}
              >
                <Trash2 size={16} />
              </button>
              <a
                className="icon-action"
                title="Tải ảnh"
                aria-label="Tải ảnh"
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
            <h3>Xóa ảnh hoàn toàn?</h3>
            <p>
              Ảnh sẽ bị xóa khỏi Cloudinary và không thể khôi phục.
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
