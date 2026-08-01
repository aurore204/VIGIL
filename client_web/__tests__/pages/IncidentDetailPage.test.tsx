import { render, screen, waitFor } from '@testing-library/react';
import IncidentDetailPage from '@/app/(app)/incidents/[id]/page';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { renderWithProviders } from '../test-utils';

// Mocks Next.js navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'inc-1' }),
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock du store d'auth
jest.mock('@/lib/store', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/websocket', () => ({
  vigilWs: {
    on: jest.fn(),
    off: jest.fn(),
    watch: jest.fn(),
    unwatch: jest.fn(),
  },
}));

// Mock de l'API
jest.mock('@/lib/api', () => ({
  api: {
    getIncident: jest.fn(),
    getTeam: jest.fn(),
    getAvailableReactions: jest.fn(),
  },
}));

const mockIncident = {
  id: 'inc-1', team_id: 'team-1', created_by: 'user-1', assigned_to: null,
  title: 'Incident de test', description: null, state: 'open' as const, severity: 'medium' as const,
  timeline: [], resolved_at: null, created_at: '2026-01-01', updated_at: '2026-01-01',
};

function mockTeamWithRole(role: 'observer' | 'responder' | 'manager') {
  return {
    id: 'team-1', name: 'Team Test', description: null, manager_id: 'user-999',
    members: [{ user_id: 'user-1', username: 'moi', email: 'm@m.com', role, joined_at: '2026-01-01' }],
    created_at: '2026-01-01',
  };
}

describe('IncidentDetailPage — permissions par rôle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getAvailableReactions as jest.Mock).mockResolvedValue(['+1', 'fire']);
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { id: 'user-1', username: 'moi' } });
  });

  it('un Observer ne voit aucun bouton d\'action', async () => {
    (api.getIncident as jest.Mock).mockResolvedValue(mockIncident);
    (api.getTeam as jest.Mock).mockResolvedValue(mockTeamWithRole('observer'));

    renderWithProviders(<IncidentDetailPage />);

    await waitFor(() => expect(screen.getByText('Incident de test')).toBeInTheDocument());

    expect(screen.queryByText('Acquitter')).not.toBeInTheDocument();
    expect(screen.queryByText('Résoudre')).not.toBeInTheDocument();
    expect(screen.getByText('Aucune action disponible')).toBeInTheDocument();
  });

  it('un Responder voit "Acquitter" mais pas "Résoudre" ni "Modifier"', async () => {
    (api.getIncident as jest.Mock).mockResolvedValue(mockIncident);
    (api.getTeam as jest.Mock).mockResolvedValue(mockTeamWithRole('responder'));

    renderWithProviders(<IncidentDetailPage />);

    await waitFor(() => expect(screen.getByText('Acquitter')).toBeInTheDocument());

    expect(screen.queryByText('Résoudre')).not.toBeInTheDocument();
    expect(screen.queryByText("Modifier l'incident")).not.toBeInTheDocument();
    expect(screen.queryByText("Supprimer l'incident")).not.toBeInTheDocument();
  });

  it('un Manager voit toutes les actions disponibles pour un incident open', async () => {
    (api.getIncident as jest.Mock).mockResolvedValue(mockIncident);
    (api.getTeam as jest.Mock).mockResolvedValue(mockTeamWithRole('manager'));

    renderWithProviders(<IncidentDetailPage />);

    await waitFor(() => expect(screen.getByText('Acquitter')).toBeInTheDocument());

    expect(screen.getByText('Assigner un intervenant')).toBeInTheDocument();
    expect(screen.getByText("Modifier l'incident")).toBeInTheDocument();
    expect(screen.getByText("Supprimer l'incident")).toBeInTheDocument();
    // Résoudre n'apparaît pas tant que l'incident est encore "open" (doit être acquitté d'abord)
    expect(screen.queryByText('Résoudre')).not.toBeInTheDocument();
  });

  it('le Manager voit "Résoudre" une fois l\'incident acknowledged', async () => {
    const acknowledgedIncident = { ...mockIncident, state: 'acknowledged' as const };
    (api.getIncident as jest.Mock).mockResolvedValue(acknowledgedIncident);
    (api.getTeam as jest.Mock).mockResolvedValue(mockTeamWithRole('manager'));

    renderWithProviders(<IncidentDetailPage />);

    await waitFor(() => expect(screen.getByText('Résoudre')).toBeInTheDocument());
  });
});