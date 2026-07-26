import type { IncidentState, IncidentSeverity, ReleaseState } from '@/lib/types';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface BadgeProps {
  variant: BadgeVariant;
  icon: string;
  label: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  danger: 'bg-danger/10 text-danger border border-danger/20',
  neutral: 'bg-neutral/10 text-text-secondary border border-neutral/20',
  primary: 'bg-primary/10 text-primary border border-primary/20',
};

export function Badge({ variant, icon, label }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-xs px-sm py-1 rounded text-caption font-medium ${variantStyles[variant]}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

// Badge pour l'état d'un incident
const incidentStateConfig: Record<IncidentState, { variant: BadgeVariant; icon: string; label: string }> = {
  open: { variant: 'danger', icon: '○', label: 'Ouvert' },
  acknowledged: { variant: 'warning', icon: '◑', label: 'Acquitté' },
  escalated: { variant: 'danger', icon: '▲', label: 'Escaladé' },
  resolved: { variant: 'success', icon: '●', label: 'Résolu' },
};

export function IncidentStateBadge({ state }: { state: IncidentState }) {
  const config = incidentStateConfig[state];
  return <Badge {...config} />;
}

// Badge pour la sévérité d'un incident
const severityConfig: Record<IncidentSeverity, { variant: BadgeVariant; icon: string; label: string }> = {
  low: { variant: 'neutral', icon: 'ℹ', label: 'Faible' },
  medium: { variant: 'warning', icon: '△', label: 'Moyen' },
  high: { variant: 'danger', icon: '▲', label: 'Élevé' },
  critical: { variant: 'danger', icon: '⬡', label: 'Critique' },
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const config = severityConfig[severity];
  return <Badge {...config} />;
}

// Badge pour l'état d'une release
const releaseStateConfig: Record<ReleaseState, { variant: BadgeVariant; icon: string; label: string }> = {
  created: { variant: 'neutral', icon: '□', label: 'Créée' },
  in_progress: { variant: 'primary', icon: '↻', label: 'En cours' },
  completed: { variant: 'success', icon: '●', label: 'Terminée' },
  cancelled: { variant: 'neutral', icon: '⊘', label: 'Annulée' },
  blocked: { variant: 'danger', icon: '⊠', label: 'Bloquée' },
};

export function ReleaseStateBadge({ state }: { state: ReleaseState }) {
  const config = releaseStateConfig[state];
  return <Badge {...config} />;
}