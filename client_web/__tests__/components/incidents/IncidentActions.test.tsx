import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentActions } from '@/components/incidents/IncidentActions';
import type { Incident } from '@/lib/types';

const incident: Incident = {
  id: 'inc-1', team_id: 'team-1', created_by: 'user-1', assigned_to: null,
  title: 'Incident test', description: null,
  state: 'open', severity: 'medium', timeline: [], resolved_at: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const baseProps = {
  incident,
  canAcknowledge: false,
  canEscalate: false,
  canResolve: false,
  canAssign: false,
  canEdit: false,
  canDelete: false,
  onAcknowledge: jest.fn(),
  onEscalate: jest.fn(),
  onResolve: jest.fn(),
  onAssign: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

describe('IncidentActions', () => {
  it('affiche le message "aucune action" quand tout est false', () => {
    render(<IncidentActions {...baseProps} />);

    expect(screen.getByText('noActions')).toBeInTheDocument();
  });

  it('affiche le bouton acknowledge quand canAcknowledge est true', () => {
    render(<IncidentActions {...baseProps} canAcknowledge />);

    expect(screen.getByText('acknowledge')).toBeInTheDocument();
  });

  it('appelle onAcknowledge au clic', async () => {
    const onAcknowledge = jest.fn();
    render(<IncidentActions {...baseProps} canAcknowledge onAcknowledge={onAcknowledge} />);

    await userEvent.click(screen.getByText('acknowledge'));

    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('ouvre une confirmation avant de résoudre, puis appelle onResolve', async () => {
    const onResolve = jest.fn();
    render(<IncidentActions {...baseProps} canResolve onResolve={onResolve} />);

    await userEvent.click(screen.getByText('resolve'));
    expect(screen.getByText('confirmResolveLabel')).toBeInTheDocument();

    await userEvent.click(screen.getByText('confirmResolveLabel'));
    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it('ouvre une confirmation avant de supprimer, puis appelle onDelete', async () => {
    const onDelete = jest.fn();
    render(<IncidentActions {...baseProps} canDelete onDelete={onDelete} />);

    await userEvent.click(screen.getByText('delete'));
    await userEvent.click(screen.getByText('confirmDeleteLabel'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});