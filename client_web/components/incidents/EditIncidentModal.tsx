'use client';

import { useState } from 'react';
import type { Incident, IncidentSeverity } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/shared/Modal';

interface EditIncidentModalProps {
  incident: Incident;
  onClose: () => void;
  onSubmit: (data: { title?: string; description?: string; severity?: IncidentSeverity }) => Promise<void>;
}

export function EditIncidentModal({ incident, onClose, onSubmit }: EditIncidentModalProps) {
  const [title, setTitle] = useState(incident.title);
  const [severity, setSeverity] = useState<IncidentSeverity>(incident.severity);
  const [description, setDescription] = useState(incident.description ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'oklch(0.72 0.01 260)', marginBottom: '6px',
  };

  return (
    <Modal title="Modifier l'incident" onClose={onClose} maxWidth="460px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Titre <span style={{ color: 'oklch(0.78 0.14 25)' }}>*</span></label>
          <input value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Sévérité</label>
          <select value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)} style={selectStyle}>
            <option value="low">Faible</option>
            <option value="medium">Moyen</option>
            <option value="high">Élevé</option>
            <option value="critical">Critique</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={submitting}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}