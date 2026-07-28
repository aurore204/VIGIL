'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import type { Team, Incident } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

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
      await Promise.all(
        data.map(async (team) => {
          try {
            const incidents: Incident[] = await api.getIncidents(team.id);
            counts[team.id] = incidents.filter(i => i.state !== 'resolved').length;
          } catch {
            counts[team.id] = 0;
          }
        })
      );
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

  if (loading) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>
      Chargement...
    </div>
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
            Teams
          </div>
          <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
            Vos équipes et leur activité
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowJoin(true)}
            style={{
              padding: '9px 14px', borderRadius: '7px',
              border: '1px solid oklch(0.34 0.02 260)',
              background: 'transparent', color: 'oklch(0.90 0.005 260)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Rejoindre
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '9px 14px', borderRadius: '7px', border: 'none',
              background: 'oklch(0.66 0.16 255)', color: 'oklch(0.16 0.015 260)',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            + Créer une team
          </button>
        </div>
      </div>

      {/* Grid teams */}
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
            <button
              onClick={() => setShowJoin(true)}
              style={{
                padding: '9px 14px', borderRadius: '7px',
                border: '1px solid oklch(0.34 0.02 260)',
                background: 'transparent', color: 'oklch(0.90 0.005 260)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Rejoindre avec un code
            </button>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '9px 14px', borderRadius: '7px', border: 'none',
                background: 'oklch(0.66 0.16 255)', color: 'oklch(0.16 0.015 260)',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Créer une team
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {teams.map(team => {
            const activeIncidents = teamIncidents[team.id] ?? 0;
            return (
              <div
                key={team.id}
                style={{
                  background: 'oklch(0.195 0.015 260)',
                  border: '1px solid oklch(0.30 0.02 260)',
                  borderRadius: '10px', padding: '18px',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
                    {team.name}
                  </div>
                  {activeIncidents > 0 && (
                    <span style={{
                      padding: '3px 8px', borderRadius: '6px',
                      fontSize: '11px', fontWeight: 700,
                      background: 'oklch(0.45 0.18 25)', color: 'oklch(0.95 0.005 260)',
                      flexShrink: 0,
                    }}>
                      {activeIncidents} Incident{activeIncidents > 1 ? 's' : ''} actif{activeIncidents > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Members */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex' }}>
                    {team.members.slice(0, 5).map((m, i) => (
                      <div
                        key={m.user_id}
                        title={m.username}
                        style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: 'oklch(0.30 0.03 255)',
                          border: '2px solid oklch(0.195 0.015 260)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                          marginLeft: i > 0 ? '-6px' : '0',
                          position: 'relative', zIndex: team.members.length - i,
                        }}
                      >
                        {m.username.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: '12px', color: 'oklch(0.60 0.01 260)' }}>
                    {team.members.length} membre{team.members.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Voir la team button */}
                <Link href={`/teams/${team.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    width: '100%', padding: '9px 14px',
                    borderRadius: '7px',
                    border: '1px solid oklch(0.34 0.02 260)',
                    background: 'transparent', color: 'oklch(0.90 0.005 260)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    textAlign: 'center',
                  }}>
                    Voir la team
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Créer */}
      {showCreate && (
        <Modal title="Créer une team" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)', marginBottom: '6px' }}>
              Nom de la team
            </label>
            <input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="Ex: Équipe Backend"
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', marginBottom: '14px',
                borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
                background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)', marginBottom: '6px' }}>
              Description (optionnelle)
            </label>
            <input
              value={newTeamDesc}
              onChange={e => setNewTeamDesc(e.target.value)}
              placeholder="Ex: Gestion des incidents API"
              style={{
                width: '100%', padding: '10px 12px', marginBottom: '20px',
                borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
                background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{
                  padding: '9px 14px', borderRadius: '7px',
                  border: '1px solid oklch(0.34 0.02 260)',
                  background: 'transparent', color: 'oklch(0.72 0.01 260)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '9px 14px', borderRadius: '7px', border: 'none',
                  background: 'oklch(0.66 0.16 255)', color: 'oklch(0.16 0.015 260)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {submitting ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Rejoindre */}
      {showJoin && (
        <Modal title="Rejoindre une team" onClose={() => setShowJoin(false)}>
          <form onSubmit={handleJoin}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)', marginBottom: '6px' }}>
              Code d&apos;invitation
            </label>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="Ex: A1B2C3D4"
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', marginBottom: '20px',
                borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
                background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowJoin(false)}
                style={{
                  padding: '9px 14px', borderRadius: '7px',
                  border: '1px solid oklch(0.34 0.02 260)',
                  background: 'transparent', color: 'oklch(0.72 0.01 260)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '9px 14px', borderRadius: '7px', border: 'none',
                  background: 'oklch(0.66 0.16 255)', color: 'oklch(0.16 0.015 260)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {submitting ? 'Recherche...' : 'Rejoindre'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'oklch(0 0 0 / 0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.34 0.02 260)',
        borderRadius: '14px', padding: '24px',
        width: '100%', maxWidth: '420px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'oklch(0.52 0.012 260)', fontSize: '16px', lineHeight: 1, padding: '4px',
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}