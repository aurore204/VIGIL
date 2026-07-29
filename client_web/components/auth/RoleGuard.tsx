import type { Team } from '@/lib/types';
import { useIsManager, useIsResponder } from '@/hooks/useTeamRole';

interface RoleGuardProps {
  team: Team | null;
  children: React.ReactNode;
}

export function ManagerOnly({ team, children }: RoleGuardProps) {
  const isManager = useIsManager(team);
  if (!isManager) return null;
  return <>{children}</>;
}

export function ResponderOnly({ team, children }: RoleGuardProps) {
  const isResponder = useIsResponder(team);
  if (!isResponder) return null;
  return <>{children}</>;
}