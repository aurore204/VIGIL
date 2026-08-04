'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Release, Team, WsEvent } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ReleaseCard } from '@/components/releases/ReleaseCard';

export default function ReleasesPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [releases, setReleases] = useState<Release[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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

  const refreshRelease = async (releaseId: string) => {
    try {
      const updated = await api.getRelease(releaseId);
      setReleases(prev => {
        const exists = prev.some(r => r.id === releaseId);
        if (exists) return prev.map(r => (r.id === releaseId ? updated : r));
        return [updated, ...prev];
      });
    } catch {
      setReleases(prev => prev.filter(r => r.id !== releaseId));
    }
  };

  useEffect(() => {
    load();
    api.getOnlineUsers().then(setOnlineUsernames).catch(() => {});

    const onReleaseStateChanged = (e: WsEvent) => {
      if (e.type !== 'release_state_changed') return;
      refreshRelease(e.release_id);
    };
    const onReleaseStepValidated = (e: WsEvent) => {
      if (e.type !== 'release_step_validated') return;
      refreshRelease(e.release_id);
    };
    const onPresenceOnline = (e: WsEvent) => {
      if (e.type !== 'presence_online') return;
      setOnlineUsernames(e.usernames);
    };

    vigilWs.on('release_state_changed', onReleaseStateChanged);
    vigilWs.on('release_step_validated', onReleaseStepValidated);
    vigilWs.on('presence_online', onPresenceOnline);

    return () => {
      vigilWs.off('release_state_changed', onReleaseStateChanged);
      vigilWs.off('release_step_validated', onReleaseStepValidated);
      vigilWs.off('presence_online', onPresenceOnline);
    };
  }, []);

  const managerTeams = teams.filter(t => t.manager_id === user?.id);
  const teamName = (teamId: string) => teams.find(t => t.id === teamId)?.name ?? '—';
  const activeCount = releases.filter(r => r.state === 'in_progress').length;

  if (loading) {
    return <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>;
  }

  return (
    <div style={{ padding: '28px clamp(16px, 4vw, 32px)', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>Releases</div>
          <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
            {releases.length} release{releases.length > 1 ? 's' : ''} · {activeCount} en cours
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'oklch(0.72 0.14 150)' }}>
            <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'oklch(0.72 0.14 150)' }} />
            {onlineUsernames.length} en ligne
          </div>
          {managerTeams.length > 0 && (
            <Button onClick={() => showToast('Modal de création à brancher', 'info')}>+ Créer une release</Button>
          )}
        </div>
      </div>

      {releases.length === 0 ? (
        <div style={{
          background: 'oklch(0.195 0.015 260)', border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: '12px', padding: '48px', textAlign: 'center', color: 'oklch(0.52 0.012 260)', fontSize: '13px',
        }}>
          Aucune release
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {releases.map(release => (
            <ReleaseCard key={release.id} release={release} teamName={teamName(release.team_id)} />
          ))}
        </div>
      )}
    </div>
  );
}