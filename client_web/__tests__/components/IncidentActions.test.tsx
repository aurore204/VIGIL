import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentActions } from '@/components/incidents/IncidentActions';
import type { Incident } from '@/lib/types';

const mockIncident: Incident = {
  id: 'inc-1', team_id: 'team-1', created_by: 'user-1', assigned_to: null,
  title: 'Test incident', description: null, state: 'open', severity: 'medium',
  timeline: [], resolved_at: null, created_at: '2026-01-01', updated_at: '2026-01-01',
};

const noop = () => {};

describe('IncidentActions', () => {
  it('affiche "Acquitter" quand canAcknowledge est vrai', () => {
    render(
      <IncidentActions
        incident={mockIncident}
        canAcknowledge canEscalate={false} canResolve={false} canAssign={false} canEdit={false} canDelete={false}
        onAcknowledge={noop} onEscalate={noop} onResolve={noop} onAssign={noop} onEdit={noop} onDelete={noop}
      />
    );
    expect(screen.getByText('Acquitter')).toBeInTheDocument();
  });

  it('n\'affiche PAS "Résoudre" pour un Observer/Responder sans droit (canResolve=false)', () => {
    render(
      <IncidentActions
        incident={mockIncident}
        canAcknowledge canEscalate canResolve={false} canAssign={false} canEdit={false} canDelete={false}
        onAcknowledge={noop} onEscalate={noop} onResolve={noop} onAssign={noop} onEdit={noop} onDelete={noop}
      />
    );
    expect(screen.queryByText('Résoudre')).not.toBeInTheDocument();
  });

  it('affiche "Aucune action disponible" pour un Observer pur', () => {
    render(
      <IncidentActions
        incident={mockIncident}
        canAcknowledge={false} canEscalate={false} canResolve={false} canAssign={false} canEdit={false} canDelete={false}
        onAcknowledge={noop} onEscalate={noop} onResolve={noop} onAssign={noop} onEdit={noop} onDelete={noop}
      />
    );
    expect(screen.getByText('Aucune action disponible')).toBeInTheDocument();
  });

  it('appelle onAcknowledge au clic sur Acquitter', () => {
    const handleAcknowledge = jest.fn();
    render(
      <IncidentActions
        incident={mockIncident}
        canAcknowledge canEscalate={false} canResolve={false} canAssign={false} canEdit={false} canDelete={false}
        onAcknowledge={handleAcknowledge} onEscalate={noop} onResolve={noop} onAssign={noop} onEdit={noop} onDelete={noop}
      />
    );
    fireEvent.click(screen.getByText('Acquitter'));
    expect(handleAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('demande confirmation avant de supprimer (pas de suppression directe — anti dark pattern)', () => {
    const handleDelete = jest.fn();
    render(
      <IncidentActions
        incident={mockIncident}
        canAcknowledge={false} canEscalate={false} canResolve={false} canAssign={false} canEdit={false} canDelete
        onAcknowledge={noop} onEscalate={noop} onResolve={noop} onAssign={noop} onEdit={noop} onDelete={handleDelete}
      />
    );
    fireEvent.click(screen.getByText("Supprimer l'incident"));
    // onDelete ne doit PAS être appelé immédiatement, il faut confirmer dans le dialog
    expect(handleDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/Supprimer définitivement/)).toBeInTheDocument();
  });
});