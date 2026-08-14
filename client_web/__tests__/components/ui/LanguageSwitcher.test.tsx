import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

let mockLocale = 'fr';

jest.mock('@/i18n/navigation', () => ({
  usePathname: () => '/dashboard',
  Link: ({ href, locale, children, onClick, ...props }: any) => (
    <a href={href} data-locale={locale} onClick={onClick} {...props}>{children}</a>
  ),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => mockLocale,
}));

jest.mock('@/lib/api', () => ({
  api: {
    updateProfile: jest.fn(),
  },
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    mockLocale = 'fr';
    jest.clearAllMocks();
    useAuthStore.setState({ token: 'un-token', user: null });
  });

  it('mode réduit : affiche uniquement l\'icône globe, pas de texte FR/EN', () => {
    render(<LanguageSwitcher collapsed />);
    expect(screen.queryByText('FR')).not.toBeInTheDocument();
    expect(screen.queryByText('EN')).not.toBeInTheDocument();
  });

  it('mode étendu : affiche FR et EN', () => {
    render(<LanguageSwitcher collapsed={false} />);
    expect(screen.getByText('FR')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it("le lien FR pointe vers la locale 'fr'", () => {
    render(<LanguageSwitcher collapsed={false} />);
    expect(screen.getByText('FR')).toHaveAttribute('data-locale', 'fr');
  });

  it("le lien EN pointe vers la locale 'en'", () => {
    render(<LanguageSwitcher collapsed={false} />);
    expect(screen.getByText('EN')).toHaveAttribute('data-locale', 'en');
  });

  it('appelle api.updateProfile avec la nouvelle langue au clic sur EN, quand un token existe', async () => {
    (api.updateProfile as jest.Mock).mockResolvedValue({ id: 'user-1', language: 'en' });
    render(<LanguageSwitcher collapsed={false} />);

    await userEvent.click(screen.getByText('EN'));

    expect(api.updateProfile).toHaveBeenCalledWith({ language: 'en' });
  });

  it("n'appelle pas api.updateProfile si aucun token n'est présent", async () => {
    useAuthStore.setState({ token: null, user: null });
    render(<LanguageSwitcher collapsed={false} />);

    await userEvent.click(screen.getByText('EN'));

    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it("n'échoue pas si l'appel API échoue", async () => {
    (api.updateProfile as jest.Mock).mockRejectedValue(new Error('erreur réseau'));
    render(<LanguageSwitcher collapsed={false} />);

    await expect(userEvent.click(screen.getByText('EN'))).resolves.not.toThrow();
  });
});