import { render, screen } from "@testing-library/react";
import { IncidentInfo } from "@/components/incidents/IncidentInfo";
import type { Incident, Team } from "@/lib/types";

const makeIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "inc-1",
  team_id: "team-1",
  created_by: "user-1",
  assigned_to: null,
  title: "Incident test",
  description: null,
  state: "open",
  severity: "medium",
  timeline: [],
  resolved_at: null,
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-01T10:00:00Z",
  ...overrides,
});

const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: "team-1",
  name: "Team Alpha",
  description: null,
  manager_id: "user-1",
  members: [],
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("IncidentInfo", () => {
  it("affiche le nom de la team", () => {
    const team = makeTeam({ name: "Team Alpha" });
    render(<IncidentInfo incident={makeIncident()} team={team} />);

    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
  });

  it('affiche "-" quand team est null', () => {
    render(<IncidentInfo incident={makeIncident()} team={null} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("affiche le nom d'utilisateur de la personne assignée", () => {
    const team = makeTeam({
      members: [
        {
          user_id: "user-1",
          username: "bob",
          email: "bob@test.com",
          role: "responder",
          joined_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const incident = makeIncident({ assigned_to: "user-1" });

    render(<IncidentInfo incident={incident} team={team} />);

    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it('affiche "unassigned" quand aucun assigné', () => {
    render(
      <IncidentInfo
        incident={makeIncident({ assigned_to: null })}
        team={makeTeam()}
      />,
    );

    expect(screen.getByText("unassigned")).toBeInTheDocument();
  });

  it("n'affiche pas la date de résolution si l'incident n'est pas résolu", () => {
    render(
      <IncidentInfo
        incident={makeIncident({ resolved_at: null })}
        team={makeTeam()}
      />,
    );

    expect(screen.queryByText("resolvedAt")).not.toBeInTheDocument();
  });

  it("affiche la date de résolution si présente", () => {
    const incident = makeIncident({ resolved_at: "2026-01-02T14:30:00Z" });
    render(<IncidentInfo incident={incident} team={makeTeam()} />);

    expect(screen.getByText("resolvedAt")).toBeInTheDocument();
  });
});
