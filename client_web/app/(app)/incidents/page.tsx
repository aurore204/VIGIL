'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import type { Incident, IncidentState, IncidentSeverity, Team } from '@/lib/types';
import { IncidentStateBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

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
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createSeverity, setCreateSeverity] = useState<IncidentSeverity>('medium');
  const [createTeamId, setCreateTeamId] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => { load(); }, []);

  const managerTeams = teams.filter(t => t.manager_id === user?.id);

  const filtered = incidents.filter(i => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase());
    const matchSev = filterSeverity === 'all' || i.severity === filterSeverity;
    const matchState = filterState === 'all' || i.state === filterState;
    return matchSearch && matchSev && matchState;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createTeamId) return;
    setSubmitting(true);
    try {
      await api.createIncident(createTeamId, {
        title: createTitle,
        description: createDesc || undefined,
        severity: createSeverity,
      });
      showToast('Incident créé avec succès', 'success');
      setShowCreate(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateTeamId('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: '7px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.195 0.015 260)',
    color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'oklch(0.72 0.01 260)', marginBottom: '6px',
  };

  if (loading) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>
      Chargement...
    </div>
  );

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
            Incidents
          </div>
          <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
            {filtered.length} incident{filtered.length > 1 ? 's' : ''} · {incidents.filter(i => i.state !== 'resolved').length} actif{incidents.filter(i => i.state !== 'resolved').length > 1 ? 's' : ''}
          </div>
        </div>
        {managerTeams.length > 0 && (
          <Button onClick={() => setShowCreate(true)}>+ Créer un incident</Button>
        )}
      </div>

      {/* Filtres */}
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

      {/* Table */}
      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '10px', overflowX: 'auto',
      }}>
        {/* Header */}
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

        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'oklch(0.52 0.012 260)', fontSize: '13px' }}>
            Aucun incident trouvé
          </div>
        ) : (
          filtered.map((incident, i) => {
            const team = teams.find(t => t.id === incident.team_id);
            const assignee = team?.members.find(m => m.user_id === incident.assigned_to);
            return (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 2fr 100px 100px 100px 120px 80px',
                  gap: '10px', alignItems: 'center',
                  padding: '12px 16px', textDecoration: 'none',
                  borderBottom: i < filtered.length - 1 ? '1px solid oklch(0.27 0.015 260)' : 'none',
                  minWidth: '900px',
                }}
              >
                <div style={{
                  fontSize: '12px', fontFamily: 'ui-monospace, monospace',
                  color: 'oklch(0.60 0.01 260)',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {incident.id.slice(0, 8)}
                </div>
                <div style={{
                  fontSize: '13px', fontWeight: 500,
                  color: 'oklch(0.90 0.005 260)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {incident.title}
                </div>
                <SeverityBadge severity={incident.severity} />
                <IncidentStateBadge state={incident.state} />
                <div style={{
                  fontSize: '12px', color: 'oklch(0.70 0.01 260)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {team?.name ?? '-'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'oklch(0.30 0.03 255)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                    flexShrink: 0,
                  }}>
                    {assignee ? assignee.username.slice(0, 2).toUpperCase() : '?'}
                  </div>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: assignee ? 'oklch(0.72 0.01 260)' : 'oklch(0.45 0.01 260)',
                    fontStyle: assignee ? 'normal' : 'italic',
                  }}>
                    {assignee ? assignee.username : 'Non assigné'}
                  </span>
                </div>
                <div style={{
                  fontSize: '11px', fontFamily: 'ui-monospace, monospace',
                  color: 'oklch(0.52 0.012 260)',
                }}>
                  {new Date(incident.created_at).toLocaleDateString('fr-FR')}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Modal créer incident */}
      {showCreate && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'oklch(0 0 0 / 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{
            background: 'oklch(0.195 0.015 260)',
            border: '1px solid oklch(0.34 0.02 260)',
            borderRadius: '14px', padding: '24px',
            width: '100%', maxWidth: '460px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
                Créer un incident
              </div>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.52 0.012 260)', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Team <span style={{ color: 'oklch(0.78 0.14 25)' }}>*</span></label>
                <select
                  value={createTeamId}
                  onChange={e => setCreateTeamId(e.target.value)}
                  required
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="">Sélectionner une team</option>
                  {managerTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Titre <span style={{ color: 'oklch(0.78 0.14 25)' }}>*</span></label>
                <input
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder="Ex: API de paiement inaccessible"
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Sévérité</label>
                <select
                  value={createSeverity}
                  onChange={e => setCreateSeverity(e.target.value as IncidentSeverity)}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyen</option>
                  <option value="high">Élevé</option>
                  <option value="critical">Critique</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Description (optionnelle)</label>
                <textarea
                  value={createDesc}
                  onChange={e => setCreateDesc(e.target.value)}
                  placeholder="Décrivez le problème..."
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
                  Annuler
                </Button>
                <Button type="submit" loading={submitting}>
                  Créer l&apos;incident
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}