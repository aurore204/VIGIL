"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import type { Team } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/shared/Modal";

interface CreateReleaseModalProps {
  teams: Team[];
  onClose: () => void;
  onSubmit: (
    teamId: string,
    title: string,
    steps: string[],
    description?: string,
  ) => Promise<void>;
}

export function CreateReleaseModal({
  teams,
  onClose,
  onSubmit,
}: CreateReleaseModalProps) {
  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations("releases.createModal");

  const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean);
  const canSubmit = title.trim() && teamId && cleanedSteps.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(
        teamId,
        title.trim(),
        cleanedSteps,
        description.trim() || undefined,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addStep = () => setSteps((prev) => [...prev, ""]);
  const removeStep = (index: number) =>
    setSteps((prev) => prev.filter((_, i) => i !== index));
  const updateStep = (index: number, value: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid oklch(0.34 0.02 260)",
    background: "oklch(0.16 0.015 260)",
    color: "oklch(0.95 0.005 260)",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid oklch(0.34 0.02 260)",
    background: "oklch(0.16 0.015 260)",
    color: "oklch(0.95 0.005 260)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "Inter, system-ui, sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "oklch(0.72 0.01 260)",
    marginBottom: "6px",
  };

  return (
    <Modal title={t("title")} onClose={onClose} maxWidth="480px">
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <div>
          <label style={labelStyle}>
            {t("team")} <span style={{ color: "oklch(0.78 0.14 25)" }}>*</span>
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            required
            style={selectStyle}
          >
            <option value="">{t("teamPlaceholder")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>
            {t("titleLabel")}{" "}
            <span style={{ color: "oklch(0.78 0.14 25)" }}>*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>{t("description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div>
          <label style={labelStyle}>
            {t("steps")} <span style={{ color: "oklch(0.78 0.14 25)" }}>*</span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {steps.map((step, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                <input
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`${t("stepPlaceholder")} ${i + 1}`}
                  style={inputStyle}
                />
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    aria-label={t("removeStep")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "oklch(0.55 0.01 260)",
                      flexShrink: 0,
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addStep}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "oklch(0.66 0.16 255)",
              fontSize: "12.5px",
              fontWeight: 600,
              marginTop: "8px",
              padding: 0,
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {t("addStep")}
          </button>
          {cleanedSteps.length === 0 && (
            <div
              style={{
                fontSize: "11.5px",
                color: "oklch(0.78 0.14 25)",
                marginTop: "6px",
              }}
            >
              {t("stepsEmpty")}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            marginTop: "4px",
          }}
        >
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            {t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
