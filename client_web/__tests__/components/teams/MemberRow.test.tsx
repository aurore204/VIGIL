import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberRow } from '@/components/teams/MemberRow';
import type { TeamMember } from '@/lib/types';

jest.mock('@/components/ui/Badge', () => ({
  RoleBadge: ({ role }: { role: string }) => <span>{role}</span>,
}));

const makeMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  user_id: 'user-1',
  username: 'alice',
  email: 'alice@test.com',
  role: 'observer',
  joined_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const baseProps = {
  member: makeMember(),
  isMe: false,
  isManager: false,
  isTargetManager: false,
  isOnline: false,
  onRoleChange: jest.fn(),
  onKick: jest.fn(),
  onBan: jest.fn(),
  onTransfer: jest.fn(),
  onLeave: jest.fn(),
};

describe('MemberRow', () => {
  it("affiche le nom d'utilisateur et l'email", () => {
    render(<MemberRow {...baseProps} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('affiche "you" quand isMe est true', () => {
    render(<MemberRow {...baseProps} isMe />);
    expect(screen.getByText('you')).toBeInTheDocument();
  });

  it('affiche "online" quand isOnline est true', () => {
    render(<MemberRow {...baseProps} isOnline />);
    expect(screen.getAllByText('online').length).toBeGreaterThan(0);
  });

  it('affiche "offline" quand isOnline est false', () => {
    render(<MemberRow {...baseProps} isOnline={false} />);
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it("n'affiche pas les actions de gestion si l'observateur courant n'est pas manager", () => {
    render(<MemberRow {...baseProps} isManager={false} />);
    expect(screen.queryByText('kick')).not.toBeInTheDocument();
  });

  it('affiche les actions de gestion quand isManager est true et la cible n\'est ni soi-même ni le manager', () => {
    render(<MemberRow {...baseProps} isManager isMe={false} isTargetManager={false} />);
    expect(screen.getByText('kick')).toBeInTheDocument();
    expect(screen.getByText('ban')).toBeInTheDocument();
    expect(screen.getByText('transfer')).toBeInTheDocument();
  });

  it("n'affiche pas les actions de gestion sur soi-même, même en tant que manager", () => {
    render(<MemberRow {...baseProps} isManager isMe />);
    expect(screen.queryByText('kick')).not.toBeInTheDocument();
  });

  it("n'affiche pas les actions de gestion sur un autre manager", () => {
    render(<MemberRow {...baseProps} isManager isTargetManager />);
    expect(screen.queryByText('kick')).not.toBeInTheDocument();
  });

  it('affiche "makeResponder" pour un observer', () => {
    render(<MemberRow {...baseProps} isManager member={makeMember({ role: 'observer' })} />);
    expect(screen.getByText('makeResponder')).toBeInTheDocument();
  });

  it('affiche "makeObserver" pour un responder', () => {
    render(<MemberRow {...baseProps} isManager member={makeMember({ role: 'responder' })} />);
    expect(screen.getByText('makeObserver')).toBeInTheDocument();
  });

  it('appelle onKick avec le bon user_id et username', async () => {
    const onKick = jest.fn();
    render(<MemberRow {...baseProps} isManager onKick={onKick} />);
    await userEvent.click(screen.getByText('kick'));
    expect(onKick).toHaveBeenCalledWith('user-1', 'alice');
  });

  it('appelle onBan avec le bon user_id et username', async () => {
    const onBan = jest.fn();
    render(<MemberRow {...baseProps} isManager onBan={onBan} />);
    await userEvent.click(screen.getByText('ban'));
    expect(onBan).toHaveBeenCalledWith('user-1', 'alice');
  });

  it('appelle onTransfer avec le bon user_id et username', async () => {
    const onTransfer = jest.fn();
    render(<MemberRow {...baseProps} isManager onTransfer={onTransfer} />);
    await userEvent.click(screen.getByText('transfer'));
    expect(onTransfer).toHaveBeenCalledWith('user-1', 'alice');
  });

  it('appelle onRoleChange avec le user_id et le rôle actuel', async () => {
    const onRoleChange = jest.fn();
    render(<MemberRow {...baseProps} isManager onRoleChange={onRoleChange} member={makeMember({ role: 'observer' })} />);
    await userEvent.click(screen.getByText('makeResponder'));
    expect(onRoleChange).toHaveBeenCalledWith('user-1', 'observer');
  });

  it('affiche le bouton "leave" pour soi-même quand on n\'est pas manager', () => {
    render(<MemberRow {...baseProps} isManager={false} isMe />);
    expect(screen.getByText('leave')).toBeInTheDocument();
  });

  it('appelle onLeave au clic sur "leave"', async () => {
    const onLeave = jest.fn();
    render(<MemberRow {...baseProps} isManager={false} isMe onLeave={onLeave} />);
    await userEvent.click(screen.getByText('leave'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('affiche le badge de rôle', () => {
    render(<MemberRow {...baseProps} member={makeMember({ role: 'responder' })} />);
    expect(screen.getByText('responder')).toBeInTheDocument();
  });
});