import { useEffect, useRef } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading = false,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onCancel}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "oklch(0 0 0 / 0.65)",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "oklch(0.195 0.015 260)",
          border: "1px solid oklch(0.34 0.02 260)",
          borderRadius: "14px",
          padding: "24px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 8px 40px oklch(0 0 0 / 0.5)",
        }}
      >
        <h2
          id="dialog-title"
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "oklch(0.95 0.005 260)",
            margin: "0 0 8px",
          }}
        >
          {title}
        </h2>
        <p
          id="dialog-description"
          style={{
            fontSize: "13px",
            color: "oklch(0.72 0.01 260)",
            margin: children ? "0 0 12px" : "0 0 20px",
          }}
        >
          {description}
        </p>
        {children}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: children ? "4px" : 0,
          }}
        >
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
