import { render, screen } from '@testing-library/react';
import { ReleaseCard } from '@/components/releases/ReleaseCard';
import type { Release } from '@/lib/types';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

jest.mock('@/components/ui/Badge', () => ({
  ReleaseStateBadge: ({ state }: { state: string }) => <span>{state}</span>,
}));

const makeRelease = (overrides: Partial<Release> = {}): Release => ({
  id: 'rel-1', team_id: 'team-1', created_by: 'user-1', title: 'Release v1.0', description: null,
  state: 'in_progress', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  steps: [
    { id: 's1', release_id: 'rel-1', name: 'build', description: null, position: 0, state: 'completed', validated_by: null, validated_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 's2', release_id: 'rel-1', name: 'production', description: null, position: 1, state: 'pending', validated_by: null, validated_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ],
  ...overrides,
});

describe('ReleaseCard', () => {
  it('affiche le titre de la release', () => {
    render(<ReleaseCard release={makeRelease()} teamName="Team Alpha" />);

    expect(screen.getByText('Release v1.0')).toBeInTheDocument();
  });

  it('affiche le nom de la team', () => {
    render(<ReleaseCard release={makeRelease()} teamName="Team Alpha" />);

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
  });

  it('affiche le compte des étapes validées', () => {
    render(<ReleaseCard release={makeRelease()} teamName="Team Alpha" />);

    expect(screen.getByText('1/2 steps')).toBeInTheDocument();
  });

  it('rend un lien vers la page de détail de la release', () => {
    render(<ReleaseCard release={makeRelease({ id: 'rel-42' })} teamName="Team Alpha" />);

    const link = screen.getByText('view').closest('a');
    expect(link).toHaveAttribute('href', '/releases/rel-42');
  });

  it('ne rend pas la barre de progression quand steps est vide', () => {
    render(<ReleaseCard release={makeRelease({ steps: [] })} teamName="Team Alpha" />);

    expect(screen.getByText('0/0 steps')).toBeInTheDocument();
  });
});