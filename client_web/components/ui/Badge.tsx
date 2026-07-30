import type { IncidentState, IncidentSeverity, ReleaseState, TeamRole } from '@/lib/types';

interface BadgeProps {
  color: string;
  bg: string;
  icon?: string;
  label: string;
}

export function Badge({ color, bg, icon, label }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px', borderRadius: '6px',
      fontSize: '11px', fontWeight: 600,
      background: bg, color,
    }}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{label}</span>
    </span>
  );
}

const incidentStateConfig: Record<IncidentState, BadgeProps> = {
  open: { color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)', icon: '○', label: 'Ouvert' },
  acknowledged: { color: 'oklch(0.75 0.14 255)', bg: 'oklch(0.22 0.04 255)', icon: '◑', label: 'Acquitté' },
  escalated: { color: 'oklch(0.78 0.14 60)', bg: 'oklch(0.24 0.05 60)', icon: '▲', label: 'Escaladé' },
  resolved: { color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)', icon: '●', label: 'Résolu' },
};

const severityConfig: Record<IncidentSeverity, BadgeProps> = {
  low: { color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)', icon: 'ℹ', label: 'Faible' },
  medium: { color: 'oklch(0.82 0.14 85)', bg: 'oklch(0.24 0.05 85)', icon: '△', label: 'Moyen' },
  high: { color: 'oklch(0.78 0.14 60)', bg: 'oklch(0.24 0.05 60)', icon: '▲', label: 'Élevé' },
  critical: { color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)', icon: '⬡', label: 'Critique' },
};

const releaseStateConfig: Record<ReleaseState, BadgeProps> = {
  created: { color: 'oklch(0.65 0.01 260)', bg: 'oklch(0.25 0.01 260)', icon: '□', label: 'Créée' },
  in_progress: { color: 'oklch(0.75 0.14 255)', bg: 'oklch(0.22 0.04 255)', icon: '↻', label: 'En cours' },
  completed: { color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)', icon: '●', label: 'Terminée' },
  cancelled: { color: 'oklch(0.65 0.01 260)', bg: 'oklch(0.25 0.01 260)', icon: '⊘', label: 'Annulée' },
  blocked: { color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)', icon: '⊠', label: 'Bloquée' },
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