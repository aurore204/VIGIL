"use client";

import { useEffect, useState,Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import type { Incident, Team, WsEvent } from "@/lib/types";
import { IncidentStateBadge, SeverityBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { IncidentTimeline } from "@/components/incidents/IncidentTimeline";
import { IncidentActions } from "@/components/incidents/IncidentActions";
import { IncidentInfo } from "@/components/incidents/IncidentInfo";
import { PresenceIndicator } from "@/components/shared/PresenceIndicator";
import { AssignModal } from "@/components/shared/AssignModal";
import { EditIncidentModal } from "@/components/incidents/EditIncidentModal";
import { Users, FileText, ArrowLeft } from "lucide-react";

function IncidentDetailContent() {
const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();
  const t = useTranslations("incidents.detailPage");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? "fr-FR" : "en-US";

  const [incident, setIncident] = useState<Incident | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchers, setWatchers] = useState<string[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [availableReactions, setAvailableReactions] = useState<string[]>([]);

  const load = async () => {
    try {
      const inc = await api.getIncident(id);
      setIncident(inc);
      const t = await api.getTeam(inc.team_id);
      setTeam(t);
      const reactions = await api.getAvailableReactions();
      setAvailableReactions(reactions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handleState = (e: WsEvent) => {
      if (e.type !== "incident_state_changed" || e.incident_id !== id) return;
      load();
    };
    const handleTimeline = (e: WsEvent) => {
      if (e.type !== "timeline_entry_added" || e.incident_id !== id) return;
      load();
    };
    const handleTimelineEdited = (e: WsEvent) => {
      if (e.type !== "timeline_entry_edited" || e.incident_id !== id) return;
      load();
    };
    const handleReactionAdded = (e: WsEvent) => {
      if (e.type !== "reaction_added" || e.incident_id !== id) return;
      load();
    };
    const handleReactionRemoved = (e: WsEvent) => {
      if (e.type !== "reaction_removed" || e.incident_id !== id) return;
      load();
    };
    const handlePresence = (e: WsEvent) => {
      if (e.type !== "presence_update" || e.resource_id !== id) return;
      setWatchers(e.watchers);
    };

    vigilWs.on("incident_state_changed", handleState);
    vigilWs.on("timeline_entry_added", handleTimeline);
    vigilWs.on("timeline_entry_edited", handleTimelineEdited);
    vigilWs.on("reaction_added", handleReactionAdded);
    vigilWs.on("reaction_removed", handleReactionRemoved);
    vigilWs.on("presence_update", handlePresence);

    return () => {
      vigilWs.off("incident_state_changed", handleState);
      vigilWs.off("timeline_entry_added", handleTimeline);
      vigilWs.off("timeline_entry_edited", handleTimelineEdited);
      vigilWs.off("reaction_added", handleReactionAdded);
      vigilWs.off("reaction_removed", handleReactionRemoved);
      vigilWs.off("presence_update", handlePresence);
    };
  }, [id]);

  useEffect(() => {
    if (!incident?.team_id) return;
    vigilWs.watch(id, "incident", incident.team_id);
    return () => {
      vigilWs.unwatch(id, "incident", incident.team_id);
    };
  }, [id, incident?.team_id]);

  if (loading || !incident)
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

  const myRole =
    team?.members.find((m) => m.user_id === user?.id)?.role ?? "observer";
  const isManager = myRole === "manager";
  const isResponder = myRole === "responder" || myRole === "manager";
  const responders = team?.members.filter((m) => m.role === "responder") ?? [];

  const handleAcknowledge = async () => {
    try {
      await api.acknowledgeIncident(id);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };
  const handleEscalate = async () => {
    try {
      await api.escalateIncident(
        id,
        incident.severity === "high" ? "critical" : "high",
      );

      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };
  const handleResolve = async () => {
    try {
      await api.resolveIncident(id);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };
  const handleDelete = async () => {
    try {
      await api.deleteIncident(id);
      showToast(t("toastDeleted"), "success");
      router.push("/incidents");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };
  const handleAssign = async (userId: string) => {
    try {
      await api.assignResponder(id, userId);
      setShowAssign(false);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };

  const handleEditIncident = async (data: {
    title?: string;
    description?: string;
    severity?: import("@/lib/types").IncidentSeverity;
  }) => {
    try {
      await api.updateIncident(id, data);
      showToast(t("toastEdited"), "success");
      setShowEdit(false);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };
  const handleAddEntry = async (content: string) => {
    await api.addTimelineEntry(id, content);
    load();
  };
  const handleEditEntry = async (entryId: string, content: string) => {
    await api.editTimelineEntry(id, entryId, content);
    showToast(t("toastEntryEdited"), "success");
    load();
  };
  const handleReaction = async (
    entryId: string,
    emoji: string,
    hasReacted: boolean,
  ) => {
    try {
      if (hasReacted) await api.removeReaction(id, entryId, emoji);
      else await api.addReaction(id, entryId, emoji);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };

  return (
    <div
      style={{
        padding: "28px 32px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <button
        onClick={() => router.push("/incidents")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          background: "none",
          border: "none",
          color: "oklch(0.58 0.012 260)",
          cursor: "pointer",
          fontSize: "12.5px",
          fontWeight: 600,
          marginBottom: "22px",
          padding: "4px 0",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "oklch(0.85 0.005 260)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "oklch(0.58 0.012 260)";
        }}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        {t("back")}
      </button>

      <div style={{ marginBottom: "28px" }}>
        <div
          style={{
            fontSize: "26px",
            fontWeight: 700,
            color: "oklch(0.96 0.005 260)",
            lineHeight: 1.25,
            marginBottom: "12px",
          }}
        >
          {incident.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <SeverityBadge severity={incident.severity} />
          <IncidentStateBadge state={incident.state} />
          {team?.name && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "14px",
                background: "oklch(0.22 0.02 260)",
                border: "1px solid oklch(0.32 0.02 260)",
                fontSize: "12px",
                fontWeight: 600,
                color: "oklch(0.70 0.01 260)",
              }}
            >
              <Users size={12} aria-hidden="true" />
              {team.name}
            </div>
          )}
        </div>
      </div>

      <PresenceIndicator watchers={watchers} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {incident.description && (
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
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "8px",
                    background: "oklch(0.24 0.02 260)",
                    border: "1px solid oklch(0.34 0.02 260)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FileText
                    size={13}
                    color="oklch(0.68 0.01 260)"
                    aria-hidden="true"
                  />
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "oklch(0.85 0.005 260)",
                  }}
                >
                  {t("description")}
                </div>
              </div>
              <div
                style={{
                  fontSize: "13.5px",
                  color: "oklch(0.80 0.005 260)",
                  lineHeight: 1.6,
                }}
              >
                {incident.description}
              </div>
            </div>
          )}

          <IncidentTimeline
            timeline={incident.timeline}
            canComment={isResponder && incident.state !== "resolved"}
            isResponder={isResponder}
            currentUserId={user?.id ?? ""}
            currentUsername={user?.username ?? ""}
            availableReactions={availableReactions}
            onAddEntry={handleAddEntry}
            onEditEntry={handleEditEntry}
            onReaction={handleReaction}
            description={null}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <IncidentInfo incident={incident} team={team} />

          <IncidentActions
            incident={incident}
            canAcknowledge={isResponder && incident.state === "open"}
            canEscalate={isResponder && incident.state === "acknowledged"}
            canResolve={
              isManager &&
              (incident.state === "acknowledged" ||
                incident.state === "escalated")
            }
            canAssign={isManager && incident.state !== "resolved"}
            canEdit={isManager}
            canDelete={isManager}
            onAcknowledge={handleAcknowledge}
            onEscalate={handleEscalate}
            onResolve={handleResolve}
            onAssign={() => setShowAssign(true)}
            onEdit={() => setShowEdit(true)}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {showAssign && (
        <AssignModal
          responders={responders}
          onClose={() => setShowAssign(false)}
          onAssign={handleAssign}
        />
      )}

      {showEdit && (
        <EditIncidentModal
          incident={incident}
          onClose={() => setShowEdit(false)}
          onSubmit={handleEditIncident}
        />
      )}
    </div>
  );
}

export default function IncidentDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: "32px", color: "oklch(0.72 0.01 260)", fontSize: "13px" }}>Loading...</div>}>
      <IncidentDetailContent />
    </Suspense>
  );
}
