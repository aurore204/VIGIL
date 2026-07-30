import type { Incident } from '@/lib/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useState } from 'react';

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
  linkedReleaseTitle?: string | null;
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
  linkedReleaseTitle,
}: IncidentActionsProps) {
  const [confirmAction, setConfirmAction] = useState<'resolve' | 'delete' | null>(null);

  const baseBtn: React.CSSProperties = {
    padding: '11px 14px', borderRadius: '8px',
    border: '1px solid oklch(0.30 0.02 260)',
    background: 'oklch(0.22 0.017 260)',
    color: 'oklch(0.92 0.005 260)',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
    width: '100%', fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'background 0.12s ease',
  };

  const noActions = !canAcknowledge && !canEscalate && !canResolve && !canAssign;

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '12px', padding: '18px',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '14px',
      }}>
        Actions disponibles
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {canAcknowledge && (
          <button
            onClick={onAcknowledge}
            style={baseBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.26 0.02 260)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'oklch(0.22 0.017 260)'; }}
          >
            Acquitter
          </button>
        )}
        {canEscalate && (
          <button
            onClick={onEscalate}
            style={baseBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.26 0.02 260)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'oklch(0.22 0.017 260)'; }}
          >
            Escalader
          </button>
        )}
        {canAssign && (
          <button
            onClick={onAssign}
            style={baseBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.26 0.02 260)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'oklch(0.22 0.017 260)'; }}
          >
            Assigner un intervenant
          </button>
        )}

        {noActions && (
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic', padding: '4px 0' }}>
            Aucune action disponible
          </div>
        )}

        {canResolve && (
          <button
            onClick={() => setConfirmAction('resolve')}
            style={{
              ...baseBtn,
              background: 'oklch(0.72 0.14 150)', color: 'oklch(0.16 0.015 260)',
              border: 'none', fontWeight: 700, marginTop: noActions ? 0 : '6px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.76 0.15 150)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'oklch(0.72 0.14 150)'; }}
          >
            Résoudre
          </button>
        )}

        {canDelete && (
          <button
            onClick={() => setConfirmAction('delete')}
            style={{
              ...baseBtn,
              background: 'transparent', color: 'oklch(0.75 0.15 25)',
              border: '1px solid oklch(0.45 0.15 25 / 0.55)', marginTop: '2px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.24 0.05 25 / 0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            Supprimer l&apos;incident
          </button>
        )}
      </div>

      {linkedReleaseTitle && (
        <>
          <div style={{ borderTop: '1px solid oklch(0.27 0.015 260)', margin: '16px 0 12px' }} />
          <div style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '6px',
          }}>
            Release liée
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.75 0.14 255)' }}>
            {linkedReleaseTitle}
          </div>
        </>
      )}

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