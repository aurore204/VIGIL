import type { Incident, Team } from '@/lib/types';
import { useTranslations, useLocale } from 'next-intl';
import { shadow } from '@/lib/tokens';
import { User, Users, Calendar, CheckCircle2, Info } from 'lucide-react';

interface IncidentInfoProps {
  incident: Incident;
  team: Team | null;
}

export function IncidentInfo({ incident, team }: IncidentInfoProps) {
  const assignee = team?.members.find(m => m.user_id === incident.assigned_to);
  const t = useTranslations('incidents.info');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';

  const rowStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' };
  const labelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'oklch(0.55 0.01 260)',
  };
  const valueStyle: React.CSSProperties = { fontSize: '13.5px', color: 'oklch(0.92 0.005 260)', fontWeight: 500 };

  return (
    <div style={{
      background: 'oklch(0.20 0.016 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '14px', padding: '20px',
      boxShadow: '0 4px 20px oklch(0 0 0 / 0.25)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '18px',
      }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '8px',
          background: 'oklch(0.26 0.03 255)', border: '1px solid oklch(0.36 0.06 255)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Info size={13} color="oklch(0.75 0.14 255)" aria-hidden="true" />
        </div>
        <div style={{
          fontSize: '12.5px', fontWeight: 700,
          color: 'oklch(0.85 0.005 260)',
        }}>
          {t('title')}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}><User size={12} aria-hidden="true" />{t('assignedTo')}</span>
          {assignee ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
              }}>
                {assignee.username.slice(0, 2).toUpperCase()}
              </div>
              <span style={valueStyle}>{assignee.username}</span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'oklch(0.45 0.01 260)', fontStyle: 'italic' }}>{t('unassigned')}</span>
          )}
        </div>

        <div style={{ height: '1px', background: 'oklch(0.27 0.015 260)' }} />

        <div style={rowStyle}>
          <span style={labelStyle}><Users size={12} aria-hidden="true" />{t('team')}</span>
          <span style={valueStyle}>{team?.name ?? '-'}</span>
        </div>

        <div style={{ height: '1px', background: 'oklch(0.27 0.015 260)' }} />

        <div style={rowStyle}>
          <span style={labelStyle}><Calendar size={12} aria-hidden="true" />{t('createdAt')}</span>
          <span style={valueStyle}>{new Date(incident.created_at).toLocaleString(dateLocale)}</span>
        </div>

        {incident.resolved_at && (
          <>
            <div style={{ height: '1px', background: 'oklch(0.27 0.015 260)' }} />
            <div style={rowStyle}>
              <span style={labelStyle}><CheckCircle2 size={12} aria-hidden="true" />{t('resolvedAt')}</span>
              <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'oklch(0.72 0.14 150)' }}>
                {new Date(incident.resolved_at).toLocaleString(dateLocale)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}