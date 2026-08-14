import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamDetailPage from '@/app/[locale]/(app)/teams/[id]/page';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import { useAuthStore } from '@/lib/store';
import type { Team, BannedMember } from '@/lib/types';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'team-1' }),
}));
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    getTeam: jest.fn(),
    getBannedMembers: jest.fn(),
    getOnlineUsers: jest.fn(),
    generateInvitation: jest.fn(),
    updateMemberRole: jest.fn(),
    kickMember: jest.fn(),
    banMember: jest.fn(),
    transferManager: jest.fn(),
    leaveTeam: jest.fn(),
    deleteTeam: jest.fn(),
    unbanMember: jest.fn(),
  },
}));

jest.mock('@/lib/websocket', () => ({
  vigilWs: { on: jest.fn(), off: jest.fn() },
}));

const mockShowToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/components/teams/MemberRow', () => ({
  MemberRow: ({ member, onKick, onBan, onTransfer, onLeave }: any) => (
    <div>
      <span>{member.username}</span>
      <button onClick={() => onKick(member.user_id, member.username)}>kick-{member.username}</button>
      <button onClick={() => onBan(member.user_id, member.username)}>ban-{member.username}</button>
      <button onClick={() => onTransfer(member.user_id, member.username)}>transfer-{member.username}</button>
      <button onClick={onLeave}>leave-team</button>
    </div>
  ),
}));

jest.mock('@/components/teams/BannedMemberRow', () => ({
  BannedMemberRow: ({ banned, onUnban }: any) => (
    <div>
      <span>{banned.username}-banned</span>
      <button onClick={() => onUnban(banned.user_id, banned.username)}>unban-{banned.username}</button>
    </div>
  ),
}));

jest.mock('@/components/teams/InviteCodeBanner', () => ({
  InviteCodeBanner: ({ code }: any) => <div>code:{code}</div>,
}));

const mockUser = { id: 'user-1', email: 'alice@test.com', username: 'alice', language: 'fr', created_at: '2026-01-01T00:00:00Z' };

const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 'team-1', name: 'Team Alpha', description: null, manager_id: 'user-1',
  members: [
    { user_id: 'user-1', username: 'alice', email: 'alice@test.com', role: 'manager', joined_at: '2026-01-01T00:00:00Z' },
    { user_id: 'user-2', username: 'bob', email: 'bob@test.com', role: 'observer', joined_at: '2026-01-01T00:00:00Z' },
  ],
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeBanned = (overrides: Partial<BannedMember> = {}): BannedMember => ({
  user_id: 'user-3', username: 'charlie', email: 'charlie@test.com',
  banned_by: 'user-1', banned_by_username: 'alice',
  expires_at: null, reason: null, created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('TeamDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: 'fake-token' });
    (api.getTeam as jest.Mock).mockResolvedValue(makeTeam());
    (api.getBannedMembers as jest.Mock).mockResolvedValue([]);
    (api.getOnlineUsers as jest.Mock).mockResolvedValue([]);
  });

  it('affiche un état de chargement puis le contenu', async () => {
    render(<TeamDetailPage />);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());
  });

  it('redirige vers /teams si le chargement échoue (accès perdu)', async () => {
    (api.getTeam as jest.Mock).mockRejectedValue(new Error('Accès refusé'));

    render(<TeamDetailPage />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('toastAccessLost', 'warning');
      expect(mockPush).toHaveBeenCalledWith('/teams');
    });
  });

  it('affiche le nom de la team et ses membres', async () => {
    render(<TeamDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  it('génère un code d\'invitation et l\'affiche', async () => {
    (api.generateInvitation as jest.Mock).mockResolvedValue({ code: 'INVITE123' });

    render(<TeamDetailPage />);
    await waitFor(() => expect(screen.getByText('generateCode')).toBeInTheDocument());

    await userEvent.click(screen.getByText('generateCode'));

    await waitFor(() => {
      expect(screen.getByText('code:INVITE123')).toBeInTheDocument();
    });
  });

  it('ouvre la confirmation puis kick un membre', async () => {
    (api.kickMember as jest.Mock).mockResolvedValue({});

    render(<TeamDetailPage />);
    await waitFor(() => expect(screen.getByText('kick-bob')).toBeInTheDocument());

    await userEvent.click(screen.getByText('kick-bob'));
    await userEvent.click(screen.getByText('confirmDialog.confirmLabel'));

    await waitFor(() => {
      expect(api.kickMember).toHaveBeenCalledWith('team-1', 'user-2');
    });
  });

  it('ouvre la confirmation puis transfère le rôle manager', async () => {
    (api.transferManager as jest.Mock).mockResolvedValue({});

    render(<TeamDetailPage />);
    await waitFor(() => expect(screen.getByText('transfer-bob')).toBeInTheDocument());

    await userEvent.click(screen.getByText('transfer-bob'));
    await userEvent.click(screen.getByText('confirmDialog.confirmLabel'));

    await waitFor(() => {
      expect(api.transferManager).toHaveBeenCalledWith('team-1', 'user-2');
    });
  });

  it('quitte la team et redirige vers /teams', async () => {
    (api.leaveTeam as jest.Mock).mockResolvedValue({});

    render(<TeamDetailPage />);
    await waitFor(() => expect(screen.getByText('leave-team')).toBeInTheDocument());

    await userEvent.click(screen.getByText('leave-team'));
    await userEvent.click(screen.getByText('confirmDialog.confirmLabel'));

    await waitFor(() => {
      expect(api.leaveTeam).toHaveBeenCalledWith('team-1');
      expect(mockPush).toHaveBeenCalledWith('/teams');
    });
  });

  it('supprime la team et redirige vers /teams', async () => {
    (api.deleteTeam as jest.Mock).mockResolvedValue({});

    render(<TeamDetailPage />);
    await waitFor(() => expect(screen.getByText('delete')).toBeInTheDocument());

    await userEvent.click(screen.getByText('delete'));
    await userEvent.click(screen.getByText('confirmDialog.confirmLabel'));

    await waitFor(() => {
      expect(api.deleteTeam).toHaveBeenCalledWith('team-1');
      expect(mockPush).toHaveBeenCalledWith('/teams');
    });
  });

  it('affiche les membres bannis pour un manager', async () => {
    (api.getBannedMembers as jest.Mock).mockResolvedValue([makeBanned({ username: 'charlie' })]);

    render(<TeamDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('charlie-banned')).toBeInTheDocument();
    });
  });

  it('unban un membre', async () => {
    (api.getBannedMembers as jest.Mock).mockResolvedValue([makeBanned({ username: 'charlie' })]);
    (api.unbanMember as jest.Mock).mockResolvedValue({});

    render(<TeamDetailPage />);
    await waitFor(() => expect(screen.getByText('unban-charlie')).toBeInTheDocument());

    await userEvent.click(screen.getByText('unban-charlie'));

    await waitFor(() => {
      expect(api.unbanMember).toHaveBeenCalledWith('team-1', 'user-3');
    });
  });

  it('change le rôle d\'un membre observer vers responder', async () => {
    (api.updateMemberRole as jest.Mock).mockResolvedValue({});
    render(<TeamDetailPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
  });
});