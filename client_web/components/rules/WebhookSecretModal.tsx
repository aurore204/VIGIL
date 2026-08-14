"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/shared/Modal";
import { useToast } from "@/components/ui/Toast";
import { KeyRound, Copy, Webhook } from "lucide-react";

interface WebhookSecretModalProps {
  teamId: string;
  onClose: () => void;
}

export function WebhookSecretModal({
  teamId,
  onClose,
}: WebhookSecretModalProps) {
  const { showToast } = useToast();
  const t = useTranslations("rules.webhookModal");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const webhookPath = `/webhooks/github/${teamId}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookPath);
    showToast(t("toastUrlCopied"), "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    setSaving(true);
    try {
      await api.createWebhookSecret(teamId, "github", secret.trim());
      showToast(t("toastSaved"), "success");
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t("title")} onClose={onClose} maxWidth="480px">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "oklch(0.24 0.04 255)",
            border: "1px solid oklch(0.38 0.08 255)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Webhook size={18} color="oklch(0.75 0.14 255)" aria-hidden="true" />
        </div>
        <div>
          <div style={{ fontSize: "13px", color: "oklch(0.62 0.01 260)" }}>
            {t("subtitle")}
          </div>
        </div>
      </div>

      <p
        style={{
          fontSize: "13px",
          color: "oklch(0.68 0.01 260)",
          margin: "0 0 18px",
          lineHeight: 1.55,
        }}
      >
        {t("intro")}
      </p>

      <div
        style={{
          background: "oklch(0.22 0.02 260)",
          border: "1px solid oklch(0.30 0.02 260)",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "oklch(0.55 0.01 260)",
            marginBottom: "10px",
          }}
        >
          {t("urlSectionLabel")}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "oklch(0.16 0.015 260)",
            border: "1px solid oklch(0.30 0.02 260)",
            borderRadius: "8px",
            padding: "10px 12px",
          }}
        >
          <code
            style={{
              flex: 1,
              color: "oklch(0.75 0.14 150)",
              fontSize: "12.5px",
              fontFamily: "ui-monospace, monospace",
              wordBreak: "break-all",
            }}
          >
            {webhookPath}
          </code>
          <button
            type="button"
            onClick={handleCopyUrl}
            title={t("copyUrl")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              borderRadius: "7px",
              flexShrink: 0,
              border: "1px solid oklch(0.34 0.02 260)",
              background: "oklch(0.20 0.016 260)",
              color: "oklch(0.72 0.01 260)",
              cursor: "pointer",
            }}
          >
            <Copy size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <Input
          label={t("secretLabel")}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={t("secretPlaceholder")}
          hint={t("secretHint")}
          required
          autoFocus
        />
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            marginTop: "4px",
            paddingTop: "4px",
          }}
        >
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            <KeyRound
              size={14}
              aria-hidden="true"
              style={{ marginRight: "6px" }}
            />
            {t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
