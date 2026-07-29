import type { Incident, Team } from '@/lib/types';
import { IncidentStateBadge, SeverityBadge } from '@/components/ui/Badge';
import Link from 'next/link';

interface IncidentTableProps {
  incidents: Incident[];
  teams: Team[];
}

export function IncidentTable({ incidents, teams }: IncidentTableProps) {
  if (incidents.length === 0) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'oklch(0.52 0.012 260)', fontSize: '13px' }}>
      Aucun incident trouvé
    </div>
  );

  return (
    <>
      {incidents.map((incident, i) => {
        const team = teams.find(t => t.id === incident.team_id);
        const assignee = team?.members.find(m => m.user_id === incident.assigned_to);
        return (
          <Link
            key={incident.id}
            href={`/incidents/${incident.id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 2fr 100px 100px 100px 120px 80px',
              gap: '10px', alignItems: 'center',
              padding: '12px 16px', textDecoration: 'none',
              borderBottom: i < incidents.length - 1 ? '1px solid oklch(0.27 0.015 260)' : 'none',
              minWidth: '900px',
            }}
          >
            <div style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.60 0.01 260)' }}>
              {incident.id.slice(0, 8)}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'oklch(0.90 0.005 260)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {incident.title}
            </div>
            <SeverityBadge severity={incident.severity} />
            <IncidentStateBadge state={incident.state} />
            <div style={{ fontSize: '12px', color: 'oklch(0.70 0.01 260)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {team?.name ?? '-'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', fontWeight: 700, color: 'oklch(0.85 0.05 255)', flexShrink: 0,
              }}>
                {assignee ? assignee.username.slice(0, 2).toUpperCase() : '?'}
              </div>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: assignee ? 'oklch(0.72 0.01 260)' : 'oklch(0.45 0.01 260)',
                fontStyle: assignee ? 'normal' : 'italic',
              }}>
                {assignee ? assignee.username : 'Non assigné'}
              </span>
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.52 0.012 260)' }}>
              {new Date(incident.created_at).toLocaleDateString('fr-FR')}
            </div>
          </Link>
        );
      })}
    </>
  );
}