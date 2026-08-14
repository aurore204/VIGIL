import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/[locale]/auth/login/page';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const mockPush = jest.fn();
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ push: mockPush }),
}));

const mockShowToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    login: jest.fn(),
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, token: null });
  });

  it('affiche les champs email et mot de passe', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('login.emailPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('login.passwordPlaceholder')).toBeInTheDocument();
  });

  it("affiche une erreur si l'un des champs est vide", async () => {
    render(<LoginPage />);
    // Contourne la validation HTML "required" pour tester la logique métier
    const form = screen.getByPlaceholderText('login.emailPlaceholder').closest('form')!;
    form.setAttribute('novalidate', 'true');

    await userEvent.type(screen.getByPlaceholderText('login.emailPlaceholder'), 'test@test.com');
    // Laisse le password vide
    const submitButton = screen.getByRole('button');
    await userEvent.click(submitButton);

    expect(screen.getByText('login.errors.allFieldsRequired')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('appelle api.login puis setAuth et redirige vers /dashboard en cas de succès', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com', username: 'testuser', language: 'fr', created_at: '2026-01-01T00:00:00Z' };
    (api.login as jest.Mock).mockResolvedValue({ token: 'jwt-token', user: mockUser });

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('login.emailPlaceholder'), 'test@test.com');
    await userEvent.type(screen.getByPlaceholderText('login.passwordPlaceholder'), 'password123');
    await userEvent.click(screen.getByRole('button'));

    expect(api.login).toHaveBeenCalledWith('test@test.com', 'password123');
    expect(useAuthStore.getState().token).toBe('jwt-token');
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('affiche un message d\'erreur si la connexion échoue', async () => {
    (api.login as jest.Mock).mockRejectedValue(new Error('Email ou mot de passe incorrect'));

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('login.emailPlaceholder'), 'test@test.com');
    await userEvent.type(screen.getByPlaceholderText('login.passwordPlaceholder'), 'mauvais-password');
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('Email ou mot de passe incorrect')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('affiche un toast de succès après connexion', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com', username: 'testuser', language: 'fr', created_at: '2026-01-01T00:00:00Z' };
    (api.login as jest.Mock).mockResolvedValue({ token: 'jwt-token', user: mockUser });

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('login.emailPlaceholder'), 'test@test.com');
    await userEvent.type(screen.getByPlaceholderText('login.passwordPlaceholder'), 'password123');
    await userEvent.click(screen.getByRole('button'));

    expect(mockShowToast).toHaveBeenCalledWith('login.successToast', 'success');
  });

  it('rend un lien vers la page d\'inscription', () => {
    render(<LoginPage />);
    const link = screen.getByText('tabs.register').closest('a');
    expect(link).toHaveAttribute('href', '/auth/register');
  });
});