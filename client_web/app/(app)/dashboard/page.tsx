'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Team, Incident, Release, WsEvent } from '@/lib/types';
import Link from 'next/link';
import {
  AlertTriangle,
  Flame,
  Rocket,
  Users,
  Activity,
  ArrowUpRight,
  ArrowUpCircle,
  CheckCircle2,
  Circle,
  Lock,
  PlayCircle,
} from 'lucide-react';

const COLORS = {
  bg: '#0B0F1A',
  card: '#101623',
  cardBorder: '#1B2333',
  row: '#171F2E',
  text: '#EAEEF5',
  muted: '#78859A',
  mutedStrong: '#8896A8',
  blueBg: '#182238',
  blueText: '#8FB3E8',
  blueStrip: '#3D6FD1',
  amberBg: '#2B2013',
  amberText: '#D9AE63',
  emberBg: '#2B1E1A',
  emberText: '#DE8B6C',
  greenBg: '#182819',
  greenText: '#7BC198',
  greenStrip: '#4CAE7C',
  grayBg: '#1A1F2A',
  grayText: '#8896A8',
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: '14px',
  overflow: 'hidden',
};

function StatCard({
  Icon, value, label, stripColor, iconBg, iconColor,
}: { Icon: React.ElementType; value: number; label: string; stripColor: string; iconBg: string; iconColor: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ height: '3px', background: stripColor }} />
      <div style={{ padding: '17px 18px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px',
        }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px', background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={19} color={iconColor} strokeWidth={2} aria-hidden="true" />
          </div>
          <ArrowUpRight size={14} color={COLORS.mutedStrong} aria-hidden="true" />
        </div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: '25px', fontWeight: 700,
          letterSpacing: '-0.01em', color: iconColor === COLORS.emberText ? iconColor : COLORS.text,
        }}>
          {value}
        </div>
        <div style={{ fontSize: '12px', color: COLORS.muted, marginTop: '4px' }}>{label}</div>
      </div>
    </div>
  );
}

const stateConfig: Record<string, { label: string; bg: string; text: string; Icon: React.ElementType }> = {
  open: { label: 'Ouvert', bg: COLORS.grayBg, text: COLORS.grayText, Icon: Circle },
  acknowledged: { label: 'Acquitté', bg: COLORS.blueBg, text: COLORS.blueText, Icon: CheckCircle2 },
  escalated: { label: 'Escaladé', bg: COLORS.amberBg, text: COLORS.amberText, Icon: ArrowUpCircle },
  resolved: { label: 'Résolu', bg: COLORS.greenBg, text: COLORS.greenText, Icon: CheckCircle2 },
};

const severityColor: Record<string, string> = {
  low: COLORS.greenText,
  medium: COLORS.mutedStrong,
  high: COLORS.amberText,
  critical: COLORS.emberText,
};

interface ActivityItem {
  id: string;
  kind: 'incident' | 'release';
  label: string;
  detail: string;
  at: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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

      allIncidents.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      allReleases.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
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
        e.type === 'incident_assigned' ||
        e.type === 'release_step_validated'
      ) {
        load();
      }
    };

    const handlePresence = (e: WsEvent) => {
      if (e.type !== 'presence_online') return;
      console.log(' presence_online reçu:', e.usernames);
      setOnlineUsernames(e.usernames);
    };

    console.log(' handler presence_online enregistré');
    vigilWs.on('presence_online', handlePresence);
    vigilWs.on('incident_state_changed', handleUpdate);
    vigilWs.on('release_state_changed', handleUpdate);
    vigilWs.on('incident_assigned', handleUpdate);
    vigilWs.on('release_step_validated', handleUpdate);

    return () => {
      vigilWs.off('incident_state_changed', handleUpdate);
      vigilWs.off('release_state_changed', handleUpdate);
      vigilWs.off('incident_assigned', handleUpdate);
      vigilWs.off('release_step_validated', handleUpdate);
      vigilWs.off('presence_online', handlePresence);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '32px', color: COLORS.muted, fontFamily: 'Inter, sans-serif' }}>
        Chargement...
      </div>
    );
  }

  const activeIncidents = incidents.filter(i => i.state !== 'resolved');
  const critical = incidents.filter(i => i.severity === 'critical' && i.state !== 'resolved').length;
  const activeReleases = releases.filter(r => r.state === 'in_progress' || r.state === 'blocked');
  const roleOf = (team: Team) => team.members.find(m => m.user_id === user?.id)?.role ?? 'observer';
  const roleLabel: Record<string, string> = { observer: 'Observer', responder: 'Responder', manager: 'Manager' };

  const activityFeed: ActivityItem[] = [
    ...incidents.slice(0, 5).map((i): ActivityItem => ({
      id: i.id, kind: 'incident', label: i.title,
      detail: `Incident ${stateConfig[i.state]?.label.toLowerCase() ?? i.state}`,
      at: i.updated_at,
    })),
    ...releases.slice(0, 5).map((r): ActivityItem => ({
      id: r.id, kind: 'release', label: r.title,
      detail: `Release ${r.state === 'in_progress' ? 'en cours' : r.state}`,
      at: r.updated_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);

  return (
    <div style={{
      padding: '26px 30px', maxWidth: '1200px', fontFamily: 'Inter, sans-serif',
      color: COLORS.text, background: COLORS.bg, minHeight: '100vh',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: '22px', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Bonjour, {user?.username}
          </div>
          <div style={{ fontSize: '13px', color: COLORS.muted, marginTop: '4px' }}>
            {activeIncidents.length} incident{activeIncidents.length > 1 ? 's' : ''} actif{activeIncidents.length > 1 ? 's' : ''} sur {teams.length} team{teams.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px',
      }}>
        <StatCard Icon={AlertTriangle} value={activeIncidents.length} label="Incidents actifs" stripColor={COLORS.blueStrip} iconBg={COLORS.blueBg} iconColor={COLORS.blueText} />
        <StatCard Icon={Flame} value={critical} label="Critiques" stripColor={COLORS.emberText} iconBg={COLORS.emberBg} iconColor={COLORS.emberText} />
        <StatCard Icon={Rocket} value={activeReleases.length} label="Releases en cours" stripColor={COLORS.greenStrip} iconBg={COLORS.greenBg} iconColor={COLORS.greenText} />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '14px', marginBottom: '16px',
      }}>
        <div style={cardStyle}>
          <div style={{ height: '3px', background: COLORS.blueStrip }} />
          <div style={{ padding: '17px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                <AlertTriangle size={15} color={COLORS.blueText} aria-hidden="true" />
                Incidents actifs
              </div>
              <Link href="/incidents" style={{ fontSize: '12px', color: COLORS.blueText, textDecoration: 'none' }}>
                Voir tout
              </Link>
            </div>

            {activeIncidents.length === 0 ? (
              <div style={{ fontSize: '13px', color: COLORS.muted, padding: '12px 0' }}>Aucun incident actif</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activeIncidents.slice(0, 5).map((incident, i, arr) => {
                  const cfg = stateConfig[incident.state] ?? stateConfig.open;
                  const StateIcon = cfg.Icon;
                  return (
                    <Link
                      key={incident.id}
                      href={`/incidents/${incident.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 2px',
                        borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.row}` : 'none',
                        textDecoration: 'none', color: COLORS.text,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 600,
                          padding: '3px 8px', borderRadius: '6px', background: cfg.bg, color: cfg.text, flexShrink: 0,
                        }}>
                          <StateIcon size={11} aria-hidden="true" />{cfg.label}
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {incident.title}
                        </span>
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', color: severityColor[incident.severity], flexShrink: 0 }}>
                        {incident.severity}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ height: '3px', background: COLORS.greenStrip }} />
          <div style={{ padding: '17px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                <Users size={15} color={COLORS.greenText} aria-hidden="true" />
                En ligne
              </div>
              <span style={{ fontSize: '11px', color: COLORS.greenText }}>{onlineUsernames.length} actif{onlineUsernames.length > 1 ? 's' : ''}</span>
            </div>

            {onlineUsernames.length === 0 ? (
              <div style={{ fontSize: '12px', color: COLORS.muted, padding: '8px 0' }}>
                Aucune donnée de présence disponible pour le moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {onlineUsernames.map(username => (
                  <div key={username} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <div style={{ position: 'relative', width: '26px', height: '26px', flexShrink: 0 }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%', background: COLORS.blueBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                        fontWeight: 600, color: COLORS.blueText,
                      }}>
                        {username.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{
                        position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px',
                        borderRadius: '50%', background: COLORS.greenText, border: `2px solid ${COLORS.card}`,
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px', marginBottom: '16px',
      }}>
        <div style={cardStyle}>
          <div style={{ height: '3px', background: COLORS.greenStrip }} />
          <div style={{ padding: '17px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                <Rocket size={15} color={COLORS.greenText} aria-hidden="true" />
                Releases en cours
              </div>
              <Link href="/releases" style={{ fontSize: '12px', color: COLORS.blueText, textDecoration: 'none' }}>
                Voir tout
              </Link>
            </div>

            {activeReleases.length === 0 ? (
              <div style={{ fontSize: '13px', color: COLORS.muted, padding: '12px 0' }}>Aucune release en cours</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeReleases.slice(0, 3).map(release => {
                  const completed = release.steps.filter(s => s.state === 'completed').length;
                  const total = release.steps.length || 1;
                  const pct = Math.round((completed / total) * 100);
                  const blocked = release.state === 'blocked';
                  return (
                    <Link key={release.id} href={`/releases/${release.id}`} style={{ textDecoration: 'none', color: COLORS.text }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{release.title}</span>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600,
                          padding: '2px 7px', borderRadius: '5px',
                          background: blocked ? COLORS.emberBg : COLORS.blueBg,
                          color: blocked ? COLORS.emberText : COLORS.blueText,
                        }}>
                          {blocked ? <Lock size={10} aria-hidden="true" /> : <PlayCircle size={10} aria-hidden="true" />}
                          {blocked ? 'Bloquée' : 'En cours'}
                        </span>
                      </div>
                      <div style={{ height: '5px', borderRadius: '3px', background: COLORS.row, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: '3px',
                          background: blocked ? COLORS.emberText : COLORS.blueStrip,
                        }} />
                      </div>
                      <div style={{ fontSize: '10.5px', color: COLORS.muted, marginTop: '5px' }}>
                        {completed}/{release.steps.length} étapes
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ height: '3px', background: COLORS.blueStrip }} />
          <div style={{ padding: '17px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>
              <Activity size={15} color={COLORS.blueText} aria-hidden="true" />
              Activité récente
            </div>

            {activityFeed.length === 0 ? (
              <div style={{ fontSize: '13px', color: COLORS.muted, padding: '12px 0' }}>Rien à signaler</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activityFeed.map(item => (
                  <div key={`${item.kind}-${item.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                      background: item.kind === 'incident' ? COLORS.blueBg : COLORS.greenBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.kind === 'incident'
                        ? <AlertTriangle size={13} color={COLORS.blueText} aria-hidden="true" />
                        : <Rocket size={13} color={COLORS.greenText} aria-hidden="true" />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '1px' }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Mes teams ({teams.length})</div>
          <Link href="/teams" style={{ fontSize: '12px', color: COLORS.blueText, textDecoration: 'none' }}>
            Gérer
          </Link>
        </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
  {teams.map(team => {
    const role = roleOf(team);
    const isManager = role === 'manager';
    return (
      <Link key={team.id} href={`/teams/${team.id}`} style={{ textDecoration: 'none', color: COLORS.text }}>
        <div style={{ ...cardStyle, minHeight: '150px' }}>
          <div style={{ height: '3px', background: isManager ? COLORS.blueStrip : COLORS.cardBorder }} />
          <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '5px' }}>{team.name}</div>
                {team.description && (
                  <div style={{
                    fontSize: '12.5px', color: COLORS.muted, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px',
                  }}>
                    {team.description}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '5px 12px', borderRadius: '20px', flexShrink: 0,
                background: isManager ? COLORS.blueBg : COLORS.grayBg,
                color: isManager ? COLORS.blueText : COLORS.grayText,
              }}>
                {roleLabel[role]}
              </span>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex' }}>
                {team.members.slice(0, 5).map((m, i) => (
                  <div key={m.user_id} style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: COLORS.blueBg,
                    border: `2.5px solid ${COLORS.card}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 600, color: COLORS.blueText,
                    marginLeft: i === 0 ? 0 : '-10px',
                  }}>
                    {m.username.slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {team.members.length > 5 && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: COLORS.grayBg,
                    border: `2.5px solid ${COLORS.card}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 600, color: COLORS.grayText, marginLeft: '-10px',
                  }}>
                    +{team.members.length - 5}
                  </div>
                )}
              </div>
              <span style={{ fontSize: '12.5px', color: COLORS.muted, fontWeight: 500 }}>
                {team.members.length} membre{team.members.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  })}
</div>
      </div>
    </div>
  );
}