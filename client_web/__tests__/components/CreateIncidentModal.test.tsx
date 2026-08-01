import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { CreateIncidentModal } from '@/components/incidents/CreateIncidentModal';
import type { Team } from '@/lib/types';

const mockTeams: Team[] = [
  { id: 'team-1', name: 'DevOps', description: null, manager_id: 'user-1', members: [], created_at: '2026-01-01' },
];

describe('CreateIncidentModal', () => {
  it('le bouton submit est présent et le formulaire a les champs requis', () => {
    renderWithProviders(<CreateIncidentModal teams={mockTeams} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Titre')).toBeInTheDocument();
    expect(screen.getByText('Sévérité')).toBeInTheDocument();
  });

  it('appelle onClose au clic sur Annuler', () => {
    const handleClose = jest.fn();
    renderWithProviders(<CreateIncidentModal teams={mockTeams} onClose={handleClose} onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText('Annuler'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('n\'appelle pas onSubmit si le titre est vide', () => {
    const handleSubmit = jest.fn();
    renderWithProviders(<CreateIncidentModal teams={mockTeams} onClose={jest.fn()} onSubmit={handleSubmit} />);
    fireEvent.click(screen.getByText("Créer l'incident"));
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});