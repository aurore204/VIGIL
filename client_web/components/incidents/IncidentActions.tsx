import type { Incident } from '@/lib/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useState } from 'react';
import { shadow } from '@/lib/tokens';
import { CheckCircle2, ArrowUpCircle, UserPlus, Trash2 } from 'lucide-react';

interface IncidentActionsProps {
  incident: Incident;
  canAcknowledge: boolean;
  canEscalate: boolean;
  canResolve: boolean;
  canAssign: boolean;
  canDelete: boolean;
  onAcknowledge: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  onAssign: () => void;
  onDelete: () => void;
}

function ActionButton({
  Icon, label, onClick, tone = 'default',
}: { Icon: React.ElementType; label: string; onClick: () => void; tone?: 'default' | 'success' | 'danger' }) {
  const toneStyles = {
    default: { bg: 'oklch(0.22 0.017 260)', hoverBg: 'oklch(0.27 0.02 260)', color: 'oklch(0.92 0.005 260)', border: '1px solid oklch(0.30 0.02 260)' },
    success: { bg: 'oklch(0.72 0.14 150)', hoverBg: 'oklch(0.76 0.15 150)', color: 'oklch(0.16 0.015 260)', border: 'none' },
    danger: { bg: 'transparent', hoverBg: 'oklch(0.24 0.05 25 / 0.4)', color: 'oklch(0.75 0.15 25)', border: '1px solid oklch(0.45 0.15 25 / 0.55)' },
  }[tone];

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '8px',
        border: toneStyles.border, background: toneStyles.bg, color: toneStyles.color,
        fontSize: '13px', fontWeight: tone === 'default' ? 600 : 700,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        fontFamily: 'Inter, system-ui, sans-serif',
        transition: 'background 0.12s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = toneStyles.hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = toneStyles.bg; }}
    >
      <Icon size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
      {label}
    </button>
  );
}

export function IncidentActions({
  incident,
  canAcknowledge,
  canEscalate,
  canResolve,
  canAssign,
  canDelete,
  onAcknowledge,
  onEscalate,
  onResolve,
  onAssign,
  onDelete,
}: IncidentActionsProps) {
  const [confirmAction, setConfirmAction] = useState<'resolve' | 'delete' | null>(null);
  const noActions = !canAcknowledge && !canEscalate && !canResolve && !canAssign;

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '12px', padding: '18px',
      boxShadow: shadow.card,
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '14px',
      }}>
        Actions disponibles
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {canAcknowledge && <ActionButton Icon={CheckCircle2} label="Acquitter" onClick={onAcknowledge} />}
        {canEscalate && <ActionButton Icon={ArrowUpCircle} label="Escalader" onClick={onEscalate} />}
        {canAssign && <ActionButton Icon={UserPlus} label="Assigner un intervenant" onClick={onAssign} />}

        {noActions && (
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic', padding: '4px 0' }}>
            Aucune action disponible
          </div>
        )}

        {canResolve && (
          <div style={{ marginTop: noActions ? 0 : '6px' }}>
            <ActionButton Icon={CheckCircle2} label="Résoudre" tone="success" onClick={() => setConfirmAction('resolve')} />
          </div>
        )}

        {canDelete && (
          <div style={{ marginTop: '2px' }}>
            <ActionButton Icon={Trash2} label="Supprimer l'incident" tone="danger" onClick={() => setConfirmAction('delete')} />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmAction === 'resolve'}
        title="Résoudre l'incident"
        description={`Confirmer la résolution de "${incident.title}" ?`}
        confirmLabel="Résoudre"
        onConfirm={() => { setConfirmAction(null); onResolve(); }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'delete'}
        title="Supprimer l'incident"
        description={`Supprimer définitivement "${incident.title}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={() => { setConfirmAction(null); onDelete(); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}