import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateReleaseModal } from '@/components/releases/CreateReleaseModal';
import type { Team } from '@/lib/types';

jest.mock('@/components/shared/Modal');

const teams: Team[] = [
  { id: 'team-1', name: 'Team Alpha', description: null, manager_id: 'u1', members: [], created_at: '2026-01-01T00:00:00Z' },
];

describe('CreateReleaseModal', () => {
  it('affiche une étape vide par défaut', () => {
    render(<CreateReleaseModal teams={teams} onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(screen.getByText('stepsEmpty')).toBeInTheDocument();
  });

  it('ajoute une nouvelle étape au clic sur addStep', async () => {
    render(<CreateReleaseModal teams={teams} onClose={jest.fn()} onSubmit={jest.fn()} />);

    const inputsBefore = screen.getAllByPlaceholderText(/stepPlaceholder/);
    await userEvent.click(screen.getByText('addStep'));
    const inputsAfter = screen.getAllByPlaceholderText(/stepPlaceholder/);

    expect(inputsAfter.length).toBe(inputsBefore.length + 1);
  });

  it('appelle onSubmit avec les étapes nettoyées', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<CreateReleaseModal teams={teams} onClose={jest.fn()} onSubmit={onSubmit} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'team-1');
    const textInputs = screen.getAllByRole('textbox');
    await userEvent.type(textInputs[0], 'Release v1');
    await userEvent.type(screen.getByPlaceholderText(/stepPlaceholder 1/), 'build');
    await userEvent.click(screen.getByText('submit'));

    expect(onSubmit).toHaveBeenCalledWith('team-1', 'Release v1', ['build'], undefined);
  });

  it('appelle onClose au clic sur annuler', async () => {
    const onClose = jest.fn();
    render(<CreateReleaseModal teams={teams} onClose={onClose} onSubmit={jest.fn()} />);

    await userEvent.click(screen.getByText('cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});