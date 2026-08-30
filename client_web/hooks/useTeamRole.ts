import { useAuthStore } from "@/lib/store";
import type { Team, TeamRole } from "@/lib/types";

export function useTeamRole(team: Team | null): TeamRole | null {
  const { user } = useAuthStore();
  if (!team || !user) return null;
  const member = team.members.find((m) => m.user_id === user.id);
  return member?.role ?? null;
}

export function useIsManager(team: Team | null): boolean {
  return useTeamRole(team) === "manager";
}

export function useIsResponder(team: Team | null): boolean {
  const role = useTeamRole(team);
  return role === "responder" || role === "manager";
}

export function useIsObserver(team: Team | null): boolean {
  return useTeamRole(team) === "observer";
}
