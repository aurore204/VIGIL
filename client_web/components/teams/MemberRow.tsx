import type { TeamMember } from '@/lib/types';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface MemberRowProps {
  member: TeamMember;
  isMe: boolean;
  isManager: boolean;
  isTargetManager: boolean;
  onRoleChange: (userId: string, currentRole: string) => void;
  onKick: (userId: string, username: string) => void;
  onBan: (userId: string, username: string) => void;
  onLeave: () => void;
}

export function MemberRow({
  member, isMe, isManager, isTargetManager,
  onRoleChange, onKick, onBan, onLeave,
}: MemberRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: 'oklch(0.30 0.03 255)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
        flexShrink: 0,
      }}>
        {member.username.slice(0, 2).toUpperCase()}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
          {member.username}
          {isMe && <span style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)', marginLeft: '6px' }}>(vous)</span>}
        </div>
        <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>{member.email}</div>
      </div>

      <RoleBadge role={member.role} />

      {isManager && !isMe && !isTargetManager && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => onRoleChange(member.user_id, member.role)}
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
            onClick={() => onKick(member.user_id, member.username)}
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
            onClick={() => onBan(member.user_id, member.username)}
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

      {!isManager && isMe && (
        <Button variant="ghost" onClick={onLeave} style={{ fontSize: '11px', color: 'oklch(0.75 0.15 25)' }}>
          Quitter
        </Button>
      )}
    </div>
  );
}