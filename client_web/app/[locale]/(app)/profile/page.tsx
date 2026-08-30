"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { showToast } = useToast();
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [changingLanguage, setChangingLanguage] = useState(false);

  if (!user) {
    return (
      <div
        style={{
          padding: "32px",
          color: "oklch(0.72 0.01 260)",
          fontSize: "13px",
        }}
      >
        {t("loading")}
      </div>
    );
  }

  const dateLocale = locale === "fr" ? "fr-FR" : "en-US";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      showToast(t("passwordMismatch"), "error");
      return;
    }

    const payload: {
      username?: string;
      email?: string;
      current_password?: string;
      new_password?: string;
    } = {};

    if (username.trim() && username.trim() !== user.username) {
      payload.username = username.trim();
    }
    if (email.trim() && email.trim() !== user.email) {
      payload.email = email.trim();
    }
    if (newPassword) {
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setSubmitting(true);
    try {
      const updated = await api.updateProfile(payload);
      setUser(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(t("toastSuccess"), "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.includes("EMAIL_ALREADY_EXISTS") ||
        message.includes("existe déjà") ||
        message.includes("already exists")
      ) {
        showToast(t("toastEmailTaken"), "error");
      } else if (message.includes("CURRENT_PASSWORD_REQUIRED")) {
        showToast(t("toastCurrentPasswordRequired"), "error");
      } else if (
        message.includes("INVALID_CURRENT_PASSWORD") ||
        message.includes("incorrect")
      ) {
        showToast(t("toastInvalidCurrentPassword"), "error");
      } else {
        showToast(message || t("toastError"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLanguageChange = async (newLocale: "fr" | "en") => {
    if (newLocale === locale || changingLanguage) return;
    setChangingLanguage(true);
    try {
      const updated = await api.updateProfile({ language: newLocale });
      setUser(updated);
      showToast(t("toastLanguageUpdated"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    } finally {
      setChangingLanguage(false);
      router.replace(pathname, { locale: newLocale });
    }
  };

  const langButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${isActive ? "oklch(0.66 0.16 255)" : "oklch(0.34 0.02 260)"}`,
    background: isActive ? "oklch(0.22 0.04 255)" : "oklch(0.16 0.015 260)",
    color: isActive ? "oklch(0.90 0.05 255)" : "oklch(0.75 0.01 260)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: changingLanguage ? "not-allowed" : "pointer",
    opacity: changingLanguage ? 0.6 : 1,
    fontFamily: "Inter, system-ui, sans-serif",
  });

  return (
    <div
      style={{
        padding: "28px 32px",
        maxWidth: "560px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "oklch(0.95 0.005 260)",
          }}
        >
          {t("title")}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "oklch(0.60 0.01 260)",
            marginTop: "4px",
          }}
        >
          {t("subtitle")}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          background: "oklch(0.195 0.015 260)",
          border: "1px solid oklch(0.30 0.02 260)",
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          marginBottom: "20px",
        }}
      >
        <Input
          label={t("usernameLabel")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <Input
          label={t("emailLabel")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div
          style={{
            borderTop: "1px solid oklch(0.27 0.015 260)",
            paddingTop: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "oklch(0.90 0.005 260)",
              }}
            >
              {t("passwordSectionTitle")}
            </div>
            <div
              style={{
                fontSize: "11.5px",
                color: "oklch(0.55 0.01 260)",
                marginTop: "3px",
              }}
            >
              {t("passwordSectionHint")}
            </div>
          </div>

          <Input
            label={t("currentPasswordLabel")}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label={t("newPasswordLabel")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label={t("confirmPasswordLabel")}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div style={{ fontSize: "11.5px", color: "oklch(0.52 0.012 260)" }}>
          {t("memberSince")}{" "}
          {new Date(user.created_at).toLocaleDateString(dateLocale)}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" loading={submitting}>
            {t("submit")}
          </Button>
        </div>
      </form>

      <div
        style={{
          background: "oklch(0.195 0.015 260)",
          border: "1px solid oklch(0.30 0.02 260)",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "oklch(0.90 0.005 260)",
          }}
        >
          {t("languageSectionTitle")}
        </div>
        <div
          style={{
            fontSize: "11.5px",
            color: "oklch(0.55 0.01 260)",
            marginTop: "3px",
            marginBottom: "14px",
          }}
        >
          {t("languageSectionHint")}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={() => handleLanguageChange("fr")}
            disabled={changingLanguage}
            style={langButtonStyle(locale === "fr")}
          >
            {t("languageFr")}
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange("en")}
            disabled={changingLanguage}
            style={langButtonStyle(locale === "en")}
          >
            {t("languageEn")}
          </button>
        </div>
      </div>
    </div>
  );
}
