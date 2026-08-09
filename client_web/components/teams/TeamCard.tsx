import type { Team } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface TeamCardProps {
  team: Team;
  activeIncidents: number;
  currentUserId: string;
}

export function TeamCard({ team, activeIncidents, currentUserId }: TeamCardProps) {
  const t = useTranslations('teams.card');

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '10px', padding: '18px',
    }}>
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
            {t('activeIncident', { count: activeIncidents })}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex' }}>
          {team.members.slice(0, 5).map((m, i) => (
            <div
              key={m.user_id}
              title={m.username}
              style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: m.user_id === currentUserId ? 'oklch(0.50 0.14 255)' : 'oklch(0.30 0.03 255)',
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
          {t('memberCount', { count: team.members.length })}
        </span>
      </div>

      <Link href={`/teams/${team.id}`} style={{ textDecoration: 'none' }}>
        <div style={{
          width: '100%', padding: '9px 14px', borderRadius: '7px',
          border: '1px solid oklch(0.34 0.02 260)',
          background: 'transparent', color: 'oklch(0.90 0.005 260)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'center',
        }}>
          {t('view')}
        </div>
      </Link>
    </div>
  );
}