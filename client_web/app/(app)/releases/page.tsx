'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Release, Team, WsEvent } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ReleaseCard } from '@/components/releases/ReleaseCard';
import { Modal } from '@/components/shared/Modal';

export default function ReleasesPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [releases, setReleases] = useState<Release[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [steps, setSteps] = useState([{ name: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const teamsData = await api.getTeams();
      setTeams(teamsData);
      const all: Release[] = [];
      await Promise.all(teamsData.map(async t => {
        try {
          const rel = await api.getReleases(t.id);
          all.push(...rel);
        } catch { /* ignore */ }
      }));
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setReleases(all);
    } finally {
      setLoading(false);
    }
  };

  // Met à jour une seule release dans la liste locale, sans tout recharger
  const refreshRelease = async (releaseId: string) => {
    try {
      const updated = await api.getRelease(releaseId);
      setReleases(prev => {
        const exists = prev.some(r => r.id === releaseId);
        if (exists) {
          return prev.map(r => (r.id === releaseId ? updated : r));
        }
        return [updated, ...prev];
      });
    } catch {
      setReleases(prev => prev.filter(r => r.id !== releaseId));
    }
  };

  useEffect(() => {
    load();

    const onReleaseStateChanged = (e: WsEvent) => {
      if (e.type !== 'release_state_changed') return;
      refreshRelease(e.release_id);
    };
    const onReleaseStepValidated = (e: WsEvent) => {
      if (e.type !== 'release_step_validated') return;
      refreshRelease(e.release_id);
    };

    vigilWs.on('release_state_changed', onReleaseStateChanged);
    vigilWs.on('release_step_validated', onReleaseStepValidated);

    return () => {
      vigilWs.off('release_state_changed', onReleaseStateChanged);
      vigilWs.off('release_step_validated', onReleaseStepValidated);
    };
  }, []); 

  const managerTeams = teams.filter(t => t.manager_id === user?.id);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSteps = steps.filter(s => s.name.trim());
    if (!title.trim() || !teamId || validSteps.length === 0) return;
    setSubmitting(true);
    try {
      await api.createRelease(teamId, {
        title: title.trim(),
        description: description.trim() || undefined,
        steps: validSteps.map(s => ({ name: s.name.trim() })),
      });
      showToast('Release créée avec succès', 'success');
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setTeamId('');
      setSteps([{ name: '' }]);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
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

  if (loading) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>Releases</div>
          <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
            {releases.length} release{releases.length > 1 ? 's' : ''} · {releases.filter(r => r.state === 'in_progress').length} en cours
          </div>
        </div>
        {managerTeams.length > 0 && (
          <Button onClick={() => setShowCreate(true)}>+ Créer une release</Button>
        )}
      </div>

      {releases.length === 0 ? (
        <div style={{
          background: 'oklch(0.195 0.015 260)',
          border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: '10px', padding: '48px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', color: 'oklch(0.52 0.012 260)', marginBottom: '16px' }}>
            Aucune release
          </div>
          {managerTeams.length > 0 && (
            <Button onClick={() => setShowCreate(true)}>Créer une release</Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {releases.map(release => (
            <ReleaseCard key={release.id} release={release} />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Créer une release" onClose={() => setShowCreate(false)} maxWidth="500px">
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Team <span style={{ color: 'oklch(0.78 0.14 25)' }}>*</span></label>
              <select value={teamId} onChange={e => setTeamId(e.target.value)} required style={selectStyle}>
                <option value="">Sélectionner une team</option>
                {managerTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Titre <span style={{ color: 'oklch(0.78 0.14 25)' }}>*</span></label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: v2.0.0" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description (optionnelle)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Mise à jour majeure" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Étapes <span style={{ color: 'oklch(0.78 0.14 25)' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={step.name}
                      onChange={e => {
                        const newSteps = [...steps];
                        newSteps[i].name = e.target.value;
                        setSteps(newSteps);
                      }}
                      placeholder={`Étape ${i + 1} (ex: build, staging, production)`}
                      style={{ ...inputStyle, marginBottom: 0 }}
                    />
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                        style={{
                          padding: '0 12px', borderRadius: '8px',
                          border: '1px solid oklch(0.34 0.02 260)',
                          background: 'transparent', color: 'oklch(0.72 0.01 260)',
                          cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSteps([...steps, { name: '' }])}
                  style={{
                    padding: '8px', borderRadius: '8px',
                    border: '1px dashed oklch(0.34 0.02 260)',
                    background: 'transparent', color: 'oklch(0.60 0.01 260)',
                    cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  + Ajouter une étape
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button type="submit" loading={submitting}>Créer la release</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}