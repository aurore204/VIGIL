'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import type { Team, Incident } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/shared/Modal';
import { TeamCard } from '@/components/teams/TeamCard';

export default function TeamsPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamIncidents, setTeamIncidents] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const data = await api.getTeams();
      setTeams(data);
      const counts: Record<string, number> = {};
      await Promise.all(data.map(async team => {
        try {
          const incidents: Incident[] = await api.getIncidents(team.id);
          counts[team.id] = incidents.filter(i => i.state !== 'resolved').length;
        } catch { counts[team.id] = 0; }
      }));
      setTeamIncidents(counts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setSubmitting(true);
    try {
      await api.createTeam(newTeamName.trim(), newTeamDesc.trim() || undefined);
      showToast('Team créée avec succès', 'success');
      setShowCreate(false);
      setNewTeamName('');
      setNewTeamDesc('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmitting(true);
    try {
      await api.joinTeam(joinCode.trim());
      showToast('Team rejointe avec succès', 'success');
      setShowJoin(false);
      setJoinCode('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Code invalide', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', marginBottom: '14px',
    borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'oklch(0.72 0.01 260)', marginBottom: '6px',
  };

  if (loading) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>Teams</div>
          <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
            Vos équipes et leur activité
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setShowJoin(true)}>Rejoindre</Button>
          <Button onClick={() => setShowCreate(true)}>+ Créer une team</Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div style={{
          background: 'oklch(0.195 0.015 260)',
          border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: '10px', padding: '48px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', color: 'oklch(0.52 0.012 260)', marginBottom: '20px' }}>
            Vous n&apos;avez pas encore de team
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Button variant="secondary" onClick={() => setShowJoin(true)}>Rejoindre avec un code</Button>
            <Button onClick={() => setShowCreate(true)}>Créer une team</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              activeIncidents={teamIncidents[team.id] ?? 0}
              currentUserId={user?.id ?? ''}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Créer une team" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <label style={labelStyle}>Nom de la team</label>
            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Ex: Équipe Backend" required autoFocus style={inputStyle} />
            <label style={labelStyle}>Description (optionnelle)</label>
            <input value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} placeholder="Ex: Gestion des incidents API" style={{ ...inputStyle, marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button type="submit" loading={submitting}>Créer</Button>
            </div>
          </form>
        </Modal>
      )}

      {showJoin && (
        <Modal title="Rejoindre une team" onClose={() => setShowJoin(false)}>
          <form onSubmit={handleJoin}>
            <label style={labelStyle}>Code d&apos;invitation</label>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Ex: A1B2C3D4" required autoFocus style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setShowJoin(false)}>Annuler</Button>
              <Button type="submit" loading={submitting}>Rejoindre</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}