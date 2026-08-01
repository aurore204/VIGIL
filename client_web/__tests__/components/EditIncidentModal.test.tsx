import { render, screen, fireEvent } from '@testing-library/react';
import { EditIncidentModal } from '@/components/incidents/EditIncidentModal';
import type { Incident } from '@/lib/types';

const mockIncident: Incident = {
  id: 'inc-1', team_id: 'team-1', created_by: 'user-1', assigned_to: null,
  title: 'Titre initial', description: 'Description initiale', state: 'open', severity: 'medium',
  timeline: [], resolved_at: null, created_at: '2026-01-01', updated_at: '2026-01-01',
};

describe('EditIncidentModal', () => {
  it('pré-remplit les champs avec les valeurs actuelles de l\'incident', () => {
    render(<EditIncidentModal incident={mockIncident} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.getByDisplayValue('Titre initial')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Description initiale')).toBeInTheDocument();
  });

  it('appelle onSubmit avec les nouvelles valeurs', () => {
    const handleSubmit = jest.fn();
    render(<EditIncidentModal incident={mockIncident} onClose={jest.fn()} onSubmit={handleSubmit} />);

    const titleInput = screen.getByDisplayValue('Titre initial');
    fireEvent.change(titleInput, { target: { value: 'Titre modifié' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    expect(handleSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Titre modifié' }));
  });

  it('appelle onClose au clic sur Annuler', () => {
    const handleClose = jest.fn();
    render(<EditIncidentModal incident={mockIncident} onClose={handleClose} onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText('Annuler'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});