import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const defaultProps = {
  isOpen: true,
  title: 'Confirmer',
  description: 'Êtes-vous sûr ?',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('ConfirmDialog', () => {
  it('ne rend rien si isOpen est faux', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Confirmer')).not.toBeInTheDocument();
  });

  it('appelle onCancel au clic sur le fond', async () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    const overlay = document.querySelector('[aria-hidden="true"]');
    await userEvent.click(overlay!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('le bouton confirmer est en style danger', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmBtn = screen.getByText('Confirmer', { selector: 'button' });
    expect(confirmBtn).toHaveStyle({ background: 'oklch(0.55 0.18 25)' });
  });

  it('accepte des labels personnalisés', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Supprimer définitivement" cancelLabel="Retour" />);
    expect(screen.getByText('Supprimer définitivement')).toBeInTheDocument();
    expect(screen.getByText('Retour')).toBeInTheDocument();
  });

  it('appelle onConfirm au clic sur le bouton de confirmation', async () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('Confirmer', { selector: 'button' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ferme au clavier avec Échap', async () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});