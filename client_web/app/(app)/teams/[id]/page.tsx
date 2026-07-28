'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import type { Team } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ action: string; target: string; userId: string } | null>(null);

  const load = async () => {
    try {
      const data = await api.getTeam(id);
      setTeam(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const isManager = team?.manager_id === user?.id;
  const myRole = team?.members.find(m => m.user_id === user?.id)?.role ?? 'observer';

  const handleGenerateCode = async () => {
    try {
      const res = await api.generateInvitation(id);
      setInviteCode(res.code);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleKick = async (userId: string, username: string) => {
    setShowConfirm({ action: 'kick', target: username, userId });
  };

  const handleBan = async (userId: string, username: string) => {
    setShowConfirm({ action: 'ban', target: username, userId });
  };

  const confirmAction = async () => {
    if (!showConfirm) return;
    try {
      if (showConfirm.action === 'kick') {
        await api.kickMember(id, showConfirm.userId);
        showToast(`${showConfirm.target} a été retiré`, 'success');
      } else if (showConfirm.action === 'ban') {
        await api.banMember(id, showConfirm.userId);
        showToast(`${showConfirm.target} a été banni`, 'success');
      } else if (showConfirm.action === 'leave') {
        await api.leaveTeam(id);
        showToast('Vous avez quitté la team', 'success');
        router.push('/teams');
        return;
      } else if (showConfirm.action === 'delete') {
        await api.deleteTeam(id);
        showToast('Team supprimée', 'success');
        router.push('/teams');
        return;
      }
      setShowConfirm(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
      setShowConfirm(null);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'observer' ? 'responder' : 'observer';
    try {
      await api.updateMemberRole(id, userId, newRole);
      showToast('Rôle mis à jour', 'success');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  if (loading) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>
      Chargement...
    </div>
  );

  if (!team) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)' }}>Team introuvable</div>
  );

  const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
    manager: { label: 'Manager', color: 'oklch(0.82 0.14 85)', bg: 'oklch(0.24 0.05 85 / 0.3)' },
    responder: { label: 'Responder', color: 'oklch(0.75 0.14 255)', bg: 'oklch(0.22 0.04 255 / 0.3)' },
    observer: { label: 'Observer', color: 'oklch(0.65 0.01 260)', bg: 'oklch(0.25 0.01 260 / 0.3)' },
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/teams')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'oklch(0.60 0.01 260)',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '16px', padding: 0,
        }}
      >
        ← Retour
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
            {team.name}
          </div>
          {team.description && (
            <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>
              {team.description}
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', marginTop: '4px' }}>
            {team.members.length} membre{team.members.length > 1 ? 's' : ''} · Mon rôle :
            <span style={{
              marginLeft: '6px', padding: '2px 7px', borderRadius: '5px',
              fontSize: '11px', fontWeight: 600,
              background: roleConfig[myRole].bg, color: roleConfig[myRole].color,
            }}>
              {roleConfig[myRole].label}
            </span>
          </div>
        </div>

        {isManager && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleGenerateCode}
              style={{
                padding: '9px 14px', borderRadius: '7px',
                border: '1px solid oklch(0.34 0.02 260)',
                background: 'transparent', color: 'oklch(0.90 0.005 260)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Générer un code
            </button>
            <button
              onClick={() => setShowConfirm({ action: 'delete', target: team.name, userId: '' })}
              style={{
                padding: '9px 14px', borderRadius: '7px',
                border: '1px solid oklch(0.45 0.15 25 / 0.5)',
                background: 'transparent', color: 'oklch(0.75 0.15 25)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Code d'invitation */}
      {inviteCode && (
        <div style={{
          background: 'oklch(0.20 0.04 150 / 0.3)',
          border: '1px solid oklch(0.45 0.14 150)',
          borderRadius: '10px', padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.14 150)', marginBottom: '4px' }}>
              Code d&apos;invitation généré
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: 'oklch(0.95 0.005 260)', letterSpacing: '0.1em' }}>
              {inviteCode}
            </div>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(inviteCode); showToast('Code copié !', 'success'); }}
            style={{
              padding: '8px 14px', borderRadius: '7px',
              border: '1px solid oklch(0.45 0.14 150)',
              background: 'transparent', color: 'oklch(0.72 0.14 150)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Copier
          </button>
        </div>
      )}

      {/* Membres */}
      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '10px', overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid oklch(0.30 0.02 260)',
          fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)',
        }}>
          Membres
        </div>

        {team.members.map((member, i) => {
          const rc = roleConfig[member.role] ?? roleConfig.observer;
          const isMe = member.user_id === user?.id;
          const isTargetManager = member.role === 'manager';

          return (
            <div
              key={member.user_id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px',
                borderBottom: i < team.members.length - 1 ? '1px solid oklch(0.27 0.015 260)' : 'none',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                flexShrink: 0,
              }}>
                {member.username.slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
                  {member.username} {isMe && <span style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>(vous)</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>
                  {member.email}
                </div>
              </div>

              {/* Badge rôle */}
              <span style={{
                padding: '3px 8px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 600,
                background: rc.bg, color: rc.color,
              }}>
                {rc.label}
              </span>

              {/* Actions Manager */}
              {isManager && !isMe && !isTargetManager && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleRoleChange(member.user_id, member.role)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: '1px solid oklch(0.34 0.02 260)',
                      background: 'transparent', color: 'oklch(0.72 0.01 260)',
                      fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {member.role === 'observer' ? '↑ Responder' : '↓ Observer'}
                  </button>
                  <button
                    onClick={() => handleKick(member.user_id, member.username)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: '1px solid oklch(0.34 0.02 260)',
                      background: 'transparent', color: 'oklch(0.72 0.01 260)',
                      fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Kick
                  </button>
                  <button
                    onClick={() => handleBan(member.user_id, member.username)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: '1px solid oklch(0.45 0.15 25 / 0.5)',
                      background: 'transparent', color: 'oklch(0.75 0.15 25)',
                      fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Ban
                  </button>
                </div>
              )}

              {/* Quitter si pas manager et c'est moi */}
              {!isManager && isMe && (
                <button
                  onClick={() => setShowConfirm({ action: 'leave', target: team.name, userId: '' })}
                  style={{
                    padding: '5px 10px', borderRadius: '6px',
                    border: '1px solid oklch(0.45 0.15 25 / 0.5)',
                    background: 'transparent', color: 'oklch(0.75 0.15 25)',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Quitter
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'oklch(0 0 0 / 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(null); }}
        >
          <div style={{
            background: 'oklch(0.195 0.015 260)',
            border: '1px solid oklch(0.34 0.02 260)',
            borderRadius: '14px', padding: '24px',
            width: '100%', maxWidth: '380px',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', marginBottom: '10px' }}>
              Confirmer l&apos;action
            </div>
            <div style={{ fontSize: '13px', color: 'oklch(0.72 0.01 260)', marginBottom: '20px' }}>
              {showConfirm.action === 'kick' && `Retirer ${showConfirm.target} de la team ?`}
              {showConfirm.action === 'ban' && `Bannir ${showConfirm.target} de la team ?`}
              {showConfirm.action === 'leave' && `Quitter la team "${showConfirm.target}" ?`}
              {showConfirm.action === 'delete' && `Supprimer définitivement la team "${showConfirm.target}" ?`}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(null)}
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
                onClick={confirmAction}
                style={{
                  padding: '9px 14px', borderRadius: '7px', border: 'none',
                  background: 'oklch(0.55 0.18 25)', color: 'oklch(0.95 0.005 260)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}