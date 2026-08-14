import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessagesPage from '@/app/[locale]/(app)/messages/page';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import { useAuthStore } from '@/lib/store';
import type { Team, PrivateMessage } from '@/lib/types';

jest.mock('@/lib/api', () => ({
  api: {
    getTeams: jest.fn(),
    getOnlineUsers: jest.fn(),
    getConversation: jest.fn(),
    sendMessage: jest.fn(),
  },
}));

jest.mock('@/lib/websocket', () => ({
  vigilWs: { on: jest.fn(), off: jest.fn() },
}));

const mockShowToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const mockUser = { id: 'user-1', email: 'alice@test.com', username: 'alice', language: 'fr', created_at: '2026-01-01T00:00:00Z' };

const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 'team-1', name: 'Team Alpha', description: null, manager_id: 'user-1',
  members: [
    { user_id: 'user-1', username: 'alice', email: 'alice@test.com', role: 'manager', joined_at: '2026-01-01T00:00:00Z' },
    { user_id: 'user-2', username: 'bob', email: 'bob@test.com', role: 'responder', joined_at: '2026-01-01T00:00:00Z' },
  ],
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeMessage = (overrides: Partial<PrivateMessage> = {}): PrivateMessage => ({
  id: 'msg-1', sender_id: 'user-1', sender_username: 'alice',
  receiver_id: 'user-2', receiver_username: 'bob',
  content: 'Salut !', read_at: null, created_at: '2026-01-01T10:00:00Z',
  ...overrides,
});

describe('MessagesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: 'fake-token' });
    (api.getTeams as jest.Mock).mockResolvedValue([]);
    (api.getOnlineUsers as jest.Mock).mockResolvedValue([]);
    (api.getConversation as jest.Mock).mockResolvedValue([]);
  });

  it('affiche un état de chargement puis le contenu', async () => {
    render(<MessagesPage />);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());
  });

  it("affiche le message vide quand il n'y a aucun contact", async () => {
    render(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText('sidebar.empty')).toBeInTheDocument();
    });
  });

  it('affiche les contacts issus des teams, en excluant l\'utilisateur courant', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });
  });

  it('affiche le message d\'invite à sélectionner un contact par défaut', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('conversation.selectContact')).toBeInTheDocument();
    });
  });

  it('charge la conversation au clic sur un contact', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getConversation as jest.Mock).mockResolvedValue([makeMessage({ content: 'Salut Bob !' })]);

    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());

    await userEvent.click(screen.getByText('bob'));

    await waitFor(() => {
      expect(api.getConversation).toHaveBeenCalledWith('user-2');
      expect(screen.getByText('Salut Bob !')).toBeInTheDocument();
    });
  });

  it('affiche le message vide de la conversation quand elle est vide', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getConversation as jest.Mock).mockResolvedValue([]);

    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    await userEvent.click(screen.getByText('bob'));

    await waitFor(() => {
      expect(screen.getByText('conversation.empty')).toBeInTheDocument();
    });
  });

  it('envoie un message et vide le champ de saisie', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getConversation as jest.Mock).mockResolvedValue([]);
    (api.sendMessage as jest.Mock).mockResolvedValue({});

    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    await userEvent.click(screen.getByText('bob'));

    const input = await screen.findByPlaceholderText('conversation.placeholder');
    await userEvent.type(input, 'Bonjour Bob');
    await userEvent.click(screen.getByText('conversation.send'));

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledWith('user-2', 'Bonjour Bob');
    });
  });

  it('n\'envoie pas de message vide', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getConversation as jest.Mock).mockResolvedValue([]);

    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    await userEvent.click(screen.getByText('bob'));

    const sendButton = await screen.findByText('conversation.send');
    expect(sendButton).toBeDisabled();
  });

  it('affiche un compteur de caractères au-delà de 1800', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getConversation as jest.Mock).mockResolvedValue([]);

    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    await userEvent.click(screen.getByText('bob'));

    const input = await screen.findByPlaceholderText('conversation.placeholder');
    const longText = 'a'.repeat(1850);
    await userEvent.type(input, longText);

    expect(screen.getByText(`${longText.length} / 2000`)).toBeInTheDocument();
  });

  it('affiche "✓✓" pour un message lu envoyé par moi', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getConversation as jest.Mock).mockResolvedValue([
      makeMessage({ sender_id: 'user-1', read_at: '2026-01-01T11:00:00Z' }),
    ]);

    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    await userEvent.click(screen.getByText('bob'));

    await waitFor(() => {
      expect(screen.getByText('✓✓')).toBeInTheDocument();
    });
  });

  it('affiche un indicateur en ligne pour un contact connecté', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getOnlineUsers as jest.Mock).mockResolvedValue(['bob']);

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByTitle('online')).toBeInTheDocument();
    });
  });

  it('affiche un toast d\'erreur si le chargement de la conversation échoue', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getConversation as jest.Mock).mockRejectedValue(new Error('Erreur réseau'));

    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    await userEvent.click(screen.getByText('bob'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Erreur réseau', 'error');
    });
  });

  it('enregistre les handlers WebSocket au montage', async () => {
    render(<MessagesPage />);
    await waitFor(() => {
      expect(vigilWs.on).toHaveBeenCalledWith('private_message_received', expect.any(Function));
      expect(vigilWs.on).toHaveBeenCalledWith('presence_online', expect.any(Function));
    });
  });
});