'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Team, WsEvent } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MemberRow } from '@/components/teams/MemberRow';
import { InviteCodeBanner } from '@/components/teams/InviteCodeBanner';
import { ArrowLeft, Users, Calendar } from 'lucide-react';
import { BannedMemberRow } from '@/components/teams/BannedMemberRow';
import type { BannedMember } from '@/lib/types';
import { shadow } from '@/lib/tokens';

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();
  const t = useTranslations('teams.detailPage');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; target: string; userId: string; banUntil?: string } | null>(null);
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('permanent');
  const [banDate, setBanDate] = useState('');
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const [bannedMembers, setBannedMembers] = useState<BannedMember[]>([]);

  const load = async () => {
    try {
      const data = await api.getTeam(id);
      setTeam(data);
      if (data.manager_id === user?.id) {
        try {
          const banned = await api.getBannedMembers(id);
          setBannedMembers(banned);
        } catch { }
      }
    } catch {
      showToast(t('toastAccessLost'), 'warning');
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
    const onMemberUnbanned = (e: WsEvent) => {
      if (e.type !== 'member_unbanned' || e.team_id !== id) return;
      load();
    };
    const onPresenceOnline = (e: WsEvent) => {
      if (e.type !== 'presence_online') return;
      setOnlineUsernames(e.usernames);
    };

    vigilWs.on('member_kicked', onMemberKicked);
    vigilWs.on('member_banned', onMemberBanned);
    vigilWs.on('member_unbanned', onMemberUnbanned);
    vigilWs.on('presence_online', onPresenceOnline);

    return () => {
      vigilWs.off('member_kicked', onMemberKicked);
      vigilWs.off('member_banned', onMemberBanned);
      vigilWs.off('member_unbanned', onMemberUnbanned);
      vigilWs.off('presence_online', onPresenceOnline);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isManager = team?.manager_id === user?.id;

  const handleGenerateCode = async () => {
    try {
      const res = await api.generateInvitation(id);
      setInviteCode(res.code);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastError'), 'error');
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'observer' ? 'responder' : 'observer';
    try {
      await api.updateMemberRole(id, userId, newRole);
      showToast(t('toastRoleUpdated'), 'success');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastError'), 'error');
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'kick') {
        await api.kickMember(id, confirm.userId);
        showToast(t('toastKicked', { username: confirm.target }), 'success');
      } else if (confirm.action === 'ban') {
        const expiresAt = banType === 'temporary' && banDate ? new Date(banDate).toISOString() : undefined;
        await api.banMember(id, confirm.userId, expiresAt);
        showToast(
          banType === 'temporary'
            ? t('toastBannedTemporary', { username: confirm.target })
            : t('toastBannedPermanent', { username: confirm.target }),
          'success'
        );
      } else if (confirm.action === 'transfer') {
        await api.transferManager(id, confirm.userId);
        showToast(t('toastTransferred', { username: confirm.target }), 'success');
      } else if (confirm.action === 'leave') {
        await api.leaveTeam(id);
        showToast(t('toastLeft'), 'success');
        router.push('/teams');
        return;
      } else if (confirm.action === 'delete') {
        await api.deleteTeam(id);
        showToast(t('toastDeleted'), 'success');
        router.push('/teams');
        return;
      }
      setConfirm(null);
      setBanType('permanent');
      setBanDate('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastError'), 'error');
      setConfirm(null);
    }
  };

  const handleUnban = async (userId: string, username: string) => {
    try {
      await api.unbanMember(id, userId);
      showToast(t('toastUnbanned', { username }), 'success');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastError'), 'error');
    }
  };

  if (loading || !team) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>{t('loading')}</div>
  );

  const confirmDescription = () => {
    if (!confirm) return '';
    switch (confirm.action) {
      case 'kick': return t('confirmDialog.kickDescription', { target: confirm.target });
      case 'ban': return t('confirmDialog.banDescription', { target: confirm.target });
      case 'transfer': return t('confirmDialog.transferDescription', { target: confirm.target });
      case 'leave': return t('confirmDialog.leaveDescription', { target: confirm.target });
      default: return t('confirmDialog.deleteDescription', { target: confirm.target });
    }
  };

  const managerMember = team.members.find(m => m.user_id === team.manager_id);

  return (
    <div style={{ padding: '28px clamp(16px, 4vw, 32px)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <button
        onClick={() => router.push('/teams')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'oklch(0.60 0.01 260)',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '20px', padding: 0,
        }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t('back')}
      </button>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '20px', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'oklch(0.25 0.05 255)', border: '1px solid oklch(0.40 0.10 255)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Users size={20} color="oklch(0.75 0.14 255)" aria-hidden="true" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', lineHeight: 1.2 }}>{team.name}</div>
            {team.description && (
              <div style={{ fontSize: '13px', color: 'oklch(0.60 0.01 260)', marginTop: '4px' }}>{team.description}</div>
            )}
          </div>
        </div>
        {isManager && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={handleGenerateCode}>{t('generateCode')}</Button>
            <Button variant="danger" onClick={() => setConfirm({ action: 'delete', target: team.name, userId: '' })}>
              {t('delete')}
            </Button>
          </div>
        )}
      </div>

      {/* Détails */}
      <div style={{
        background: 'oklch(0.195 0.015 260)', border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '12px', padding: '20px',
        marginBottom: '20px', boxShadow: shadow.card,
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '18px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'oklch(0.55 0.01 260)' }}>
              <Users size={12} aria-hidden="true" />
              {t('membersLabel')}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'oklch(0.92 0.005 260)' }}>
              {t('memberCount', { count: team.members.length })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '11px', color: 'oklch(0.55 0.01 260)' }}>
              {t('managerLabel')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, color: 'oklch(0.92 0.005 260)' }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, color: 'oklch(0.85 0.05 255)', flexShrink: 0,
              }}>
                {managerMember?.username.slice(0, 2).toUpperCase() ?? '?'}
              </span>
              {managerMember?.username ?? '—'}
            </span>
          </div>
          {team.created_at && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'oklch(0.55 0.01 260)' }}>
                <Calendar size={12} aria-hidden="true" />
                {t('createdOnLabel')}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'oklch(0.92 0.005 260)' }}>
                {new Date(team.created_at).toLocaleDateString(dateLocale)}
              </span>
            </div>
          )}
        </div>
      </div>

      {inviteCode && (
        <div style={{ marginBottom: '20px' }}>
          <InviteCodeBanner
            code={inviteCode}
            onCopy={() => { navigator.clipboard.writeText(inviteCode); showToast(t('toastCodeCopied'), 'success'); }}
          />
        </div>
      )}

      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '14px', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid oklch(0.30 0.02 260)',
          fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)',
        }}>
          {t('membersHeading')}
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
              onTransfer={(userId, username) => setConfirm({ action: 'transfer', target: username, userId })}
              onLeave={() => setConfirm({ action: 'leave', target: team.name, userId: '' })}
            />
          </div>
        ))}
      </div>

      {isManager && bannedMembers.length > 0 && (
        <div style={{
          marginTop: '20px',
          background: 'oklch(0.195 0.015 260)',
          border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: '14px', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid oklch(0.30 0.02 260)',
            fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)',
          }}>
            {t('bannedHeading', { count: bannedMembers.length })}
          </div>
          {bannedMembers.map((banned, i) => (
            <div
              key={banned.user_id}
              style={{ borderBottom: i < bannedMembers.length - 1 ? '1px solid oklch(0.27 0.015 260)' : 'none' }}
            >
              <BannedMemberRow banned={banned} canUnban={isManager} onUnban={handleUnban} />
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        title={t('confirmDialog.title')}
        description={confirmDescription()}
        confirmLabel={t('confirmDialog.confirmLabel')}
        cancelLabel={t('confirmDialog.cancelLabel')}
        onConfirm={confirmAction}
        onCancel={() => { setConfirm(null); setBanType('permanent'); setBanDate(''); }}
      >
        {confirm?.action === 'ban' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'oklch(0.85 0.005 260)', cursor: 'pointer' }}>
              <input type="radio" checked={banType === 'permanent'} onChange={() => setBanType('permanent')} />
              {t('confirmDialog.banPermanent')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'oklch(0.85 0.005 260)', cursor: 'pointer' }}>
              <input type="radio" checked={banType === 'temporary'} onChange={() => setBanType('temporary')} />
              {t('confirmDialog.banTemporary')}
            </label>
            {banType === 'temporary' && (
              <input
                type="datetime-local"
                value={banDate}
                onChange={e => setBanDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
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