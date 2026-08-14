import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '@/app/[locale]/(app)/profile/page';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const mockReplace = jest.fn();
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/profile',
}));

const mockShowToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    updateProfile: jest.fn(),
  },
}));

const mockUser = {
  id: 'user-1', email: 'alice@test.com', username: 'alice',
  language: 'fr', created_at: '2026-01-01T00:00:00Z',
};

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: 'fake-token' });
  });

  it('affiche un état de chargement si aucun utilisateur n\'est chargé', () => {
    useAuthStore.setState({ user: null, token: null });
    render(<ProfilePage />);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('pré-remplit les champs avec les valeurs actuelles de l\'utilisateur', () => {
    render(<ProfilePage />);
    expect(screen.getByDisplayValue('alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice@test.com')).toBeInTheDocument();
  });

  it('ne soumet rien si aucun champ n\'a changé', async () => {
    render(<ProfilePage />);

    await userEvent.click(screen.getByText('submit'));

    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('envoie uniquement le username modifié', async () => {
    (api.updateProfile as jest.Mock).mockResolvedValue({ ...mockUser, username: 'alice2' });
    render(<ProfilePage />);

    const usernameInput = screen.getByDisplayValue('alice');
    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, 'alice2');
    await userEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(api.updateProfile).toHaveBeenCalledWith({ username: 'alice2' });
    });
  });

  it('affiche une erreur si les nouveaux mots de passe ne correspondent pas', async () => {
    render(<ProfilePage />);

    await userEvent.type(screen.getByLabelText('newPasswordLabel'), 'nouveau123');
    await userEvent.type(screen.getByLabelText('confirmPasswordLabel'), 'different456');
    await userEvent.click(screen.getByText('submit'));

    expect(mockShowToast).toHaveBeenCalledWith('passwordMismatch', 'error');
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('envoie current_password et new_password quand un nouveau mot de passe est fourni', async () => {
    (api.updateProfile as jest.Mock).mockResolvedValue(mockUser);
    render(<ProfilePage />);

    await userEvent.type(screen.getByLabelText('currentPasswordLabel'), 'ancien123');
    await userEvent.type(screen.getByLabelText('newPasswordLabel'), 'nouveau456');
    await userEvent.type(screen.getByLabelText('confirmPasswordLabel'), 'nouveau456');
    await userEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(api.updateProfile).toHaveBeenCalledWith({
        current_password: 'ancien123',
        new_password: 'nouveau456',
      });
    });
  });

  it('affiche un toast de succès et vide les champs mot de passe après mise à jour', async () => {
    (api.updateProfile as jest.Mock).mockResolvedValue(mockUser);
    render(<ProfilePage />);

    await userEvent.type(screen.getByLabelText('newPasswordLabel'), 'nouveau456');
    await userEvent.type(screen.getByLabelText('confirmPasswordLabel'), 'nouveau456');
    await userEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('toastSuccess', 'success');
    });
    expect(screen.getByLabelText('newPasswordLabel')).toHaveValue('');
  });

  it('affiche un toast spécifique quand l\'email est déjà utilisé', async () => {
    (api.updateProfile as jest.Mock).mockRejectedValue(new Error('EMAIL_ALREADY_EXISTS'));
    render(<ProfilePage />);

    const emailInput = screen.getByDisplayValue('alice@test.com');
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'nouveau@test.com');
    await userEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('toastEmailTaken', 'error');
    });
  });

  it('affiche un toast spécifique quand le mot de passe actuel est invalide', async () => {
    (api.updateProfile as jest.Mock).mockRejectedValue(new Error('INVALID_CURRENT_PASSWORD'));
    render(<ProfilePage />);

    await userEvent.type(screen.getByLabelText('currentPasswordLabel'), 'mauvais');
    await userEvent.type(screen.getByLabelText('newPasswordLabel'), 'nouveau456');
    await userEvent.type(screen.getByLabelText('confirmPasswordLabel'), 'nouveau456');
    await userEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('toastInvalidCurrentPassword', 'error');
    });
  });

  it('affiche un toast générique pour une erreur non reconnue', async () => {
    (api.updateProfile as jest.Mock).mockRejectedValue(new Error('Erreur inconnue'));
    render(<ProfilePage />);

    const usernameInput = screen.getByDisplayValue('alice');
    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, 'nouveauNom');
    await userEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Erreur inconnue', 'error');
    });
  });

  it('change la langue au clic sur EN et redirige avec la nouvelle locale', async () => {
    (api.updateProfile as jest.Mock).mockResolvedValue({ ...mockUser, language: 'en' });
    render(<ProfilePage />);

    await userEvent.click(screen.getByText('languageEn'));

    await waitFor(() => {
      expect(api.updateProfile).toHaveBeenCalledWith({ language: 'en' });
      expect(mockReplace).toHaveBeenCalledWith('/profile', { locale: 'en' });
    });
  });

  it('ne fait rien si on clique sur la langue déjà active', async () => {
    render(<ProfilePage />);

    await userEvent.click(screen.getByText('languageFr'));

    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('affiche un toast de succès après changement de langue', async () => {
    (api.updateProfile as jest.Mock).mockResolvedValue({ ...mockUser, language: 'en' });
    render(<ProfilePage />);

    await userEvent.click(screen.getByText('languageEn'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('toastLanguageUpdated', 'success');
    });
  });
});