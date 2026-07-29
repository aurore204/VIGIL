import { useState } from 'react';
import type { TeamMember } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/shared/Modal';

interface AssignModalProps {
  responders: TeamMember[];
  onClose: () => void;
  onAssign: (userId: string) => Promise<void>;
}

export function AssignModal({ responders, onClose, onAssign }: AssignModalProps) {
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAssign = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await onAssign(selectedId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Assigner un Responder" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {responders.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'oklch(0.52 0.012 260)' }}>
            Aucun Responder dans cette team
          </div>
        ) : (
          responders.map(m => (
            <button
              key={m.user_id}
              onClick={() => setSelectedId(m.user_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                border: `1px solid ${selectedId === m.user_id ? 'oklch(0.66 0.16 255)' : 'oklch(0.34 0.02 260)'}`,
                background: selectedId === m.user_id ? 'oklch(0.22 0.04 255)' : 'oklch(0.16 0.015 260)',
                color: 'oklch(0.90 0.005 260)', textAlign: 'left', width: '100%',
              }}
            >
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
              }}>
                {m.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.username}</div>
                <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>{m.email}</div>
              </div>
            </button>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={handleAssign} loading={submitting} disabled={!selectedId}>
          Assigner
        </Button>
      </div>
    </Modal>
  );
}