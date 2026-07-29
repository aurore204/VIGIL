import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('affiche le label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('le label est associé au champ via htmlFor', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
  });

  it('affiche le message d erreur', () => {
    render(<Input label="Email" error="Email invalide" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email invalide');
  });

  it('applique la bordure danger en cas d erreur', () => {
    render(<Input label="Email" error="Requis" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveClass('border-danger');
  });

  it('affiche le hint quand pas d erreur', () => {
    render(<Input label="Email" hint="Format: user@example.com" />);
    expect(screen.getByText('Format: user@example.com')).toBeInTheDocument();
  });

  it('affiche indicateur obligatoire si required', () => {
    render(<Input label="Email" required />);
    expect(screen.getByLabelText('champ obligatoire')).toBeInTheDocument();
  });

  it('accepte la saisie utilisateur', async () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    await userEvent.type(input, 'test@test.com');
    expect(input).toHaveValue('test@test.com');
  });
});