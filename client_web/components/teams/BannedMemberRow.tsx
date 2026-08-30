import type { BannedMember } from "@/lib/types";
import { useTranslations, useLocale } from "next-intl";
import { ShieldOff } from "lucide-react";

interface BannedMemberRowProps {
  banned: BannedMember;
  canUnban: boolean;
  onUnban: (userId: string, username: string) => void;
}

export function BannedMemberRow({
  banned,
  canUnban,
  onUnban,
}: BannedMemberRowProps) {
  const isPermanent = !banned.expires_at;
  const t = useTranslations("teams.bannedRow");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? "fr-FR" : "en-US";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background: "oklch(0.25 0.05 25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          color: "oklch(0.78 0.14 25)",
          flexShrink: 0,
        }}
      >
        {banned.username.slice(0, 2).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: "160px" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "oklch(0.90 0.005 260)",
          }}
        >
          {banned.username}
        </div>
        <div style={{ fontSize: "11px", color: "oklch(0.52 0.012 260)" }}>
          {t("bannedBy")}{" "}
          <strong style={{ color: "oklch(0.65 0.01 260)" }}>
            {banned.banned_by_username}
          </strong>
          {isPermanent ? (
            <span style={{ color: "oklch(0.75 0.15 25)", fontWeight: 600 }}>
              {" "}
              · {t("permanently")}
            </span>
          ) : (
            <span>
              {" "}
              · {t("until")}{" "}
              <strong style={{ color: "oklch(0.82 0.14 85)" }}>
                {new Date(banned.expires_at!).toLocaleString(dateLocale, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </span>
          )}
        </div>
        {banned.reason && (
          <div
            style={{
              fontSize: "11px",
              color: "oklch(0.52 0.012 260)",
              fontStyle: "italic",
              marginTop: "2px",
            }}
          >
            {t("reason")} : {banned.reason}
          </div>
        )}
      </div>

      {canUnban && (
        <button
          onClick={() => onUnban(banned.user_id, banned.username)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid oklch(0.34 0.02 260)",
            background: "transparent",
            color: "oklch(0.72 0.14 150)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ShieldOff size={12} aria-hidden="true" />
          {t("unban")}
        </button>
      )}
    </div>
  );
}
