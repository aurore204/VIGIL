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

  const btnStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: '7px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.235 0.015 260)',
    color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
    width: '100%',
  };

  const noActions = !canAcknowledge && !canEscalate && !canResolve && !canAssign;

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '10px', padding: '18px',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '12px',
      }}>
        Actions disponibles
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {canAcknowledge && (
          <button onClick={onAcknowledge} style={btnStyle}>◑ Acquitter</button>
        )}
        {canEscalate && (
          <button onClick={onEscalate} style={btnStyle}>▲ Escalader</button>
        )}
        {canAssign && (
          <button onClick={onAssign} style={btnStyle}>→ Assigner un Responder</button>
        )}
        {canResolve && (
          <button
            onClick={() => setConfirmAction('resolve')}
            style={{ ...btnStyle, background: 'oklch(0.72 0.14 150)', color: 'oklch(0.16 0.015 260)', border: 'none', fontWeight: 700 }}
          >
            ● Résoudre l&apos;incident
          </button>
        )}
        {noActions && (
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic' }}>
            Aucune action disponible
          </div>
        )}
        {canDelete && (
          <button
            onClick={() => setConfirmAction('delete')}
            style={{
              ...btnStyle,
              border: '1px solid oklch(0.45 0.15 25 / 0.5)',
              background: 'transparent', color: 'oklch(0.75 0.15 25)', marginTop: '4px',
            }}
          >
            Supprimer l&apos;incident
          </button>
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