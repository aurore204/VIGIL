import { render, screen } from '@testing-library/react';
import { IncidentTable } from '@/components/incidents/IncidentTable';
import type { Incident, Team } from '@/lib/types';

const mockTeam: Team = {
  id: 'team-1',
  name: 'DevOps Infrastructure',
  description: null,
  manager_id: 'user-1',
  members: [
    { user_id: 'user-2', username: 'aurore', email: 'a@a.com', role: 'responder', joined_at: '2026-01-01' },
  ],
  created_at: '2026-01-01',
};

const mockIncident: Incident = {
  id: 'inc-1',
  team_id: 'team-1',
  created_by: 'user-1',
  assigned_to: 'user-2',
  title: 'API de paiement instable',
  description: null,
  state: 'open',
  severity: 'critical',
  timeline: [],
  resolved_at: null,
  created_at: '2026-07-30T10:00:00Z',
  updated_at: '2026-07-30T10:00:00Z',
};

describe('IncidentTable', () => {
  it('affiche un message quand la liste est vide', () => {
    render(<IncidentTable incidents={[]} teams={[]} />);
    expect(screen.getByText('Aucun incident trouvé')).toBeInTheDocument();
  });

  it('affiche le titre et les infos d\'un incident', () => {
    render(<IncidentTable incidents={[mockIncident]} teams={[mockTeam]} />);
    expect(screen.getByText('API de paiement instable')).toBeInTheDocument();
    expect(screen.getByText('DevOps Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('aurore')).toBeInTheDocument();
  });

  it('affiche "Non assigné" quand aucun responder n\'est assigné', () => {
    const unassigned = { ...mockIncident, assigned_to: null };
    render(<IncidentTable incidents={[unassigned]} teams={[mockTeam]} />);
    expect(screen.getByText('Non assigné')).toBeInTheDocument();
  });

  it('le lien pointe vers la bonne page de détail', () => {
    render(<IncidentTable incidents={[mockIncident]} teams={[mockTeam]} />);
    const link = screen.getByText('API de paiement instable').closest('a');
    expect(link).toHaveAttribute('href', '/incidents/inc-1');
  });
});