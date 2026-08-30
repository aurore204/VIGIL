"use client";

import { useTranslations } from "next-intl";
import type {
  IncidentState,
  IncidentSeverity,
  ReleaseState,
  TeamRole,
} from "@/lib/types";
import {
  Circle,
  CheckCircle2,
  ArrowUpCircle,
  Info,
  AlertTriangle,
  Flame,
  Square,
  RefreshCw,
  XCircle,
  Lock,
} from "lucide-react";

interface BadgeProps {
  color: string;
  bg: string;
  Icon?: React.ElementType;
  label: string;
}

export function Badge({ color, bg, Icon, label }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 9px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 600,
        background: bg,
        color,
      }}
    >
      {Icon && <Icon size={11} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

type BadgeStyle = Omit<BadgeProps, "label">;

const incidentStateConfig: Record<IncidentState, BadgeStyle> = {
  open: {
    color: "oklch(0.78 0.14 25)",
    bg: "oklch(0.25 0.05 25)",
    Icon: Circle,
  },
  acknowledged: {
    color: "oklch(0.75 0.14 255)",
    bg: "oklch(0.22 0.04 255)",
    Icon: CheckCircle2,
  },
  escalated: {
    color: "oklch(0.78 0.14 60)",
    bg: "oklch(0.24 0.05 60)",
    Icon: ArrowUpCircle,
  },
  resolved: {
    color: "oklch(0.72 0.14 150)",
    bg: "oklch(0.22 0.04 150)",
    Icon: CheckCircle2,
  },
};

const severityConfig: Record<IncidentSeverity, BadgeStyle> = {
  low: {
    color: "oklch(0.72 0.14 150)",
    bg: "oklch(0.22 0.04 150)",
    Icon: Info,
  },
  medium: {
    color: "oklch(0.82 0.14 85)",
    bg: "oklch(0.24 0.05 85)",
    Icon: AlertTriangle,
  },
  high: {
    color: "oklch(0.78 0.14 60)",
    bg: "oklch(0.24 0.05 60)",
    Icon: AlertTriangle,
  },
  critical: {
    color: "oklch(0.78 0.14 25)",
    bg: "oklch(0.25 0.05 25)",
    Icon: Flame,
  },
};

const releaseStateConfig: Record<ReleaseState, BadgeStyle> = {
  created: {
    color: "oklch(0.65 0.01 260)",
    bg: "oklch(0.25 0.01 260)",
    Icon: Square,
  },
  in_progress: {
    color: "oklch(0.75 0.14 255)",
    bg: "oklch(0.22 0.04 255)",
    Icon: RefreshCw,
  },
  completed: {
    color: "oklch(0.72 0.14 150)",
    bg: "oklch(0.22 0.04 150)",
    Icon: CheckCircle2,
  },
  cancelled: {
    color: "oklch(0.65 0.01 260)",
    bg: "oklch(0.25 0.01 260)",
    Icon: XCircle,
  },
  blocked: {
    color: "oklch(0.78 0.14 25)",
    bg: "oklch(0.25 0.05 25)",
    Icon: Lock,
  },
};

const roleConfig: Record<TeamRole, BadgeStyle> = {
  manager: { color: "oklch(0.82 0.14 85)", bg: "oklch(0.24 0.05 85 / 0.3)" },
  responder: {
    color: "oklch(0.75 0.14 255)",
    bg: "oklch(0.22 0.04 255 / 0.3)",
  },
  observer: { color: "oklch(0.65 0.01 260)", bg: "oklch(0.25 0.01 260 / 0.3)" },
};

export function IncidentStateBadge({ state }: { state: IncidentState }) {
  const t = useTranslations("incidentState");
  const config = incidentStateConfig[state];
  return (
    <Badge
      color={config.color}
      bg={config.bg}
      Icon={config.Icon}
      label={t(state)}
    />
  );
}

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const t = useTranslations("severity");
  const config = severityConfig[severity];
  return (
    <Badge
      color={config.color}
      bg={config.bg}
      Icon={config.Icon}
      label={t(severity)}
    />
  );
}

export function ReleaseStateBadge({ state }: { state: ReleaseState }) {
  const t = useTranslations("releaseState");
  const config = releaseStateConfig[state];
  return (
    <Badge
      color={config.color}
      bg={config.bg}
      Icon={config.Icon}
      label={t(state)}
    />
  );
}

export function RoleBadge({ role }: { role: TeamRole }) {
  // Les noms de rôle (Manager, Responder, Observer) sont volontairement identiques en FR/EN,
  // donc pas besoin de traduction ici — on les garde tels quels.
  const config = roleConfig[role];
  return (
    <Badge
      color={config.color}
      bg={config.bg}
      label={role.charAt(0).toUpperCase() + role.slice(1)}
    />
  );
}
