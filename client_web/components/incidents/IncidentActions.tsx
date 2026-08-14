import type { Incident } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ArrowUpCircle,
  UserPlus,
  Trash2,
  Pencil,
  Zap,
} from "lucide-react";

interface IncidentActionsProps {
  incident: Incident;
  canAcknowledge: boolean;
  canEscalate: boolean;
  canResolve: boolean;
  canAssign: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onAcknowledge: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ActionButton({
  Icon,
  label,
  onClick,
  tone = "default",
}: {
  Icon: React.ElementType;
  label: string;
  onClick: () => void;
  tone?: "default" | "success" | "danger";
}) {
  const toneStyles = {
    default: {
      bg: "oklch(0.235 0.018 260)",
      hoverBg: "oklch(0.28 0.025 260)",
      color: "oklch(0.92 0.005 260)",
      border: "1px solid oklch(0.32 0.02 260)",
    },
    success: {
      bg: "oklch(0.72 0.14 150)",
      hoverBg: "oklch(0.76 0.15 150)",
      color: "oklch(0.14 0.015 260)",
      border: "none",
    },
    danger: {
      bg: "transparent",
      hoverBg: "oklch(0.26 0.06 25 / 0.5)",
      color: "oklch(0.78 0.15 25)",
      border: "1px solid oklch(0.45 0.15 25 / 0.55)",
    },
  }[tone];

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "11px 14px",
        borderRadius: "10px",
        border: toneStyles.border,
        background: toneStyles.bg,
        color: toneStyles.color,
        fontSize: "13px",
        fontWeight: tone === "default" ? 600 : 700,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        fontFamily: "Inter, system-ui, sans-serif",
        transition: "background 0.15s ease, transform 0.1s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = toneStyles.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = toneStyles.bg;
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <Icon size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
      {label}
    </button>
  );
}

export function IncidentActions({
  incident,
  canAcknowledge,
  canEscalate,
  canResolve,
  canAssign,
  canEdit,
  canDelete,
  onAcknowledge,
  onEscalate,
  onResolve,
  onEdit,
  onAssign,
  onDelete,
}: IncidentActionsProps) {
  const [confirmAction, setConfirmAction] = useState<
    "resolve" | "delete" | null
  >(null);
  const noActions =
    !canAcknowledge && !canEscalate && !canResolve && !canAssign;
  const t = useTranslations("incidents.actions");
  const tCommon = useTranslations("common");

  return (
    <div
      style={{
        background: "oklch(0.20 0.016 260)",
        border: "1px solid oklch(0.30 0.02 260)",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 4px 20px oklch(0 0 0 / 0.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "8px",
            background: "oklch(0.28 0.05 85)",
            border: "1px solid oklch(0.42 0.10 85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Zap size={13} color="oklch(0.80 0.14 85)" aria-hidden="true" />
        </div>
        <div
          style={{
            fontSize: "12.5px",
            fontWeight: 700,
            color: "oklch(0.85 0.005 260)",
          }}
        >
          {t("availableActions")}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {canAcknowledge && (
          <ActionButton
            Icon={CheckCircle2}
            label={t("acknowledge")}
            onClick={onAcknowledge}
          />
        )}
        {canEscalate && (
          <ActionButton
            Icon={ArrowUpCircle}
            label={t("escalate")}
            onClick={onEscalate}
          />
        )}
        {canAssign && (
          <ActionButton
            Icon={UserPlus}
            label={t("assign")}
            onClick={onAssign}
          />
        )}
        {canEdit && (
          <ActionButton Icon={Pencil} label={t("edit")} onClick={onEdit} />
        )}
        {noActions && (
          <div
            style={{
              fontSize: "12.5px",
              color: "oklch(0.50 0.012 260)",
              fontStyle: "italic",
              padding: "6px 2px",
            }}
          >
            {t("noActions")}
          </div>
        )}

        {canResolve && (
          <div style={{ marginTop: noActions ? 0 : "6px" }}>
            <ActionButton
              Icon={CheckCircle2}
              label={t("resolve")}
              tone="success"
              onClick={() => setConfirmAction("resolve")}
            />
          </div>
        )}

        {canDelete && (
          <div
            style={{
              marginTop: "2px",
              paddingTop: "10px",
              borderTop: "1px solid oklch(0.27 0.015 260)",
            }}
          >
            <ActionButton
              Icon={Trash2}
              label={t("delete")}
              tone="danger"
              onClick={() => setConfirmAction("delete")}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmAction === "resolve"}
        title={t("confirmResolveTitle")}
        description={t("confirmResolveDescription", { title: incident.title })}
        confirmLabel={t("confirmResolveLabel")}
        cancelLabel={tCommon("cancel")}
        onConfirm={() => {
          setConfirmAction(null);
          onResolve();
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === "delete"}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", { title: incident.title })}
        confirmLabel={t("confirmDeleteLabel")}
        cancelLabel={tCommon("cancel")}
        onConfirm={() => {
          setConfirmAction(null);
          onDelete();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
