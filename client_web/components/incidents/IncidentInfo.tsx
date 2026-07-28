import type { Incident, Team } from '@/lib/types';

interface IncidentInfoProps {
  incident: Incident;
  team: Team | null;
}

export function IncidentInfo({ incident, team }: IncidentInfoProps) {
  const assignee = team?.members.find(m => m.user_id === incident.assigned_to);

  const rowStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: '3px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: 'oklch(0.55 0.01 260)',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '13px', color: 'oklch(0.90 0.005 260)',
  };

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '10px', padding: '18px',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '12px',
      }}>
        Informations
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>Assigné à</span>
          {assignee ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
              }}>
                {assignee.username.slice(0, 2).toUpperCase()}
              </div>
              <span style={valueStyle}>{assignee.username}</span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'oklch(0.45 0.01 260)', fontStyle: 'italic' }}>Non assigné</span>
          )}
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Team</span>
          <span style={valueStyle}>{team?.name ?? '-'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Créé le</span>
          <span style={valueStyle}>{new Date(incident.created_at).toLocaleString('fr-FR')}</span>
        </div>
        {incident.resolved_at && (
          <div style={rowStyle}>
            <span style={labelStyle}>Résolu le</span>
            <span style={{ fontSize: '13px', color: 'oklch(0.72 0.14 150)' }}>
              {new Date(incident.resolved_at).toLocaleString('fr-FR')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}