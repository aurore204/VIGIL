'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Incident, IncidentState, IncidentSeverity, Team, WsEvent } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { IncidentTable } from '@/components/incidents/IncidentTable';
import { CreateIncidentModal } from '@/components/incidents/CreateIncidentModal';

export default function IncidentsPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
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

  // Met à jour un seul incident dans la liste locale, sans tout recharger
  const refreshIncident = async (incidentId: string) => {
    try {
      const updated = await api.getIncident(incidentId);
      setIncidents(prev => {
        const exists = prev.some(i => i.id === incidentId);
        if (exists) {
          return prev.map(i => (i.id === incidentId ? updated : i));
        }
        // Incident pas encore dans la liste locale  
        return [updated, ...prev];
      });
    } catch {
      // incident supprimé ou plus accessible : on l'enlève de la liste locale
      setIncidents(prev => prev.filter(i => i.id !== incidentId));
    }
  };

  useEffect(() => {
    load();

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

    vigilWs.on('incident_state_changed', onIncidentStateChanged);
    vigilWs.on('incident_escalated', onIncidentEscalated);
    vigilWs.on('incident_assigned', onIncidentAssigned);

    return () => {
      vigilWs.off('incident_state_changed', onIncidentStateChanged);
      vigilWs.off('incident_escalated', onIncidentEscalated);
      vigilWs.off('incident_assigned', onIncidentAssigned);
    };
  }, []); 

  const managerTeams = teams.filter(t => t.manager_id === user?.id);

  const filtered = incidents.filter(i => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase());
    const matchSev = filterSeverity === 'all' || i.severity === filterSeverity;
    const matchState = filterState === 'all' || i.state === filterState;
    return matchSearch && matchSev && matchState;
  });

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
    padding: '9px 12px', borderRadius: '7px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.195 0.015 260)',
    color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', cursor: 'pointer',
  };

  if (loading) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>Incidents</div>
          <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
            {filtered.length} incident{filtered.length > 1 ? 's' : ''} · {incidents.filter(i => i.state !== 'resolved').length} actif{incidents.filter(i => i.state !== 'resolved').length > 1 ? 's' : ''}
          </div>
        </div>
        {managerTeams.length > 0 && (
          <Button onClick={() => setShowCreate(true)}>+ Créer un incident</Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un incident..."
          style={{
            flex: 1, padding: '9px 12px', borderRadius: '7px',
            border: '1px solid oklch(0.34 0.02 260)',
            background: 'oklch(0.195 0.015 260)',
            color: 'oklch(0.95 0.005 260)', fontSize: '13px', outline: 'none',
          }}
        />
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as IncidentSeverity | 'all')} style={selectStyle}>
          <option value="all">Sévérité : Toutes</option>
          <option value="low">Faible</option>
          <option value="medium">Moyen</option>
          <option value="high">Élevé</option>
          <option value="critical">Critique</option>
        </select>
        <select value={filterState} onChange={e => setFilterState(e.target.value as IncidentState | 'all')} style={selectStyle}>
          <option value="all">État : Tous</option>
          <option value="open">Ouvert</option>
          <option value="acknowledged">Acquitté</option>
          <option value="escalated">Escaladé</option>
          <option value="resolved">Résolu</option>
        </select>
      </div>

      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '10px', overflowX: 'auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 2fr 100px 100px 100px 120px 80px',
          gap: '10px', padding: '10px 16px',
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.03em', textTransform: 'uppercase',
          color: 'oklch(0.55 0.01 260)',
          borderBottom: '1px solid oklch(0.30 0.02 260)',
          whiteSpace: 'nowrap', minWidth: '900px',
        }}>
          <div>Incident</div>
          <div>Titre</div>
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