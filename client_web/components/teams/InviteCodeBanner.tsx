import { useTranslations } from "next-intl";

interface InviteCodeBannerProps {
  code: string;
  onCopy: () => void;
}

export function InviteCodeBanner({ code, onCopy }: InviteCodeBannerProps) {
  const t = useTranslations("teams.detailPage");

  return (
    <div
      style={{
        background: "oklch(0.20 0.04 150 / 0.3)",
        border: "1px solid oklch(0.45 0.14 150)",
        borderRadius: "10px",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "oklch(0.72 0.14 150)",
            marginBottom: "4px",
          }}
        >
          {t("codeGenerated")}
        </div>
        <div
          style={{
            fontSize: "18px",
            fontWeight: 800,
            fontFamily: "ui-monospace, monospace",
            color: "oklch(0.95 0.005 260)",
            letterSpacing: "0.1em",
          }}
        >
          {code}
        </div>
      </div>
      <button
        onClick={onCopy}
        style={{
          padding: "8px 14px",
          borderRadius: "7px",
          border: "1px solid oklch(0.45 0.14 150)",
          background: "transparent",
          color: "oklch(0.72 0.14 150)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {t("copy")}
      </button>
    </div>
  );
}
