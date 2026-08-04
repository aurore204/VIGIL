'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Team, WsEvent } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MemberRow } from '@/components/teams/MemberRow';
import { InviteCodeBanner } from '@/components/teams/InviteCodeBanner';
import { ArrowLeft } from 'lucide-react';

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; target: string; userId: string; banUntil?: string } | null>(null);
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('permanent');
  const [banDate, setBanDate] = useState('');
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);

  const load = async () => {
    try {
      const data = await api.getTeam(id);
      setTeam(data);
    } catch {
      // on n'a plus accès à cette team (ex: on vient d'en être kické/banni)
      showToast('Vous n\'avez plus accès à cette team', 'warning');
      router.push('/teams');
    } finally {
      setLoading(false);
    }
  };

 useEffect(() => {
  load();
  api.getOnlineUsers().then(setOnlineUsernames).catch(() => {});

  const onMemberKicked = (e: WsEvent) => {
    if (e.type !== 'member_kicked' || e.team_id !== id) return;
    load();
  };
  const onMemberBanned = (e: WsEvent) => {
    if (e.type !== 'member_banned' || e.team_id !== id) return;
    load();
  };
  const onPresenceOnline = (e: WsEvent) => {
    if (e.type !== 'presence_online') return;
    setOnlineUsernames(e.usernames);
  };

  vigilWs.on('member_kicked', onMemberKicked);
  vigilWs.on('member_banned', onMemberBanned);
  vigilWs.on('presence_online', onPresenceOnline);

  return () => {
    vigilWs.off('member_kicked', onMemberKicked);
    vigilWs.off('member_banned', onMemberBanned);
    vigilWs.off('presence_online', onPresenceOnline);
  };
}, [id]); 

  const isManager = team?.manager_id === user?.id;

  const handleGenerateCode = async () => {
    try {
      const res = await api.generateInvitation(id);
      setInviteCode(res.code);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
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

  const confirmAction = async () => {
  if (!confirm) return;
  try {
    if (confirm.action === 'kick') {
      await api.kickMember(id, confirm.userId);
      showToast(`${confirm.target} retiré`, 'success');
    } else if (confirm.action === 'ban') {
      const expiresAt = banType === 'temporary' && banDate ? new Date(banDate).toISOString() : undefined;
      await api.banMember(id, confirm.userId, expiresAt);
      showToast(`${confirm.target} banni ${banType === 'temporary' ? 'temporairement' : 'définitivement'}`, 'success');
    } else if (confirm.action === 'leave') {
      await api.leaveTeam(id);
      showToast('Vous avez quitté la team', 'success');
      router.push('/teams');
      return;
    } else if (confirm.action === 'delete') {
      await api.deleteTeam(id);
      showToast('Team supprimée', 'success');
      router.push('/teams');
      return;
    }
    setConfirm(null);
    setBanType('permanent');
    setBanDate('');
    load();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    setConfirm(null);
  }
};

  if (loading || !team) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>
      <button
        onClick={() => router.push('/teams')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'oklch(0.60 0.01 260)',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '16px', padding: 0,
        }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Retour
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>{team.name}</div>
          {team.description && (
            <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>{team.description}</div>
          )}
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', marginTop: '4px' }}>
            {team.members.length} membre{team.members.length > 1 ? 's' : ''}
          </div>
        </div>
        {isManager && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={handleGenerateCode}>Générer un code</Button>
            <Button variant="danger" onClick={() => setConfirm({ action: 'delete', target: team.name, userId: '' })}>
              Supprimer
            </Button>
          </div>
        )}
      </div>

      {inviteCode && (
        <div style={{ marginBottom: '20px' }}>
          <InviteCodeBanner
            code={inviteCode}
            onCopy={() => { navigator.clipboard.writeText(inviteCode); showToast('Code copié !', 'success'); }}
          />
        </div>
      )}

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
        {team.members.map((member, i) => (
          <div
            key={member.user_id}
            style={{ borderBottom: i < team.members.length - 1 ? '1px solid oklch(0.27 0.015 260)' : 'none' }}
          >
               <MemberRow
              member={member}
              isMe={member.user_id === user?.id}
              isManager={isManager}
              isTargetManager={member.role === 'manager'}
              isOnline={onlineUsernames.includes(member.username)}
              onRoleChange={handleRoleChange}
              onKick={(userId, username) => setConfirm({ action: 'kick', target: username, userId })}
              onBan={(userId, username) => setConfirm({ action: 'ban', target: username, userId })}
              onLeave={() => setConfirm({ action: 'leave', target: team.name, userId: '' })}
            />
          </div>
        ))}
      </div>

      <ConfirmDialog
  isOpen={!!confirm}
  title="Confirmer l'action"
  description={
    confirm?.action === 'kick' ? `Retirer ${confirm.target} de la team ?` :
    confirm?.action === 'ban' ? `Bannir ${confirm.target} de la team ?` :
    confirm?.action === 'leave' ? `Quitter la team "${confirm?.target}" ?` :
    `Supprimer définitivement la team "${confirm?.target}" ?`
  }
  confirmLabel="Confirmer"
  onConfirm={confirmAction}
  onCancel={() => { setConfirm(null); setBanType('permanent'); setBanDate(''); }}
>
  {confirm?.action === 'ban' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'oklch(0.85 0.005 260)', cursor: 'pointer' }}>
              <input type="radio" checked={banType === 'permanent'} onChange={() => setBanType('permanent')} />
              Bannissement permanent
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'oklch(0.85 0.005 260)', cursor: 'pointer' }}>
              <input type="radio" checked={banType === 'temporary'} onChange={() => setBanType('temporary')} />
              Bannissement temporaire jusqu&apos;au :
            </label>
            {banType === 'temporary' && (
              <input
                type="date"
                value={banDate}
                onChange={e => setBanDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  padding: '8px 10px', borderRadius: '6px',
                  border: '1px solid oklch(0.34 0.02 260)', background: 'oklch(0.16 0.015 260)',
                  color: 'oklch(0.95 0.005 260)', fontSize: '13px', outline: 'none',
                }}
              />
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}