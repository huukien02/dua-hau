"use client";

import {
  ChangeEvent,
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  AlertTriangle,
  Columns2,
  Columns3,
  Columns4,
  FolderPlus,
  ImagePlus,
  Images,
  Pencil,
  Search as SearchIcon,
  Moon,
  Square,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type ImageItem = {
  id: string;
  url: string;
  name: string;
  collection: string;
  width?: number;
  height?: number;
};
const starterCollections = ["Tất cả", "Chưa phân loại"];
const columnOptions = [1, 2, 3, 4] as const;
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
  const [search, setSearch] = useState("");
  const [displayLimit, setDisplayLimit] = useState(60);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [movingImage, setMovingImage] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const [editingCollection, setEditingCollection] = useState<string | null>(
    null,
  );
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
    null,
  );
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileColumns, setMobileColumns] = useState(2);
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
        setNotice(
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
    const savedTheme = localStorage.getItem("mica-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    const savedColumns = Number(localStorage.getItem("mica-columns"));
    if (columnOptions.some((option) => option === savedColumns))
      setMobileColumns(savedColumns);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mica-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("mica-columns", String(mobileColumns));
  }, [mobileColumns]);

  const filteredImages = useMemo(
    () =>
      images.filter((image) => {
        const inCollection =
          activeCollection === "Tất cả" ||
          image.collection === activeCollection;
        return (
          inCollection &&
          image.name.toLowerCase().includes(search.toLowerCase())
        );
      }),
    [activeCollection, images, search],
  );
  const visibleImages = filteredImages.slice(0, displayLimit);
  const ColumnIcon = columnIcons[mobileColumns as keyof typeof columnIcons];

  useEffect(() => {
    setDisplayLimit(60);
  }, [activeCollection, search]);

  async function uploadFiles(files: FileList | File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setNotice("");
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
      setNotice(error instanceof Error ? error.message : "Upload thất bại.");
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
      setNotice(result.error || "Không thể tạo bộ sưu tập.");
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
      setNotice(result.error || "Không thể đổi tên bộ sưu tập.");
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
      setNotice(result.error || "Không thể xóa bộ sưu tập.");
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
    setNotice("");
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
      setNotice(`Đã chuyển ảnh sang "${moved.collection}".`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Chuyển bộ sưu tập thất bại.",
      );
    } finally {
      setMovingImage(false);
    }
  }
  async function deleteImage() {
    if (!selected) return;
    setDeletingImage(true);
    setNotice("");
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
      setNotice(error instanceof Error ? error.message : "Xóa ảnh thất bại.");
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
        <div className="filters" aria-label="Bộ lọc bộ sưu tập">
          {collections.map((collection) => (
            <button
              className={`filter ${activeCollection === collection ? "active" : ""}`}
              key={collection}
              onClick={() => setActiveCollection(collection)}
            >
              {collection}
            </button>
          ))}
          <button className="filter" onClick={() => setShowCollections(true)}>
            <FolderPlus size={14} />
            <span>Thêm mới</span>
          </button>
        </div>
        <label className="search-wrap">
          <SearchIcon size={16} strokeWidth={1.8} />
          <input
            className="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm ảnh..."
          />
        </label>
      </div>
      {notice && <div className="notice">{notice}</div>}
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
        <div className="gallery-head">
          <div>
            <p className="eyebrow">Thư viện của bạn</p>
            <h2>
              {activeCollection === "Tất cả"
                ? "Tất cả hình ảnh"
                : activeCollection}
            </h2>
          </div>
          <div className="gallery-actions">
            <button
              className="column-toggle"
              title={`Đang hiển thị ${mobileColumns} ảnh mỗi hàng`}
              aria-label={`Đang hiển thị ${mobileColumns} ảnh mỗi hàng, chạm để đổi`}
              onClick={() =>
                setMobileColumns((current) => (current % 4) + 1)
              }
            >
              <ColumnIcon size={15} strokeWidth={2} />
              <span>{mobileColumns}</span>
            </button>
            <span className="count">
              {filteredImages.length.toString().padStart(2, "0")} ảnh
            </span>
            <label
              className={`rounded upload-button ${uploading ? "is-uploading" : ""}`}
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
        </div>
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
                  title="Xem ảnh"
                  onClick={() => setSelected(image)}
                >
                  <ArrowUpRight size={16} />
                </button>
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
            <div className="collection-list">
              {collections
                .filter((item) => item !== "Tất cả")
                .map((item) => (
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
                          if (event.key === "Escape")
                            setEditingCollection(null);
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
                        <small>
                          {
                            images.filter((image) => image.collection === item)
                              .length
                          }{" "}
                          ảnh
                        </small>
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
            <img
              src={selected.url}
              alt={selected.name}
              style={{ width: "100%", maxHeight: "55vh", objectFit: "contain" }}
            />
            <label className="move-collection">
              <span>Bộ sưu tập</span>
              <select
                value={selected.collection}
                disabled={movingImage}
                onChange={(event) => moveImage(event.target.value)}
              >
                {collections
                  .filter((item) => item !== "Tất cả")
                  .map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </select>
            </label>
            <div className="modal-actions" style={{ marginTop: 18 }}>
              <button
                className="btn"
                onClick={() => setConfirmDeleteImage(true)}
                disabled={deletingImage || movingImage}
              >
                Xóa
              </button>
              <a
                className="btn primary"
                href={selected.url.replace(
                  "/upload/",
                  "/upload/fl_attachment/",
                )}
                download={selected.name}
              >
                Tải ảnh
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
    </main>
  );
}
