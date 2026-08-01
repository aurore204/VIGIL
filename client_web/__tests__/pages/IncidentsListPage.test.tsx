import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import IncidentsPage from '@/app/(app)/incidents/page';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

jest.mock('@/lib/store', () => ({ useAuthStore: jest.fn() }));
jest.mock('@/lib/websocket', () => ({
  vigilWs: { on: jest.fn(), off: jest.fn(), watch: jest.fn(), unwatch: jest.fn() },
}));
jest.mock('@/lib/api', () => ({
  api: {
    getTeams: jest.fn(),
    getIncidents: jest.fn(),
    getOnlineUsers: jest.fn(),
  },
}));

const mockTeam = {
  id: 'team-1', name: 'DevOps', description: null, manager_id: 'user-1',
  members: [{ user_id: 'user-1', username: 'moi', email: 'm@m.com', role: 'manager' as const, joined_at: '2026-01-01' }],
  created_at: '2026-01-01',
};

const mockIncidents = [
  { id: 'inc-1', team_id: 'team-1', created_by: 'user-1', assigned_to: null, title: 'Incident critique', description: null, state: 'open' as const, severity: 'critical' as const, timeline: [], resolved_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'inc-2', team_id: 'team-1', created_by: 'user-1', assigned_to: null, title: 'Incident résolu', description: null, state: 'resolved' as const, severity: 'low' as const, timeline: [], resolved_at: '2026-01-02', created_at: '2026-01-01', updated_at: '2026-01-02' },
];

describe('IncidentsPage (liste)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { id: 'user-1', username: 'moi' } });
    (api.getOnlineUsers as jest.Mock).mockResolvedValue(['moi']);
    (api.getTeams as jest.Mock).mockResolvedValue([mockTeam]);
    (api.getIncidents as jest.Mock).mockResolvedValue(mockIncidents);
  });

  it('affiche tous les incidents chargés', async () => {
    renderWithProviders(<IncidentsPage />);
    await waitFor(() => expect(screen.getByText('Incident critique')).toBeInTheDocument());
    expect(screen.getByText('Incident résolu')).toBeInTheDocument();
  });

  it.skip('affiche le compteur incidents actifs correctement (résolu exclu)', async () => {
    renderWithProviders(<IncidentsPage />);
    await waitFor(() => {
      expect(screen.getByText((_, element) => element?.textContent === '2 incidents · 1 actif')).toBeInTheDocument();
    });
  });

  it('le champ de recherche filtre par titre', async () => {
    renderWithProviders(<IncidentsPage />);
    await waitFor(() => expect(screen.getByText('Incident critique')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText("Titre de l'incident...");
    await userEvent.type(searchInput, 'résolu');

    expect(screen.queryByText('Incident critique')).not.toBeInTheDocument();
    expect(screen.getByText('Incident résolu')).toBeInTheDocument();
  });

  it('affiche le bouton "Créer un incident" seulement pour un Manager', async () => {
    renderWithProviders(<IncidentsPage />);
    await waitFor(() => expect(screen.getByText('+ Créer un incident')).toBeInTheDocument());
  });

  it('n\'affiche PAS le bouton créer si l\'utilisateur n\'est Manager d\'aucune team', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      { ...mockTeam, manager_id: 'quelqu-un-dautre' },
    ]);
    renderWithProviders(<IncidentsPage />);
    await waitFor(() => expect(screen.getByText('Incident critique')).toBeInTheDocument());
    expect(screen.queryByText('+ Créer un incident')).not.toBeInTheDocument();
  });
});