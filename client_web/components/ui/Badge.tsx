import type { IncidentState, IncidentSeverity, ReleaseState, TeamRole } from '@/lib/types';
import {
  Circle, CheckCircle2, ArrowUpCircle, Info, AlertTriangle, Flame,
  Square, RefreshCw, XCircle, Lock,
} from 'lucide-react';

interface BadgeProps {
  color: string;
  bg: string;
  Icon?: React.ElementType;
  label: string;
}

export function Badge({ color, bg, Icon, label }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px', borderRadius: '6px',
      fontSize: '11px', fontWeight: 600,
      background: bg, color,
    }}>
      {Icon && <Icon size={11} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

const incidentStateConfig: Record<IncidentState, BadgeProps> = {
  open: { color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)', Icon: Circle, label: 'Ouvert' },
  acknowledged: { color: 'oklch(0.75 0.14 255)', bg: 'oklch(0.22 0.04 255)', Icon: CheckCircle2, label: 'Acquitté' },
  escalated: { color: 'oklch(0.78 0.14 60)', bg: 'oklch(0.24 0.05 60)', Icon: ArrowUpCircle, label: 'Escaladé' },
  resolved: { color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)', Icon: CheckCircle2, label: 'Résolu' },
};

const severityConfig: Record<IncidentSeverity, BadgeProps> = {
  low: { color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)', Icon: Info, label: 'Faible' },
  medium: { color: 'oklch(0.82 0.14 85)', bg: 'oklch(0.24 0.05 85)', Icon: AlertTriangle, label: 'Moyen' },
  high: { color: 'oklch(0.78 0.14 60)', bg: 'oklch(0.24 0.05 60)', Icon: AlertTriangle, label: 'Élevé' },
  critical: { color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)', Icon: Flame, label: 'Critique' },
};

const releaseStateConfig: Record<ReleaseState, BadgeProps> = {
  created: { color: 'oklch(0.65 0.01 260)', bg: 'oklch(0.25 0.01 260)', Icon: Square, label: 'Créée' },
  in_progress: { color: 'oklch(0.75 0.14 255)', bg: 'oklch(0.22 0.04 255)', Icon: RefreshCw, label: 'En cours' },
  completed: { color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)', Icon: CheckCircle2, label: 'Terminée' },
  cancelled: { color: 'oklch(0.65 0.01 260)', bg: 'oklch(0.25 0.01 260)', Icon: XCircle, label: 'Annulée' },
  blocked: { color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)', Icon: Lock, label: 'Bloquée' },
};

const roleConfig: Record<TeamRole, BadgeProps> = {
  manager: { color: 'oklch(0.82 0.14 85)', bg: 'oklch(0.24 0.05 85 / 0.3)', label: 'Manager' },
  responder: { color: 'oklch(0.75 0.14 255)', bg: 'oklch(0.22 0.04 255 / 0.3)', label: 'Responder' },
  observer: { color: 'oklch(0.65 0.01 260)', bg: 'oklch(0.25 0.01 260 / 0.3)', label: 'Observer' },
};

export function IncidentStateBadge({ state }: { state: IncidentState }) {
  return <Badge {...incidentStateConfig[state]} />;
}

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return <Badge {...severityConfig[severity]} />;
}

export function ReleaseStateBadge({ state }: { state: ReleaseState }) {
  return <Badge {...releaseStateConfig[state]} />;
}

export function RoleBadge({ role }: { role: TeamRole }) {
  return <Badge {...roleConfig[role]} />;
}