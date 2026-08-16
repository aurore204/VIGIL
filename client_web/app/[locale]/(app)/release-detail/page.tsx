"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import type { Release, Team, WsEvent } from "@/lib/types";
import { ReleaseStateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StepList } from "@/components/releases/StepList";
import { useToast } from "@/components/ui/Toast";
import { shadow } from "@/lib/tokens";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Users,
  Calendar,
} from "lucide-react";
import { PresenceIndicator } from "@/components/shared/PresenceIndicator";

function ReleaseDetailContent() {
const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();
  const t = useTranslations("releases.detailPage");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? "fr-FR" : "en-US";

  const [release, setRelease] = useState<Release | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"cancel" | null>(null);
  const [watchers, setWatchers] = useState<string[]>([]);

  const load = async () => {
    try {
      const rel = await api.getRelease(id);
      setRelease(rel);
      const t = await api.getTeam(rel.team_id);
      setTeam(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handleState = (e: WsEvent) => {
      if (e.type !== "release_state_changed" || e.release_id !== id) return;
      load();
    };
    const handleStep = (e: WsEvent) => {
      if (e.type !== "release_step_validated" || e.release_id !== id) return;
      load();
    };
    const handlePresence = (e: WsEvent) => {
      if (e.type !== "presence_update" || e.resource_id !== id) return;
      setWatchers(e.watchers);
    };
    vigilWs.on("release_state_changed", handleState);
    vigilWs.on("release_step_validated", handleStep);
    vigilWs.on("presence_update", handlePresence);
    return () => {
      vigilWs.off("release_state_changed", handleState);
      vigilWs.off("release_step_validated", handleStep);
      vigilWs.off("presence_update", handlePresence);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!release?.team_id) return;
    vigilWs.watch(id, "release", release.team_id);
    return () => {
      vigilWs.unwatch(id, "release", release.team_id);
    };
  }, [id, release?.team_id]);

  if (loading || !release)
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
  const completedSteps = release.steps.filter(
    (s) => s.state === "completed",
  ).length;
  const creatorName =
    team?.members.find((m) => m.user_id === release.created_by)?.username ??
    t("unknownCreator");

  const handleStart = async () => {
    try {
      await api.startRelease(id);
      showToast(t("toastStarted"), "success");
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };

  const handleCancel = async () => {
    try {
      await api.cancelRelease(id);
      showToast(t("toastCancelled"), "success");
      setConfirmAction(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };

  const handleValidateStep = async (stepId: string) => {
    try {
      await api.validateStep(id, stepId);
      showToast(t("toastStepValidated"), "success");
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };

  const currentStepIndex = release.steps.findIndex(
    (s) => s.state === "pending",
  );

  return (
    <div
      style={{
        padding: "28px clamp(16px, 4vw, 32px)",
        maxWidth: "1200px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <button
        onClick={() => router.push("/releases")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "none",
          border: "none",
          color: "oklch(0.60 0.01 260)",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: 600,
          marginBottom: "20px",
          padding: 0,
        }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t("back")}
      </button>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ minWidth: 0 }}>
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
                color: "oklch(0.75 0.01 260)",
                marginBottom: "10px",
              }}
            >
              <Users size={12} aria-hidden="true" />
              {team.name}
            </div>
          )}
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "oklch(0.95 0.005 260)",
              lineHeight: 1.25,
              marginBottom: "10px",
            }}
          >
            {release.title}
          </div>
          <ReleaseStateBadge state={release.state} />
        </div>

        {isManager && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {release.state === "created" && (
              <Button onClick={handleStart}>
                <Play
                  size={14}
                  aria-hidden="true"
                  style={{ marginRight: "6px" }}
                />
                {t("start")}
              </Button>
            )}
            {(release.state === "created" ||
              release.state === "in_progress") && (
              <Button
                variant="danger"
                onClick={() => setConfirmAction("cancel")}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Détails */}
      <div
        style={{
          background: "oklch(0.195 0.015 260)",
          border: "1px solid oklch(0.30 0.02 260)",
          borderRadius: "12px",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          flexWrap: "wrap",
          marginBottom: "20px",
          boxShadow: shadow.card,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12.5px",
            color: "oklch(0.68 0.01 260)",
          }}
        >
          <CheckCircle2
            size={13}
            aria-hidden="true"
            style={{ flexShrink: 0, color: "oklch(0.55 0.01 260)" }}
          />
          {completedSteps}/{release.steps.length} {t("steps")}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12.5px",
            color: "oklch(0.68 0.01 260)",
          }}
        >
          <span>{t("createdBy")}</span>
          <strong style={{ color: "oklch(0.85 0.005 260)" }}>
            {creatorName}
          </strong>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12.5px",
            color: "oklch(0.68 0.01 260)",
          }}
        >
          <Calendar
            size={13}
            aria-hidden="true"
            style={{ flexShrink: 0, color: "oklch(0.55 0.01 260)" }}
          />
          {new Date(release.created_at).toLocaleDateString(dateLocale)}
        </div>
      </div>

      <PresenceIndicator watchers={watchers} />

      {release.description && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "oklch(0.22 0.02 260)",
            border: "1px solid oklch(0.30 0.02 260)",
            fontSize: "13px",
            color: "oklch(0.75 0.01 260)",
            marginBottom: "24px",
          }}
        >
          {release.description}
        </div>
      )}

      {/* Étapes */}
      <div
        style={{
          background: "oklch(0.195 0.015 260)",
          border: "1px solid oklch(0.30 0.02 260)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: shadow.card,
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid oklch(0.30 0.02 260)",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "oklch(0.55 0.01 260)",
          }}
        >
          {t("stepsHeading")}
        </div>

        <div style={{ padding: "16px" }}>
          <StepList steps={release.steps} members={team?.members ?? []} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {release.steps.map((step, i) => {
            const isCurrentStep = i === currentStepIndex;
            const isCompleted = step.state === "completed";
            const isLocked = i > currentStepIndex && currentStepIndex !== -1;

            return (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  gap: "12px",
                  flexWrap: "wrap",
                  borderTop: "1px solid oklch(0.27 0.015 260)",
                  background: isCurrentStep
                    ? "oklch(0.20 0.025 255)"
                    : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: isCompleted
                        ? "oklch(0.72 0.14 150)"
                        : isCurrentStep
                          ? "oklch(0.66 0.16 255)"
                          : "oklch(0.27 0.015 260)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                      color:
                        isCompleted || isCurrentStep
                          ? "oklch(0.16 0.015 260)"
                          : "oklch(0.55 0.01 260)",
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={16} aria-hidden="true" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: isLocked
                          ? "oklch(0.45 0.01 260)"
                          : "oklch(0.90 0.005 260)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.name}
                    </div>

                    {step.validated_at && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "oklch(0.52 0.012 260)",
                          marginTop: "2px",
                        }}
                      >
                        {t("validatedOn")}{" "}
                        {new Date(step.validated_at).toLocaleString(dateLocale)}
                        {step.validated_by && (
                          <>
                            {" "}
                            {t("validatedBy")}{" "}
                            <span
                              style={{
                                color: "oklch(0.72 0.14 150)",
                                fontWeight: 600,
                              }}
                            >
                              {team?.members.find(
                                (m) => m.user_id === step.validated_by,
                              )?.username ?? t("unknownValidator")}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isCurrentStep &&
                  isResponder &&
                  release.state === "in_progress" && (
                    <Button onClick={() => handleValidateStep(step.id)}>
                      <CheckCircle2
                        size={14}
                        aria-hidden="true"
                        style={{ marginRight: "6px" }}
                      />
                      {t("validate")}
                    </Button>
                  )}
                {isCompleted && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "12px",
                      color: "oklch(0.72 0.14 150)",
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={13} aria-hidden="true" />
                    {t("completed")}
                  </span>
                )}
                {isLocked && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "12px",
                      color: "oklch(0.45 0.01 260)",
                    }}
                  >
                    <Lock size={13} aria-hidden="true" />
                    {t("locked")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {release.state === "blocked" && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px 16px",
            borderRadius: "10px",
            background: "oklch(0.20 0.04 25)",
            border: "1px solid oklch(0.45 0.15 25)",
            fontSize: "13px",
            color: "oklch(0.78 0.14 25)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ShieldAlert size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          {t("blockedWarning")}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction === "cancel"}
        title={t("cancelConfirmTitle")}
        description={t("cancelConfirmDescription", { title: release.title })}
        confirmLabel={t("cancelConfirmLabel")}
        cancelLabel={t("cancel")}
        onConfirm={handleCancel}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
export default function ReleaseDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: "32px", color: "oklch(0.72 0.01 260)", fontSize: "13px" }}>Loading...</div>}>
      <ReleaseDetailContent />
    </Suspense>
  );
}