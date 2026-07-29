'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import type { Team, Incident, Release } from '@/lib/types';
import Link from 'next/link';
import { vigilWs } from '@/lib/websocket';
import type { WsEvent } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  // `load` est maintenant défini au niveau du composant, accessible partout
  const load = async () => {
    try {
      const teamsData = await api.getTeams();
      setTeams(teamsData);

      const allIncidents: Incident[] = [];
      const allReleases: Release[] = [];

      await Promise.all(
        teamsData.map(async (team) => {
          const [inc, rel] = await Promise.all([
            api.getIncidents(team.id),
            api.getReleases(team.id),
          ]);
          allIncidents.push(...inc);
          allReleases.push(...rel);
        })
      );

      setIncidents(allIncidents);
      setReleases(allReleases);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handleUpdate = (e: WsEvent) => {
      if (
        e.type === 'incident_state_changed' ||
        e.type === 'release_state_changed' ||
        e.type === 'incident_assigned'
      ) {
        load(); // ✅ appelle bien la fonction du composant, plus d'erreur
      }
    };

    vigilWs.on('incident_state_changed', handleUpdate);
    vigilWs.on('release_state_changed', handleUpdate);
    vigilWs.on('incident_assigned', handleUpdate);

    return () => {
      vigilWs.off('incident_state_changed', handleUpdate);
      vigilWs.off('release_state_changed', handleUpdate);
      vigilWs.off('incident_assigned', handleUpdate);
    };
  }, []); // pas de connect()/disconnect() ici : AppLayout gère déjà le cycle de vie du WS

  const open = incidents.filter(i => i.state === 'open').length;
  const acknowledged = incidents.filter(i => i.state === 'acknowledged').length;
  const escalated = incidents.filter(i => i.state === 'escalated').length;
  const critical = incidents.filter(i => i.severity === 'critical' && i.state !== 'resolved').length;
  const activeReleases = releases.filter(r => r.state === 'in_progress').length;
  const blockedReleases = releases.filter(r => r.state === 'blocked').length;

  const cardStyle = (color: string) => ({
    background: 'oklch(0.195 0.015 260)',
    border: `1px solid ${color}`,
    borderRadius: '12px',
    padding: '20px 24px',
  });

  if (loading) {
    return (
      <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)' }}>
        Chargement...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'oklch(0.95 0.005 260)', margin: 0 }}>
          Bonjour, {user?.username} 
        </h1>
        <p style={{ color: 'oklch(0.52 0.012 260)', marginTop: '4px', fontSize: '13px' }}>
          Voici l&apos;état de vos opérations en temps réel
        </p>
      </div>

      {/* Métriques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={cardStyle('oklch(0.45 0.15 25)')}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Incidents ouverts
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'oklch(0.78 0.14 25)' }}>{open}</div>
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', marginTop: '4px' }}>
            {acknowledged} acquittés · {escalated} escaladés
          </div>
        </div>

        <div style={cardStyle('oklch(0.45 0.15 25)')}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Critiques actifs
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: critical > 0 ? 'oklch(0.72 0.20 25)' : 'oklch(0.72 0.14 150)' }}>
            {critical}
          </div>
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', marginTop: '4px' }}>
            {critical > 0 ? '⚠ Attention requise' : '✓ Aucun incident critique'}
          </div>
        </div>

        <div style={cardStyle(blockedReleases > 0 ? 'oklch(0.45 0.15 25)' : 'oklch(0.34 0.02 260)')}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Releases
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'oklch(0.75 0.14 255)' }}>{activeReleases}</div>
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', marginTop: '4px' }}>
            en cours · {blockedReleases > 0 ? `${blockedReleases} bloquée(s) ⚠` : '0 bloquée'}
          </div>
        </div>
      </div>

      {/* Incidents récents */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'oklch(0.90 0.005 260)', margin: 0 }}>
            Incidents récents
          </h2>
          <Link href="/incidents" style={{ fontSize: '12px', color: 'oklch(0.66 0.16 255)', textDecoration: 'none' }}>
            Voir tout →
          </Link>
        </div>

        {incidents.length === 0 ? (
          <div style={{
            background: 'oklch(0.195 0.015 260)',
            border: '1px solid oklch(0.30 0.02 260)',
            borderRadius: '10px', padding: '24px',
            textAlign: 'center', color: 'oklch(0.52 0.012 260)', fontSize: '13px'
          }}>
            Aucun incident
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {incidents.slice(0, 5).map(incident => (
              <Link key={incident.id} href={`/incidents/${incident.id}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'oklch(0.195 0.015 260)',
                border: '1px solid oklch(0.30 0.02 260)',
                borderRadius: '10px', padding: '14px 16px',
                textDecoration: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <StateBadge state={incident.state} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
                    {incident.title}
                  </span>
                </div>
                <SeverityBadge severity={incident.severity} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Teams */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'oklch(0.90 0.005 260)', margin: 0 }}>
            Mes teams ({teams.length})
          </h2>
          <Link href="/teams" style={{ fontSize: '12px', color: 'oklch(0.66 0.16 255)', textDecoration: 'none' }}>
            Gérer →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
          {teams.map(team => (
            <Link key={team.id} href={`/teams/${team.id}`} style={{
              background: 'oklch(0.195 0.015 260)',
              border: '1px solid oklch(0.30 0.02 260)',
              borderRadius: '10px', padding: '16px',
              textDecoration: 'none',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'oklch(0.90 0.005 260)', marginBottom: '6px' }}>
                {team.name}
              </div>
              <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)' }}>
                {team.members.length} membre{team.members.length > 1 ? 's' : ''}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const stateConfig: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)' },
  acknowledged: { label: 'Acquitté', color: 'oklch(0.75 0.14 255)', bg: 'oklch(0.22 0.04 255)' },
  escalated: { label: 'Escaladé', color: 'oklch(0.78 0.14 60)', bg: 'oklch(0.24 0.05 60)' },
  resolved: { label: 'Résolu', color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)' },
};

const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Faible', color: 'oklch(0.72 0.14 150)', bg: 'oklch(0.22 0.04 150)' },
  medium: { label: 'Moyen', color: 'oklch(0.82 0.14 85)', bg: 'oklch(0.24 0.05 85)' },
  high: { label: 'Élevé', color: 'oklch(0.78 0.14 60)', bg: 'oklch(0.24 0.05 60)' },
  critical: { label: 'Critique', color: 'oklch(0.78 0.14 25)', bg: 'oklch(0.25 0.05 25)' },
};

function StateBadge({ state }: { state: string }) {
  const config = stateConfig[state] || stateConfig.open;
  return (
    <span style={{
      padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
      background: config.bg, color: config.color,
    }}>
      {config.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity] || severityConfig.low;
  return (
    <span style={{
      padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
      background: config.bg, color: config.color,
    }}>
      {config.label}
    </span>
  );
}