'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Team, Incident, WsEvent } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/shared/Modal';
import { TeamCard } from '@/components/teams/TeamCard';
import { Plus } from 'lucide-react';

export default function TeamsPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const t = useTranslations('teams.listPage');
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

  // Recalcule le compteur d'incidents actifs d'une seule team
  const refreshTeamIncidentCount = async (teamId: string) => {
    try {
      const incidents = await api.getIncidents(teamId);
      setTeamIncidents(prev => ({ ...prev, [teamId]: incidents.filter(i => i.state !== 'resolved').length }));
    } catch { }
  };

  // Recharge une seule team
  const refreshTeam = async (teamId: string) => {
    try {
      const updated = await api.getTeam(teamId);
      setTeams(prev => prev.map(t => (t.id === teamId ? updated : t)));
    } catch {
      setTeams(prev => prev.filter(t => t.id !== teamId));
      setTeamIncidents(prev => {
        const { [teamId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  useEffect(() => {
    load();

    const onIncidentStateChanged = async (e: WsEvent) => {
      if (e.type !== 'incident_state_changed') return;
      try {
        const inc = await api.getIncident(e.incident_id);
        refreshTeamIncidentCount(inc.team_id);
      } catch { }
    };
    const onMemberKicked = (e: WsEvent) => {
      if (e.type !== 'member_kicked') return;
      refreshTeam(e.team_id);
    };
    const onMemberBanned = (e: WsEvent) => {
      if (e.type !== 'member_banned') return;
      refreshTeam(e.team_id);
    };

    vigilWs.on('incident_state_changed', onIncidentStateChanged);
    vigilWs.on('member_kicked', onMemberKicked);
    vigilWs.on('member_banned', onMemberBanned);

    return () => {
      vigilWs.off('incident_state_changed', onIncidentStateChanged);
      vigilWs.off('member_kicked', onMemberKicked);
      vigilWs.off('member_banned', onMemberBanned);
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setSubmitting(true);
    try {
      await api.createTeam(newTeamName.trim(), newTeamDesc.trim() || undefined);
      showToast(t('toastCreated'), 'success');
      setShowCreate(false);
      setNewTeamName('');
      setNewTeamDesc('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastError'), 'error');
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
      showToast(t('toastJoined'), 'success');
      setShowJoin(false);
      setJoinCode('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastInvalidCode'), 'error');
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
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>{t('loading')}</div>
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>{t('title')}</div>
          <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
            {t('subtitle')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setShowJoin(true)}>{t('join')}</Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={14} aria-hidden="true" style={{ marginRight: '6px' }} />
            {t('create')}
          </Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div style={{
          background: 'oklch(0.195 0.015 260)',
          border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: '10px', padding: '48px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', color: 'oklch(0.52 0.012 260)', marginBottom: '20px' }}>
            {t('emptyTitle')}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Button variant="secondary" onClick={() => setShowJoin(true)}>{t('joinWithCode')}</Button>
            <Button onClick={() => setShowCreate(true)}>{t('create')}</Button>
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
        <Modal title={t('createModal.title')} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <label style={labelStyle}>{t('createModal.nameLabel')}</label>
            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder={t('createModal.namePlaceholder')} required autoFocus style={inputStyle} />
            <label style={labelStyle}>{t('createModal.descriptionLabel')}</label>
            <input value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} placeholder={t('createModal.descriptionPlaceholder')} style={{ ...inputStyle, marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>{t('createModal.cancel')}</Button>
              <Button type="submit" loading={submitting}>{t('createModal.submit')}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showJoin && (
        <Modal title={t('joinModal.title')} onClose={() => setShowJoin(false)}>
          <form onSubmit={handleJoin}>
            <label style={labelStyle}>{t('joinModal.codeLabel')}</label>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder={t('joinModal.codePlaceholder')} required autoFocus style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setShowJoin(false)}>{t('joinModal.cancel')}</Button>
              <Button type="submit" loading={submitting}>{t('joinModal.submit')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}