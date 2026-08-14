import { render, screen } from "@testing-library/react";
import { TeamCard } from "@/components/teams/TeamCard";
import type { Team } from "@/lib/types";

jest.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: "team-1",
  name: "Team Alpha",
  description: null,
  manager_id: "user-1",
  members: [
    {
      user_id: "user-1",
      username: "alice",
      email: "alice@test.com",
      role: "manager",
      joined_at: "2026-01-01T00:00:00Z",
    },
    {
      user_id: "user-2",
      username: "bob",
      email: "bob@test.com",
      role: "observer",
      joined_at: "2026-01-01T00:00:00Z",
    },
  ],
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("TeamCard", () => {
  it("affiche le nom de la team", () => {
    render(
      <TeamCard team={makeTeam()} activeIncidents={0} currentUserId="user-1" />,
    );
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
  });

  it("n'affiche pas de badge d'incidents actifs quand activeIncidents est 0", () => {
    render(
      <TeamCard team={makeTeam()} activeIncidents={0} currentUserId="user-1" />,
    );
    expect(screen.queryByText(/activeIncident/)).not.toBeInTheDocument();
  });

  it("affiche un badge d'incidents actifs quand activeIncidents > 0", () => {
    render(
      <TeamCard team={makeTeam()} activeIncidents={3} currentUserId="user-1" />,
    );
    expect(screen.getByText(/activeIncident/)).toBeInTheDocument();
  });

  it("affiche les initiales de chaque membre (max 5)", () => {
    const manyMembers = Array.from({ length: 7 }, (_, i) => ({
      user_id: `user-${i}`,
      username: `member${i}`,
      email: `m${i}@test.com`,
      role: "observer" as const,
      joined_at: "2026-01-01T00:00:00Z",
    }));
    render(
      <TeamCard
        team={makeTeam({ members: manyMembers })}
        activeIncidents={0}
        currentUserId="user-0"
      />,
    );

    // On vérifie juste qu'il n'y a pas plus de 5 avatars rendus
    const avatars = screen.getAllByTitle(/member/);
    expect(avatars.length).toBe(5);
  });

  it("rend un lien vers la page de détail de la team", () => {
    render(
      <TeamCard
        team={makeTeam({ id: "team-42" })}
        activeIncidents={0}
        currentUserId="user-1"
      />,
    );

    const link = screen.getByText("view").closest("a");
    expect(link).toHaveAttribute("href", "/teams/team-42");
  });
});
