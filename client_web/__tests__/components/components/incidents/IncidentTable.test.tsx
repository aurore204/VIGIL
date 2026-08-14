import { render, screen } from '@testing-library/react';
import { IncidentTable } from '@/components/incidents/IncidentTable';
import type { Incident, Team } from '@/lib/types';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

jest.mock('@/components/ui/Badge', () => ({
  IncidentStateBadge: ({ state }: { state: string }) => <span>{state}</span>,
  SeverityBadge: ({ severity }: { severity: string }) => <span>{severity}</span>,
}));

const makeIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: 'inc-1', team_id: 'team-1', title: 'Panne serveur', description: null,
  state: 'open', severity: 'critical', assigned_to: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', resolved_at: null,
  ...overrides,
});

const teams: Team[] = [
  { id: 'team-1', name: 'Team Alpha', description: null, manager_id: 'u1', members: [{ user_id: 'u1', username: 'alice', email: 'a@test.com', role: 'manager', joined_at: '2026-01-01T00:00:00Z' }], created_at: '2026-01-01T00:00:00Z' },
];

describe('IncidentTable', () => {
  it('affiche le message vide quand aucun incident', () => {
    render(<IncidentTable incidents={[]} teams={teams} />);

    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('affiche le titre de chaque incident', () => {
    render(<IncidentTable incidents={[makeIncident()]} teams={teams} />);

    expect(screen.getByText('Panne serveur')).toBeInTheDocument();
  });

  it('affiche le nom de la team associée', () => {
    render(<IncidentTable incidents={[makeIncident()]} teams={teams} />);

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
  });

  it('affiche "unassigned" quand personne n\'est assigné', () => {
    render(<IncidentTable incidents={[makeIncident({ assigned_to: null })]} teams={teams} />);

    expect(screen.getByText('unassigned')).toBeInTheDocument();
  });

  it('affiche le nom de l\'assigné quand présent', () => {
    render(<IncidentTable incidents={[makeIncident({ assigned_to: 'u1' })]} teams={teams} />);

    expect(screen.getByText('alice')).toBeInTheDocument();
  });
});