import type { Incident, Team } from '@/lib/types';
import { IncidentStateBadge, SeverityBadge } from '@/components/ui/Badge';
import Link from 'next/link';

const severityDotColor: Record<string, string> = {
  low: 'oklch(0.72 0.14 150)',
  medium: 'oklch(0.82 0.14 85)',
  high: 'oklch(0.78 0.14 60)',
  critical: 'oklch(0.78 0.14 25)',
};

interface IncidentTableProps {
  incidents: Incident[];
  teams: Team[];
}

export function IncidentTable({ incidents, teams }: IncidentTableProps) {
  if (incidents.length === 0) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'oklch(0.52 0.012 260)', fontSize: '13px' }}>
      Aucun incident trouvé
    </div>
  );

  return (
    <>
      {incidents.map((incident, i) => {
        const team = teams.find(t => t.id === incident.team_id);
        const assignee = team?.members.find(m => m.user_id === incident.assigned_to);
        const isEven = i % 2 === 0;

        return (
          <Link
            key={incident.id}
            href={`/incidents/${incident.id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '2.2fr 110px 120px 130px 140px 90px',
              gap: '16px', alignItems: 'center',
              padding: '14px 20px',
              textDecoration: 'none',
              background: isEven ? 'oklch(0.185 0.014 260)' : 'oklch(0.165 0.013 260)',
              borderBottom: i < incidents.length - 1 ? '1px solid oklch(0.26 0.015 260)' : 'none',
              minWidth: '920px',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.23 0.02 260)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isEven ? 'oklch(0.185 0.014 260)' : 'oklch(0.165 0.013 260)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: severityDotColor[incident.severity], flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: '13.5px', fontWeight: 600, color: 'oklch(0.92 0.005 260)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {incident.title}
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.48 0.012 260)', marginTop: '1px' }}>
                  #{incident.id.slice(0, 8)}
                </div>
              </div>
            </div>

            <SeverityBadge severity={incident.severity} />
            <IncidentStateBadge state={incident.state} />

            <div style={{
              fontSize: '12.5px', color: 'oklch(0.68 0.01 260)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {team?.name ?? '-'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', minWidth: 0 }}>
              {assignee ? (
                <>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'oklch(0.30 0.03 255)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8.5px', fontWeight: 700, color: 'oklch(0.85 0.05 255)', flexShrink: 0,
                  }}>
                    {assignee.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ color: 'oklch(0.75 0.01 260)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {assignee.username}
                  </span>
                </>
              ) : (
                <span style={{ color: 'oklch(0.42 0.01 260)', fontStyle: 'italic' }}>Non assigné</span>
              )}
            </div>

            <div style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.50 0.012 260)' }}>
              {new Date(incident.created_at).toLocaleDateString('fr-FR')}
            </div>
          </Link>
        );
      })}
    </>
  );
}