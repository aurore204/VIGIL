import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('affiche le texte', () => {
    render(<Button>Confirmer</Button>);
    expect(screen.getByText('Confirmer')).toBeInTheDocument();
  });

  it('appelle onClick au clic', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Cliquer</Button>);
    await userEvent.click(screen.getByText('Cliquer'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('est désactivé quand disabled est true', () => {
    render(<Button disabled>Désactivé</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('est désactivé quand loading est true', () => {
    render(<Button loading>Chargement</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applique le style danger', () => {
    render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-danger');
  });

  it('applique le style secondary', () => {
    render(<Button variant="secondary">Annuler</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface-raised');
  });

  it('ne déclenche pas onClick quand disabled', async () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Désactivé</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});