"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import type { Team, Incident, WsEvent } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/shared/Modal";
import { TeamCard } from "@/components/teams/TeamCard";
import { Plus, Users } from "lucide-react";

export default function TeamsPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const t = useTranslations("teams.listPage");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamIncidents, setTeamIncidents] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const data = await api.getTeams();
      setTeams(data);
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (team) => {
          try {
            const incidents: Incident[] = await api.getIncidents(team.id);
            counts[team.id] = incidents.filter(
              (i) => i.state !== "resolved",
            ).length;
          } catch {
            counts[team.id] = 0;
          }
        }),
      );
      setTeamIncidents(counts);
    } finally {
      setLoading(false);
    }
  };

  const refreshTeamIncidentCount = async (teamId: string) => {
    try {
      const incidents = await api.getIncidents(teamId);
      setTeamIncidents((prev) => ({
        ...prev,
        [teamId]: incidents.filter((i) => i.state !== "resolved").length,
      }));
    } catch {}
  };

  const refreshTeam = async (teamId: string) => {
    try {
      const updated = await api.getTeam(teamId);
      setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
    } catch {
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setTeamIncidents((prev) => {
        const { [teamId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  useEffect(() => {
    load();

    const onIncidentStateChanged = async (e: WsEvent) => {
      if (e.type !== "incident_state_changed") return;
      try {
        const inc = await api.getIncident(e.incident_id);
        refreshTeamIncidentCount(inc.team_id);
      } catch {}
    };
    const onMemberKicked = (e: WsEvent) => {
      if (e.type !== "member_kicked") return;
      refreshTeam(e.team_id);
    };
    const onMemberBanned = (e: WsEvent) => {
      if (e.type !== "member_banned") return;
      refreshTeam(e.team_id);
    };

    vigilWs.on("incident_state_changed", onIncidentStateChanged);
    vigilWs.on("member_kicked", onMemberKicked);
    vigilWs.on("member_banned", onMemberBanned);

    return () => {
      vigilWs.off("incident_state_changed", onIncidentStateChanged);
      vigilWs.off("member_kicked", onMemberKicked);
      vigilWs.off("member_banned", onMemberBanned);
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setSubmitting(true);
    try {
      await api.createTeam(newTeamName.trim(), newTeamDesc.trim() || undefined);
      showToast(t("toastCreated"), "success");
      setShowCreate(false);
      setNewTeamName("");
      setNewTeamDesc("");
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmitting(true);
    try {
      await api.joinTeam(joinCode.trim());
      showToast(t("toastJoined"), "success");
      setShowJoin(false);
      setJoinCode("");
      load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("toastInvalidCode"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    marginBottom: "14px",
    borderRadius: "8px",
    border: "1px solid oklch(0.34 0.02 260)",
    background: "oklch(0.16 0.015 260)",
    color: "oklch(0.95 0.005 260)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "oklch(0.72 0.01 260)",
    marginBottom: "6px",
  };

  const totalActiveIncidents = Object.values(teamIncidents).reduce(
    (sum, n) => sum + n,
    0,
  );

  if (loading)
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

  return (
    <div
      style={{
        padding: "28px clamp(16px, 4vw, 32px)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "nowrap",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            minWidth: 0,
            flexShrink: 1,
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "oklch(0.25 0.05 255)",
              border: "1px solid oklch(0.40 0.10 255)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Users size={20} color="oklch(0.75 0.14 255)" aria-hidden="true" />
          </div>
          <div style={{ minWidth: 0 }}>
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
                {teams.length} {teams.length > 1 ? "teams" : "team"}
              </span>
              {totalActiveIncidents > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "oklch(0.78 0.14 25)",
                    padding: "2px 9px",
                    borderRadius: "12px",
                    background: "oklch(0.25 0.05 25)",
                    border: "1px solid oklch(0.40 0.10 25)",
                  }}
                >
                  {totalActiveIncidents} incident
                  {totalActiveIncidents > 1 ? "s" : ""} actif
                  {totalActiveIncidents > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <Button variant="secondary" onClick={() => setShowJoin(true)}>
            {t("join")}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={14} aria-hidden="true" style={{ marginRight: "6px" }} />
            {t("create")}
          </Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div
          style={{
            background: "oklch(0.195 0.015 260)",
            border: "1px solid oklch(0.30 0.02 260)",
            borderRadius: "14px",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "oklch(0.52 0.012 260)",
              marginBottom: "20px",
            }}
          >
            {t("emptyTitle")}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Button variant="secondary" onClick={() => setShowJoin(true)}>
              {t("joinWithCode")}
            </Button>
            <Button onClick={() => setShowCreate(true)}>{t("create")}</Button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: "18px",
          }}
        >
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              activeIncidents={teamIncidents[team.id] ?? 0}
              currentUserId={user?.id ?? ""}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal
          title={t("createModal.title")}
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreate}>
            <label style={labelStyle}>{t("createModal.nameLabel")}</label>
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder={t("createModal.namePlaceholder")}
              required
              autoFocus
              style={inputStyle}
            />
            <label style={labelStyle}>
              {t("createModal.descriptionLabel")}
            </label>
            <input
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              placeholder={t("createModal.descriptionPlaceholder")}
              style={{ ...inputStyle, marginBottom: "20px" }}
            />
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                {t("createModal.cancel")}
              </Button>
              <Button type="submit" loading={submitting}>
                {t("createModal.submit")}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showJoin && (
        <Modal title={t("joinModal.title")} onClose={() => setShowJoin(false)}>
          <form onSubmit={handleJoin}>
            <label style={labelStyle}>{t("joinModal.codeLabel")}</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder={t("joinModal.codePlaceholder")}
              required
              autoFocus
              style={inputStyle}
            />
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowJoin(false)}
              >
                {t("joinModal.cancel")}
              </Button>
              <Button type="submit" loading={submitting}>
                {t("joinModal.submit")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
