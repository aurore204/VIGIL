import { render, screen } from '@testing-library/react';
import { ManagerOnly, ResponderOnly } from '@/components/auth/RoleGuard';
import type { Team } from '@/lib/types';

const mockUseIsManager = jest.fn();
const mockUseIsResponder = jest.fn();

jest.mock('@/hooks/useTeamRole', () => ({
  useIsManager: (team: Team | null) => mockUseIsManager(team),
  useIsResponder: (team: Team | null) => mockUseIsResponder(team),
}));

describe('ManagerOnly', () => {
  beforeEach(() => {
    mockUseIsManager.mockReset();
  });

  it('affiche les enfants quand isManager est true', () => {
    mockUseIsManager.mockReturnValue(true);
    render(<ManagerOnly team={null}><span>contenu manager</span></ManagerOnly>);

    expect(screen.getByText('contenu manager')).toBeInTheDocument();
  });

  it("n'affiche rien quand isManager est false", () => {
    mockUseIsManager.mockReturnValue(false);
    render(<ManagerOnly team={null}><span>contenu manager</span></ManagerOnly>);

    expect(screen.queryByText('contenu manager')).not.toBeInTheDocument();
  });
});

describe('ResponderOnly', () => {
  beforeEach(() => {
    mockUseIsResponder.mockReset();
  });

  it('affiche les enfants quand isResponder est true', () => {
    mockUseIsResponder.mockReturnValue(true);
    render(<ResponderOnly team={null}><span>contenu responder</span></ResponderOnly>);

    expect(screen.getByText('contenu responder')).toBeInTheDocument();
  });

  it("n'affiche rien quand isResponder est false", () => {
    mockUseIsResponder.mockReturnValue(false);
    render(<ResponderOnly team={null}><span>contenu responder</span></ResponderOnly>);

    expect(screen.queryByText('contenu responder')).not.toBeInTheDocument();
  });
});