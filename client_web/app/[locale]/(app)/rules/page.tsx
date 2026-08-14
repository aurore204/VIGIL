"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Team, Rule } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Zap, CheckCircle2, XCircle, KeyRound } from "lucide-react";
import { CreateRuleModal } from "@/components/rules/CreateRuleModal";
import { WebhookSecretModal } from "@/components/rules/WebhookSecretModal";

function describeTrigger(
  trigger: Rule["trigger"],
  t: ReturnType<typeof useTranslations>,
): string {
  if (trigger.service === "github" && trigger.event === "workflow_run") {
    return trigger.filters.conclusion === "success"
      ? t("triggerWhenSuccess")
      : t("triggerWhenFailure");
  }
  return t("triggerGeneric", { service: trigger.service });
}

function describeReaction(
  reaction: Rule["reaction"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (reaction.type) {
    case "vigil_create_incident":
      return t("reactionCreateIncident");
    case "http_post":
      return t("reactionHttpPost");
    default:
      return t("reactionGeneric");
  }
}

export default function RulesPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const t = useTranslations("rules.listPage");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const load = async () => {
    try {
      const teamsData = await api.getTeams();
      setTeams(teamsData);
      const managerTeam = teamsData.find((t) => t.manager_id === user?.id);
      if (managerTeam) {
        setSelectedTeamId(managerTeam.id);
        const rulesData = await api.getTeamRules(managerTeam.id);
        setRules(rulesData);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const loadRules = async (teamId: string) => {
    try {
      const rulesData = await api.getTeamRules(teamId);
      setRules(rulesData);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("toastError"), "error");
    }
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    loadRules(teamId);
  };

  const managerTeams = teams.filter((t) => t.manager_id === user?.id);
  const activeRulesCount = rules.filter((r) => r.enabled).length;

  const selectStyle: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid oklch(0.34 0.02 260)",
    background: "oklch(0.195 0.015 260)",
    color: "oklch(0.95 0.005 260)",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
    fontFamily: "Inter, system-ui, sans-serif",
  };

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

  if (managerTeams.length === 0) {
    return (
      <div
        style={{
          padding: "28px 32px",
          color: "oklch(0.60 0.01 260)",
          fontSize: "13px",
        }}
      >
        {t("noManagerTeam")}
      </div>
    );
  }

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
          gap: "16px",
          flexWrap: "nowrap",
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
              background: "oklch(0.25 0.05 85)",
              border: "1px solid oklch(0.42 0.10 85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Zap size={20} color="oklch(0.80 0.14 85)" aria-hidden="true" />
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
                {t("summary", { count: rules.length })}
              </span>
              {activeRulesCount > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "oklch(0.75 0.14 150)",
                    padding: "2px 9px",
                    borderRadius: "12px",
                    background: "oklch(0.20 0.04 150 / 0.3)",
                    border: "1px solid oklch(0.38 0.10 150)",
                  }}
                >
                  {activeRulesCount} active{activeRulesCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
          <Button
            variant="secondary"
            onClick={() => setShowWebhookSecret(true)}
          >
            <KeyRound
              size={14}
              aria-hidden="true"
              style={{ marginRight: "6px" }}
            />
            {t("configureWebhook")}
          </Button>
          <Button onClick={() => setShowCreateRule(true)}>
            <Zap size={14} aria-hidden="true" style={{ marginRight: "6px" }} />
            {t("createRule")}
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: "20px", maxWidth: "300px" }}>
        <label
          htmlFor="team-select"
          style={{
            display: "block",
            fontSize: "12px",
            fontWeight: 600,
            color: "oklch(0.72 0.01 260)",
            marginBottom: "6px",
          }}
        >
          {t("team")}
        </label>
        <select
          id="team-select"
          value={selectedTeamId}
          onChange={(e) => handleTeamChange(e.target.value)}
          style={{ ...selectStyle, width: "100%" }}
        >
          {managerTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: "oklch(0.195 0.015 260)",
          border: "1px solid oklch(0.30 0.02 260)",
          borderRadius: "14px",
          overflow: "hidden",
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
          {t("activeRules")}
        </div>
        {rules.length === 0 ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "oklch(0.52 0.012 260)",
              fontSize: "13px",
            }}
          >
            {t("empty")}
          </div>
        ) : (
          rules.map((rule, i) => (
            <div
              key={rule.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderBottom:
                  i < rules.length - 1
                    ? "1px solid oklch(0.27 0.015 260)"
                    : "none",
              }}
            >
              {rule.enabled ? (
                <CheckCircle2
                  size={16}
                  color="oklch(0.72 0.14 150)"
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  size={16}
                  color="oklch(0.52 0.012 260)"
                  aria-hidden="true"
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "oklch(0.90 0.005 260)",
                  }}
                >
                  {rule.name}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "oklch(0.52 0.012 260)",
                    marginTop: "2px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Zap size={11} aria-hidden="true" />
                  {describeTrigger(rule.trigger, t)},{" "}
                  {describeReaction(rule.reaction, t)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showWebhookSecret && (
        <WebhookSecretModal
          teamId={selectedTeamId}
          onClose={() => setShowWebhookSecret(false)}
        />
      )}

      {showCreateRule && (
        <CreateRuleModal
          teamId={selectedTeamId}
          onClose={() => setShowCreateRule(false)}
          onCreated={() => {
            setShowCreateRule(false);
            loadRules(selectedTeamId);
          }}
        />
      )}
    </div>
  );
}
