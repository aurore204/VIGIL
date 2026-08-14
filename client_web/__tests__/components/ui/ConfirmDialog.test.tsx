import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const defaultProps = {
  isOpen: true,
  title: 'Confirmer',
  description: 'Êtes-vous sûr ?',
  confirmLabel: 'Confirmer',
  cancelLabel: 'Annuler',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('ConfirmDialog', () => {
  it("n'affiche rien quand isOpen est false", () => {
    const { container } = render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le titre et la description', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirmer')).toBeInTheDocument();
    expect(screen.getByText('Êtes-vous sûr ?')).toBeInTheDocument();
  });

  it('le bouton confirmer est en style danger', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const confirmBtn = buttons.find(b => b.textContent === 'Confirmer');
    expect(confirmBtn).toHaveStyle({ background: 'oklch(0.55 0.18 25)' });
  });

  it('appelle onConfirm au clic sur le bouton de confirmation', async () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    const buttons = screen.getAllByRole('button');
    const confirmBtn = buttons.find(b => b.textContent === 'Confirmer');
    await userEvent.click(confirmBtn!);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('appelle onCancel au clic sur le bouton annuler', async () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    const buttons = screen.getAllByRole('button');
    const cancelBtn = buttons.find(b => b.textContent === 'Annuler');
    await userEvent.click(cancelBtn!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});