'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/shared/Modal';
import { useToast } from '@/components/ui/Toast';

interface CreateRuleModalProps {
  teamId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRuleModal({ teamId, onClose, onCreated }: CreateRuleModalProps) {
  const { showToast } = useToast();
  const [ruleName, setRuleName] = useState('');
  const [ciOutcome, setCiOutcome] = useState<'failure' | 'success'>('failure');
  const [reactionType, setReactionType] = useState<'vigil_create_incident' | 'http_post'>('vigil_create_incident');
  const [incidentTitleBase, setIncidentTitleBase] = useState('Build cassé');
  const [includeRepoName, setIncludeRepoName] = useState(true);
  const [incidentSeverity, setIncidentSeverity] = useState('critical');
  const [httpUrl, setHttpUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'oklch(0.72 0.01 260)', marginBottom: '6px',
  };

  const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '13px', color: 'oklch(0.85 0.005 260)',
    cursor: 'pointer', marginBottom: '10px',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    setCreating(true);
    try {
      const finalTitle = includeRepoName
        ? `${incidentTitleBase} sur {{repository.name}}`
        : incidentTitleBase;

      const reaction = reactionType === 'vigil_create_incident'
        ? {
            type: 'vigil_create_incident',
            payload: { title: finalTitle, severity: incidentSeverity, body: 'Le build "{{workflow.name}}" a échoué' },
          }
        : {
            type: 'http_post',
            payload: { url: httpUrl },
          };

      await api.createRule(teamId, {
        name: ruleName.trim(),
        enabled: true,
        trigger: { service: 'github', event: 'workflow_run', filters: { conclusion: ciOutcome } },
        reaction,
      });

      showToast('Règle créée avec succès', 'success');
      onCreated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal title="Créer une règle automatique" onClose={onClose} maxWidth="480px">
      <p style={{ fontSize: '13px', color: 'oklch(0.65 0.01 260)', margin: '0 0 18px', lineHeight: 1.5 }}>
        Définissez une action automatique déclenchée par un événement sur GitHub.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input
          label="Nom de la règle"
          value={ruleName}
          onChange={e => setRuleName(e.target.value)}
          hint="Un nom court pour vous rappeler ce que fait cette règle"
          required
          autoFocus
        />

        <div style={{
          padding: '14px', borderRadius: '10px',
          background: 'oklch(0.22 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'oklch(0.85 0.005 260)', marginBottom: '10px' }}>
            Quand
          </div>
          <label htmlFor="ci-outcome" style={labelStyle}>Le build sur GitHub...</label>
          <select id="ci-outcome" value={ciOutcome} onChange={e => setCiOutcome(e.target.value as 'failure' | 'success')} style={selectStyle}>
            <option value="failure">...échoue</option>
            <option value="success">...réussit</option>
          </select>
        </div>

        <div style={{
          padding: '14px', borderRadius: '10px',
          background: 'oklch(0.22 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'oklch(0.85 0.005 260)', marginBottom: '10px' }}>
            Alors
          </div>
          <label htmlFor="reaction-select" style={labelStyle}>Faire ceci automatiquement</label>
          <select id="reaction-select" value={reactionType} onChange={e => setReactionType(e.target.value as typeof reactionType)} style={{ ...selectStyle, marginBottom: reactionType === 'vigil_create_incident' ? '14px' : 0 }}>
            <option value="vigil_create_incident">Créer un incident dans VIGIL</option>
            <option value="http_post">Envoyer une alerte vers un service externe</option>
          </select>

          {reactionType === 'vigil_create_incident' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <Input
                  label="Titre de l'incident créé"
                  value={incidentTitleBase}
                  onChange={e => setIncidentTitleBase(e.target.value)}
                  placeholder="Ex: Build cassé"
                />
                <label style={{ ...checkboxLabelStyle, marginTop: '8px', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={includeRepoName}
                    onChange={e => setIncludeRepoName(e.target.checked)}
                  />
                  Ajouter automatiquement le nom du dépôt concerné
                </label>
              </div>
              <div>
                <label htmlFor="severity-select" style={labelStyle}>Niveau de gravité</label>
                <select id="severity-select" value={incidentSeverity} onChange={e => setIncidentSeverity(e.target.value)} style={selectStyle}>
                  <option value="low">Faible</option>
                  <option value="medium">Moyen</option>
                  <option value="high">Élevé</option>
                  <option value="critical">Critique</option>
                </select>
              </div>
            </div>
          ) : (
            <Input
              label="Adresse où envoyer l'alerte"
              value={httpUrl}
              onChange={e => setHttpUrl(e.target.value)}
              placeholder="https://..."
              hint="L'adresse d'un service capable de recevoir cette notification"
              required
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={creating}>Créer la règle</Button>
        </div>
      </form>
    </Modal>
  );
}