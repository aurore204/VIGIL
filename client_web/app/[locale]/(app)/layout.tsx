"use client";

import { useEffect, useState, useRef } from "react";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import { useToast } from "@/components/ui/Toast";
import type { WsEvent } from "@/lib/types";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { notifyOS } from "@/lib/notifications";
import {
  LayoutGrid,
  AlertTriangle,
  Rocket,
  Users,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", labelKey: "dashboard", Icon: LayoutGrid },
  { href: "/incidents", labelKey: "incidents", Icon: AlertTriangle },
  { href: "/releases", labelKey: "releases", Icon: Rocket },
  { href: "/rules", labelKey: "rules", Icon: Zap },
  { href: "/teams", labelKey: "teams", Icon: Users },
  { href: "/messages", labelKey: "messages", Icon: MessageCircle },
] as const;


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated, clearAuth, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("nav");
  const tIncidentState = useTranslations("incidentState");

   const userRef = useRef(user);
    useEffect(() => {
      userRef.current = user;
    }, [user]);
  
  useEffect(() => {
    const stored = localStorage.getItem("vigil_sidebar_collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture ponctuelle de localStorage au montage, pas de boucle de rendu possible
    if (stored === "true") setCollapsed(true);
  }, []);


  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("vigil_sidebar_collapsed", String(!prev));
      return !prev;
    });
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("vigil_token");
    const activeToken = token || storedToken;

    if (!activeToken || !isAuthenticated()) {
      router.push("/auth/login");
      return;
    }

    if (!user) {
      api
        .me()
        .then(setUser)
        .catch(() => {
          clearAuth();
          router.push("/auth/login");
        });
    }

    vigilWs.connect(activeToken);

    const onIncidentStateChanged = (e: WsEvent) => {
      if (e.type !== "incident_state_changed") return;
      showToast(`Incident ${tIncidentState(e.new_state)} par ${e.by}`, "info");
    };
      const onIncidentEscalated = (e: WsEvent) => {
      if (e.type !== "incident_escalated") return;
      showToast(
        `Incident escaladé en ${e.new_severity} par ${e.by}`,
        "warning",
      );
      if (e.new_severity === "critical") {
        notifyOS("Incident critique", `Un incident a été escaladé en sévérité critique par ${e.by}`);
      }
    };
    const onIncidentAssigned = (e: WsEvent) => {
      if (e.type !== "incident_assigned") return;
      showToast(`Incident assigné à ${e.assigned_to}`, "info");
      if (e.assigned_to === userRef.current?.username) {
        notifyOS("Incident assigné", "Vous avez été assigné à un incident");
      }
    };
    const onTimelineEntryAdded = (e: WsEvent) => {
      if (e.type !== "timeline_entry_added") return;
      showToast(`Nouvelle entrée timeline par ${e.entry.author}`, "info");
    };
    const onReleaseStateChanged = (e: WsEvent) => {
      if (e.type !== "release_state_changed") return;
      if (e.new_state === "blocked") {
        showToast("Release bloquée par un incident", "error");
        notifyOS("Release bloquée", "Une release a été bloquée par un incident actif");
      }
      else if (e.new_state === "completed")
        showToast("Release complétée", "success");
      else if (e.new_state === "in_progress")
        showToast("Release débloquée, reprise en cours", "success");
    };
    const onReleaseStepValidated = (e: WsEvent) => {
      if (e.type !== "release_step_validated") return;
      showToast(`Étape "${e.step}" validée par ${e.by}`, "success");
    };
    const onMemberKicked = (e: WsEvent) => {
      if (e.type !== "member_kicked") return;
      showToast(`${e.member} retiré de la team`, "warning");
    };
    const onMemberBanned = (e: WsEvent) => {
      if (e.type !== "member_banned") return;
      showToast(`${e.member} banni`, "error");
    };
    const onPrivateMessageReceived = (e: WsEvent) => {
      if (e.type !== "private_message_received") return;
      showToast(`Nouveau message de ${e.from}`, "info");
    };
    const onReactionAdded = (e: WsEvent) => {
      if (e.type !== "reaction_added") return;
      showToast(`${e.by} a réagi avec ${e.emoji}`, "info");
    };
    const onRuleTriggered = (e: WsEvent) => {
      if (e.type !== "rule_triggered") return;
      showToast(`Règle "${e.rule_name}" déclenchée`, "success");
    };
    const onRuleFailed = (e: WsEvent) => {
      if (e.type !== "rule_failed") return;
      showToast(`Règle "${e.rule_name}" échouée : ${e.error}`, "error");
    };

    vigilWs.on("incident_state_changed", onIncidentStateChanged);
    vigilWs.on("incident_escalated", onIncidentEscalated);
    vigilWs.on("incident_assigned", onIncidentAssigned);
    vigilWs.on("timeline_entry_added", onTimelineEntryAdded);
    vigilWs.on("release_state_changed", onReleaseStateChanged);
    vigilWs.on("release_step_validated", onReleaseStepValidated);
    vigilWs.on("member_kicked", onMemberKicked);
    vigilWs.on("member_banned", onMemberBanned);
    vigilWs.on("private_message_received", onPrivateMessageReceived);
    vigilWs.on("reaction_added", onReactionAdded);
    vigilWs.on("rule_triggered", onRuleTriggered);
    vigilWs.on("rule_failed", onRuleFailed);

    return () => {
      vigilWs.off("incident_state_changed", onIncidentStateChanged);
      vigilWs.off("incident_escalated", onIncidentEscalated);
      vigilWs.off("incident_assigned", onIncidentAssigned);
      vigilWs.off("timeline_entry_added", onTimelineEntryAdded);
      vigilWs.off("release_state_changed", onReleaseStateChanged);
      vigilWs.off("release_step_validated", onReleaseStepValidated);
      vigilWs.off("member_kicked", onMemberKicked);
      vigilWs.off("member_banned", onMemberBanned);
      vigilWs.off("private_message_received", onPrivateMessageReceived);
      vigilWs.off("reaction_added", onReactionAdded);
      vigilWs.off("rule_triggered", onRuleTriggered);
      vigilWs.off("rule_failed", onRuleFailed);
      vigilWs.disconnect();
    };
  }, [token]);

  const handleLogout = async () => {
    clearAuth();
    vigilWs.disconnect();
    router.push("/auth/login");
  };

  const sidebarWidth = collapsed ? "80px" : "244px";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateColumns: `${sidebarWidth} 1fr`,
        transition: "grid-template-columns 0.2s ease",
        background: "#0B0F1A",
        color: "#EAEEF5",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "14px",
      }}
    >
      <div
        style={{
          background: "#0E1320",
          borderRight: "1px solid #1A2232",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: collapsed ? "36px" : "106px",
              height: "36px",
              overflow: "hidden",
              flexShrink: 0,
              transition: "width 0.2s ease",
            }}
          >
            <img
              src="/vigil-logo.png"
              alt="VIGIL"
              width={106}
              height={36}
              style={{
                borderRadius: "10px",
                display: "block",
                objectFit: "cover",
                objectPosition: "left center",
                width: "106px",
                height: "36px",
                maxWidth: "none",
              }}
            />
          </div>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? t("expand") : t("collapse")}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "1px solid #232C3E",
              background: "#131A28",
              color: "#6B7889",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            flex: 1,
          }}
        >
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const label = t(item.labelKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: collapsed ? "13px" : "13px 15px",
                  borderRadius: "10px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  textDecoration: "none",
                  background: isActive ? "#182238" : "transparent",
                  color: isActive ? "#9DC0F0" : "#79879C",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                <item.Icon
                  size={18}
                  style={{ flexShrink: 0 }}
                  aria-hidden="true"
                />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            background: "#131A28",
            border: "1px solid #202A3C",
            borderRadius: "13px",
            padding: "13px",
            display: "flex",
            flexDirection: "column",
            gap: "11px",
          }}
        >
          <Link
            href="/profile"
            title={collapsed ? "Profil" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              justifyContent: collapsed ? "center" : "flex-start",
              textDecoration: "none",
              borderRadius: "9px",
              padding: "5px",
              margin: "-5px",
              background: pathname.startsWith("/profile")
                ? "#182238"
                : "transparent",
            }}
          >
            <div
              style={{
                width: "31px",
                height: "31px",
                borderRadius: "50%",
                background: "#1E3A63",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#8FB3E8",
                flexShrink: 0,
              }}
            >
              {user?.username?.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#EAEEF5",
                  }}
                >
                  {user?.username}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "10.5px",
                    color: "#5FAE84",
                    marginTop: "1px",
                  }}
                >
                  <span
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "#42B085",
                      flexShrink: 0,
                    }}
                  />
                  {t("connected")}
                </div>
              </div>
            )}
          </Link>

          <div style={{ borderTop: "1px solid #202A3C", paddingTop: "11px" }}>
            <LanguageSwitcher collapsed={collapsed} />
          </div>

          <button
            onClick={handleLogout}
            title={collapsed ? t("logout") : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              padding: "7px",
              borderRadius: "8px",
              border: "1px solid #262F41",
              background: "transparent",
              color: "#8592A6",
              fontSize: "11.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <LogOut size={14} aria-hidden="true" />
            {!collapsed && t("logout")}
          </button>
        </div>
      </div>

      <div style={{ overflow: "auto", minHeight: "100vh" }}>{children}</div>
    </div>
  );
}
