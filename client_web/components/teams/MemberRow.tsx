import type { TeamMember } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArrowUpCircle, ArrowDownCircle, UserX, Ban, Crown } from 'lucide-react';

interface MemberRowProps {
  member: TeamMember;
  isMe: boolean;
  isManager: boolean;
  isTargetManager: boolean;
  isOnline: boolean;
  onRoleChange: (userId: string, currentRole: string) => void;
  onKick: (userId: string, username: string) => void;
  onBan: (userId: string, username: string) => void;
  onTransfer: (userId: string, username: string) => void;
  onLeave: () => void;
}

export function MemberRow({
  member, isMe, isManager, isTargetManager, isOnline,
  onRoleChange, onKick, onBan, onTransfer, onLeave,
}: MemberRowProps) {
  const t = useTranslations('teams.memberRow');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px', flexWrap: 'wrap',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'oklch(0.30 0.03 255)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
        }}>
          {member.username.slice(0, 2).toUpperCase()}
        </div>
        {isOnline && (
          <span
            aria-label={t('online')}
            title={t('online')}
            style={{
              position: 'absolute', bottom: '-1px', right: '-1px',
              width: '10px', height: '10px', borderRadius: '50%',
              background: 'oklch(0.72 0.14 150)',
              border: '2px solid oklch(0.16 0.015 260)',
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: '120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
          {member.username}
          {isMe && <span style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>{t('you')}</span>}
          <span style={{ fontSize: '10.5px', color: isOnline ? 'oklch(0.72 0.14 150)' : 'oklch(0.45 0.01 260)' }}>
            {isOnline ? t('online') : t('offline')}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>{member.email}</div>
      </div>

      <RoleBadge role={member.role} />

      {isManager && !isMe && !isTargetManager && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onRoleChange(member.user_id, member.role)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: '6px',
              border: '1px solid oklch(0.34 0.02 260)',
              background: 'transparent', color: 'oklch(0.72 0.01 260)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {member.role === 'observer' ? <ArrowUpCircle size={12} aria-hidden="true" /> : <ArrowDownCircle size={12} aria-hidden="true" />}
            {member.role === 'observer' ? t('makeResponder') : t('makeObserver')}
          </button>
          <button
            onClick={() => onTransfer(member.user_id, member.username)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: '6px',
              border: '1px solid oklch(0.42 0.10 85 / 0.6)',
              background: 'transparent', color: 'oklch(0.80 0.14 85)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Crown size={12} aria-hidden="true" />
            {t('transfer')}
          </button>
          <button
            onClick={() => onKick(member.user_id, member.username)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: '6px',
              border: '1px solid oklch(0.34 0.02 260)',
              background: 'transparent', color: 'oklch(0.72 0.01 260)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <UserX size={12} aria-hidden="true" />
            {t('kick')}
          </button>
          <button
            onClick={() => onBan(member.user_id, member.username)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: '6px',
              border: '1px solid oklch(0.45 0.15 25 / 0.5)',
              background: 'transparent', color: 'oklch(0.75 0.15 25)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Ban size={12} aria-hidden="true" />
            {t('ban')}
          </button>
        </div>
      )}

      {!isManager && isMe && (
        <Button variant="ghost" onClick={onLeave} style={{ fontSize: '11px', color: 'oklch(0.75 0.15 25)' }}>
          {t('leave')}
        </Button>
      )}
    </div>
  );
}