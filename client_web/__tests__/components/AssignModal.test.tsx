import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssignModal } from '@/components/shared/AssignModal';
import type { TeamMember } from '@/lib/types';

const mockResponders: TeamMember[] = [
  { user_id: 'user-1', username: 'aurore', email: 'a@a.com', role: 'responder', joined_at: '2026-01-01' },
  { user_id: 'user-2', username: 'ana', email: 'b@b.com', role: 'responder', joined_at: '2026-01-01' },
];

describe('AssignModal', () => {
  it('affiche la liste des responders disponibles', () => {
    render(<AssignModal responders={mockResponders} onClose={jest.fn()} onAssign={jest.fn()} />);
    expect(screen.getByText('aurore')).toBeInTheDocument();
    expect(screen.getByText('ana')).toBeInTheDocument();
  });

  it('le bouton de soumission est désactivé tant qu\'aucun responder n\'est sélectionné', () => {
    render(<AssignModal responders={mockResponders} onClose={jest.fn()} onAssign={jest.fn()} />);
    expect(screen.getByText('submit').closest('button')).toBeDisabled();
  });

  it('sélectionne un responder au clic, puis appelle onAssign avec son user_id au clic sur submit', async () => {
    const handleAssign = jest.fn().mockResolvedValue(undefined);
    render(<AssignModal responders={mockResponders} onClose={jest.fn()} onAssign={handleAssign} />);

    fireEvent.click(screen.getByText('aurore'));
    expect(screen.getByText('submit').closest('button')).toBeEnabled();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(handleAssign).toHaveBeenCalledWith('user-1'));
  });

  it('sélectionner un autre responder change bien la sélection (pas d\'accumulation)', async () => {
    const handleAssign = jest.fn().mockResolvedValue(undefined);
    render(<AssignModal responders={mockResponders} onClose={jest.fn()} onAssign={handleAssign} />);

    fireEvent.click(screen.getByText('aurore'));
    fireEvent.click(screen.getByText('ana'));
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(handleAssign).toHaveBeenCalledWith('user-2'));
    expect(handleAssign).not.toHaveBeenCalledWith('user-1');
  });

  it('appelle onClose au clic sur cancel', () => {
    const handleClose = jest.fn();
    render(<AssignModal responders={mockResponders} onClose={handleClose} onAssign={jest.fn()} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('affiche un message si aucun responder n\'est disponible', () => {
    render(<AssignModal responders={[]} onClose={jest.fn()} onAssign={jest.fn()} />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });
});