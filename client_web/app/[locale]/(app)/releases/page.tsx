"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import type { Release, Team, WsEvent } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ReleaseCard } from "@/components/releases/ReleaseCard";
import { CreateReleaseModal } from "@/components/releases/CreateReleaseModal";
import { Rocket, Plus } from "lucide-react";

export default function ReleasesPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [releases, setReleases] = useState<Release[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const t = useTranslations("releases.listPage");

  const load = async () => {
    try {
      const teamsData = await api.getTeams();
      setTeams(teamsData);
      const all: Release[] = [];
      await Promise.all(
        teamsData.map(async (t) => {
          try {
            const rel = await api.getReleases(t.id);
            all.push(...rel);
          } catch {
            /* ignore */
          }
        }),
      );
      all.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setReleases(all);
    } finally {
      setLoading(false);
    }
  };

  const refreshRelease = async (releaseId: string) => {
    try {
      const updated = await api.getRelease(releaseId);
      setReleases((prev) => {
        const exists = prev.some((r) => r.id === releaseId);
        if (exists) return prev.map((r) => (r.id === releaseId ? updated : r));
        return [updated, ...prev];
      });
    } catch {
      setReleases((prev) => prev.filter((r) => r.id !== releaseId));
    }
  };

  useEffect(() => {
    load();
    api
      .getOnlineUsers()
      .then(setOnlineUsernames)
      .catch(() => {});

    const onReleaseStateChanged = (e: WsEvent) => {
      if (e.type !== "release_state_changed") return;
      refreshRelease(e.release_id);
    };
    const onReleaseStepValidated = (e: WsEvent) => {
      if (e.type !== "release_step_validated") return;
      refreshRelease(e.release_id);
    };
    const onPresenceOnline = (e: WsEvent) => {
      if (e.type !== "presence_online") return;
      setOnlineUsernames(e.usernames);
    };

    vigilWs.on("release_state_changed", onReleaseStateChanged);
    vigilWs.on("release_step_validated", onReleaseStepValidated);
    vigilWs.on("presence_online", onPresenceOnline);

    return () => {
      vigilWs.off("release_state_changed", onReleaseStateChanged);
      vigilWs.off("release_step_validated", onReleaseStepValidated);
      vigilWs.off("presence_online", onPresenceOnline);
    };
  }, []);

  const managerTeams = teams.filter((t) => t.manager_id === user?.id);
  const teamName = (teamId: string) =>
    teams.find((t) => t.id === teamId)?.name ?? "—";
  const activeCount = releases.filter((r) => r.state === "in_progress").length;

  const handleCreate = async (
    teamId: string,
    title: string,
    steps: string[],
    description?: string,
  ) => {
    try {
      await api.createRelease(teamId, {
        title,
        description,
        steps: steps.map((name) => ({ name })),
      });
      showToast(t("toastCreated"), "success");
      setShowCreate(false);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };

  if (loading) {
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

  return (
    <div
      style={{
        padding: "28px clamp(16px, 4vw, 32px)",
        fontFamily: "Inter, system-ui, sans-serif",
        maxWidth: "1400px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "oklch(0.22 0.05 255)",
              border: "1px solid oklch(0.34 0.08 255)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Rocket size={20} color="oklch(0.75 0.14 255)" aria-hidden="true" />
          </div>
          <div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "oklch(0.95 0.005 260)",
                lineHeight: 1.2,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "4px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "oklch(0.72 0.01 260)",
                  padding: "2px 9px",
                  borderRadius: "12px",
                  background: "oklch(0.22 0.02 260)",
                  border: "1px solid oklch(0.30 0.02 260)",
                }}
              >
                {releases.length} {releases.length > 1 ? "releases" : "release"}
              </span>
              {activeCount > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "oklch(0.78 0.14 255)",
                    padding: "2px 9px",
                    borderRadius: "12px",
                    background: "oklch(0.22 0.04 255)",
                    border: "1px solid oklch(0.34 0.08 255)",
                  }}
                >
                  {activeCount} en cours
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 12px",
              borderRadius: "20px",
              background: "oklch(0.20 0.04 150 / 0.3)",
              border: "1px solid oklch(0.38 0.10 150)",
              fontSize: "12px",
              fontWeight: 600,
              color: "oklch(0.75 0.14 150)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "oklch(0.72 0.14 150)",
              }}
            />
            {onlineUsernames.length} {t("online")}
          </div>
          {managerTeams.length > 0 && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus
                size={14}
                aria-hidden="true"
                style={{ marginRight: "6px" }}
              />
              {t("create").replace("+ ", "")}
            </Button>
          )}
        </div>
      </div>

      {releases.length === 0 ? (
        <div
          style={{
            background: "oklch(0.195 0.015 260)",
            border: "1px solid oklch(0.30 0.02 260)",
            borderRadius: "14px",
            padding: "48px",
            textAlign: "center",
            color: "oklch(0.52 0.012 260)",
            fontSize: "13px",
          }}
        >
          {t("empty")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "18px",
          }}
        >
          {releases.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              teamName={teamName(release.team_id)}
            />
          ))}
        </div>
      )}

      {showCreate && managerTeams.length > 0 && (
        <CreateReleaseModal
          teams={managerTeams}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
