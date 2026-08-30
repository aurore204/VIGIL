"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { showToast } = useToast();
  const t = useTranslations("auth");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirm) {
      setError(t("register.errors.allFieldsRequired"));
      return;
    }
    if (password !== confirm) {
      setError(t("register.errors.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("register.errors.passwordTooShort"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.register(email, password, username);
      showToast(t("register.successToast"), "success");
      router.push("/auth/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("register.errors.generic");
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    marginBottom: "16px",
    borderRadius: "8px",
    border: "1px solid oklch(0.34 0.02 260)",
    background: "oklch(0.195 0.015 260)",
    color: "oklch(0.95 0.005 260)",
    fontSize: "14px",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "oklch(0.72 0.01 260)",
    marginBottom: "6px",
  } as React.CSSProperties;

  return (
    <div style={{ width: "100%", maxWidth: "360px" }}>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          background: "oklch(0.195 0.015 260)",
          border: "1px solid oklch(0.34 0.02 260)",
          borderRadius: "10px",
          padding: "4px",
          marginBottom: "28px",
        }}
      >
        <Link
          href="/auth/login"
          style={{
            flex: 1,
            padding: "9px",
            borderRadius: "7px",
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "center",
            background: "transparent",
            color: "oklch(0.72 0.01 260)",
            textDecoration: "none",
            display: "block",
          }}
        >
          {t("tabs.login")}
        </Link>
        <div
          style={{
            flex: 1,
            padding: "9px",
            borderRadius: "7px",
            fontSize: "13px",
            fontWeight: 700,
            textAlign: "center",
            background: "oklch(0.66 0.16 255)",
            color: "oklch(0.16 0.015 260)",
          }}
        >
          {t("tabs.register")}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <label style={labelStyle}>{t("register.usernameLabel")}</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("register.usernamePlaceholder")}
          required
          autoComplete="username"
          style={inputStyle}
        />

        <label style={labelStyle}>{t("register.emailLabel")}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("register.emailPlaceholder")}
          required
          autoComplete="email"
          style={inputStyle}
        />

        <label style={labelStyle}>{t("register.passwordLabel")}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("register.passwordPlaceholder")}
          required
          autoComplete="new-password"
          style={inputStyle}
        />

        <label style={labelStyle}>{t("register.confirmPasswordLabel")}</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("register.passwordPlaceholder")}
          required
          autoComplete="new-password"
          style={{ ...inputStyle, marginBottom: "8px" }}
        />

        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              marginBottom: "8px",
              background: "oklch(0.25 0.05 25)",
              border: "1px solid oklch(0.45 0.15 25)",
              color: "oklch(0.85 0.12 25)",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "12px",
            padding: "11px",
            borderRadius: "8px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 700,
            background: loading
              ? "oklch(0.50 0.10 255)"
              : "oklch(0.66 0.16 255)",
            color: "oklch(0.16 0.015 260)",
          }}
        >
          {loading
            ? t("register.submitButtonLoading")
            : t("register.submitButton")}
        </button>
      </form>
    </div>
  );
}
