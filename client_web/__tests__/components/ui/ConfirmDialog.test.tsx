import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Supprimer la team',
    description: 'Cette action est irréversible.',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  it('affiche le titre et la description', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Supprimer la team')).toBeInTheDocument();
    expect(screen.getByText('Cette action est irréversible.')).toBeInTheDocument();
  });

  it('n est pas rendu quand isOpen est false', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Supprimer la team')).not.toBeInTheDocument();
  });

  it('appelle onConfirm au clic sur confirmer', async () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('Confirmer'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('appelle onCancel au clic sur annuler', async () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByText('Annuler'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('appelle onCancel avec la touche Escape', async () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('appelle onCancel au clic sur le fond', async () => {
  const onCancel = jest.fn();
  render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
  const overlay = document.querySelector('.absolute.inset-0.bg-black\\/60');
  await userEvent.click(overlay!);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

  it('le bouton confirmer est en style danger', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmBtn = screen.getByText('Confirmer');
    expect(confirmBtn.closest('button')).toHaveClass('bg-danger');
  });

  it('accepte des labels personnalisés', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Oui, supprimer"
        cancelLabel="Non, garder"
      />
    );
    expect(screen.getByText('Oui, supprimer')).toBeInTheDocument();
    expect(screen.getByText('Non, garder')).toBeInTheDocument();
  });
});