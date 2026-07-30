'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Incident, IncidentState, IncidentSeverity, Team, WsEvent } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { IncidentTable } from '@/components/incidents/IncidentTable';
import { CreateIncidentModal } from '@/components/incidents/CreateIncidentModal';

export default function IncidentsPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all');
  const [filterState, setFilterState] = useState<IncidentState | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const teamsData = await api.getTeams();
      setTeams(teamsData);
      const all: Incident[] = [];
      await Promise.all(teamsData.map(async t => {
        try {
          const inc = await api.getIncidents(t.id);
          all.push(...inc);
        } catch { /* ignore */ }
      }));
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setIncidents(all);
    } finally {
      setLoading(false);
    }
  };

  const refreshIncident = async (incidentId: string) => {
    try {
      const updated = await api.getIncident(incidentId);
      setIncidents(prev => {
        const exists = prev.some(i => i.id === incidentId);
        if (exists) return prev.map(i => (i.id === incidentId ? updated : i));
        return [updated, ...prev];
      });
    } catch {
      setIncidents(prev => prev.filter(i => i.id !== incidentId));
    }
  };

  useEffect(() => {
    load();
    api.getOnlineUsers().then(setOnlineUsernames).catch(() => {});

    const onIncidentStateChanged = (e: WsEvent) => {
      if (e.type !== 'incident_state_changed') return;
      refreshIncident(e.incident_id);
    };
    const onIncidentEscalated = (e: WsEvent) => {
      if (e.type !== 'incident_escalated') return;
      refreshIncident(e.incident_id);
    };
    const onIncidentAssigned = (e: WsEvent) => {
      if (e.type !== 'incident_assigned') return;
      refreshIncident(e.incident_id);
    };
    const onPresenceOnline = (e: WsEvent) => {
      if (e.type !== 'presence_online') return;
      setOnlineUsernames(e.usernames);
    };

    vigilWs.on('incident_state_changed', onIncidentStateChanged);
    vigilWs.on('incident_escalated', onIncidentEscalated);
    vigilWs.on('incident_assigned', onIncidentAssigned);
    vigilWs.on('presence_online', onPresenceOnline);

    return () => {
      vigilWs.off('incident_state_changed', onIncidentStateChanged);
      vigilWs.off('incident_escalated', onIncidentEscalated);
      vigilWs.off('incident_assigned', onIncidentAssigned);
      vigilWs.off('presence_online', onPresenceOnline);
    };
  }, []);

  const managerTeams = teams.filter(t => t.manager_id === user?.id);

  const filtered = incidents.filter(i => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase());
    const matchSev = filterSeverity === 'all' || i.severity === filterSeverity;
    const matchState = filterState === 'all' || i.state === filterState;
    return matchSearch && matchSev && matchState;
  });

  const activeCount = incidents.filter(i => i.state !== 'resolved').length;

  const handleCreate = async (teamId: string, title: string, severity: IncidentSeverity, description?: string) => {
    try {
      await api.createIncident(teamId, { title, severity, description });
      showToast('Incident créé avec succès', 'success');
      setShowCreate(false);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: '8px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.195 0.015 260)',
    color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', cursor: 'pointer',
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
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>Incidents</div>
          
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'oklch(0.72 0.14 150)' }}>
            <span aria-hidden="true" style={{
              width: '6px', height: '6px', borderRadius: '50%', background: 'oklch(0.72 0.14 150)',
            }} />
            {onlineUsernames.length} en ligne
          </div>
          {managerTeams.length > 0 && (
            <Button onClick={() => setShowCreate(true)}>+ Créer un incident</Button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <Input
            label="Rechercher"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Titre de l'incident..."
          />
        </div>
        <div>
          <label htmlFor="filter-severity" style={labelStyle}>Sévérité</label>
          <select id="filter-severity" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as IncidentSeverity | 'all')} style={selectStyle}>
            <option value="all">Toutes</option>
            <option value="low">Faible</option>
            <option value="medium">Moyen</option>
            <option value="high">Élevé</option>
            <option value="critical">Critique</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-state" style={labelStyle}>État</label>
          <select id="filter-state" value={filterState} onChange={e => setFilterState(e.target.value as IncidentState | 'all')} style={selectStyle}>
            <option value="all">Tous</option>
            <option value="open">Ouvert</option>
            <option value="acknowledged">Acquitté</option>
            <option value="escalated">Escaladé</option>
            <option value="resolved">Résolu</option>
          </select>
        </div>
      </div>

      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '12px', overflowX: 'auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2.2fr 110px 120px 130px 140px 90px',
          gap: '16px', padding: '12px 20px',
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.03em', textTransform: 'uppercase',
          color: 'oklch(0.55 0.01 260)',
          borderBottom: '1px solid oklch(0.30 0.02 260)',
          whiteSpace: 'nowrap', minWidth: '920px',
        }}>
          <div>Incident</div>
          <div>Sévérité</div>
          <div>État</div>
          <div>Team</div>
          <div>Assigné</div>
          <div>Date</div>
        </div>
        <IncidentTable incidents={filtered} teams={teams} />
      </div>

      {showCreate && (
        <CreateIncidentModal
          teams={managerTeams}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}