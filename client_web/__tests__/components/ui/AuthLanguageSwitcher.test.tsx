import { render, screen } from '@testing-library/react';
import AuthLanguageSwitcher from '@/components/ui/AuthLanguageSwitcher';

let mockLocale = 'fr';

jest.mock('@/i18n/navigation', () => ({
  usePathname: () => '/auth/login',
  Link: ({ href, locale, children, ...props }: any) => (
    <a href={href} data-locale={locale} {...props}>{children}</a>
  ),
}));

jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
}));

describe('AuthLanguageSwitcher', () => {
  beforeEach(() => {
    mockLocale = 'fr';
  });

  it('affiche FR et EN', () => {
    render(<AuthLanguageSwitcher />);
    expect(screen.getByText('FR')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it("le lien FR pointe vers la locale 'fr'", () => {
    render(<AuthLanguageSwitcher />);
    expect(screen.getByText('FR')).toHaveAttribute('data-locale', 'fr');
  });

  it("le lien EN pointe vers la locale 'en'", () => {
    render(<AuthLanguageSwitcher />);
    expect(screen.getByText('EN')).toHaveAttribute('data-locale', 'en');
  });

  it('met en évidence FR quand la locale courante est fr', () => {
    mockLocale = 'fr';
    render(<AuthLanguageSwitcher />);
    expect(screen.getByText('FR')).toHaveStyle({ background: 'oklch(0.28 0.05 255)' });
  });

  it('met en évidence EN quand la locale courante est en', () => {
    mockLocale = 'en';
    render(<AuthLanguageSwitcher />);
    expect(screen.getByText('EN')).toHaveStyle({ background: 'oklch(0.28 0.05 255)' });
  });
});