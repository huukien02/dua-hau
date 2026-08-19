"use client";

import { useEffect } from "react";
import { CheckCircle2, X, AlertCircle } from "lucide-react";

export type Toast = { id: number; message: string; tone: "success" | "error" };

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(
      () => onDismiss(toast.id),
      toast.tone === "error" ? 6000 : 3500,
    );
    return () => clearTimeout(timer);
  }, [onDismiss, toast.id, toast.tone]);

  return (
    <div className="toast" data-tone={toast.tone}>
      {toast.tone === "error" ? (
        <AlertCircle size={16} />
      ) : (
        <CheckCircle2 size={16} />
      )}
      <p>{toast.message}</p>
      <button
        className="toast-close"
        title="Đóng"
        aria-label="Đóng thông báo"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
