import { render, screen } from "@testing-library/react";
import { StepList } from "@/components/releases/StepList";
import type { ReleaseStep, TeamMember } from "@/lib/types";

const makeStep = (overrides: Partial<ReleaseStep> = {}): ReleaseStep => ({
  id: "step-1",
  release_id: "rel-1",
  name: "build",
  description: null,
  position: 0,
  state: "pending",
  validated_by: null,
  validated_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  user_id: "user-1",
  username: "alice",
  email: "alice@test.com",
  role: "responder",
  joined_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("StepList", () => {
  it("affiche le nom de chaque étape", () => {
    const steps = [
      makeStep({ id: "1", name: "build" }),
      makeStep({ id: "2", name: "staging" }),
    ];
    render(<StepList steps={steps} members={[]} />);

    expect(screen.getByText("build")).toBeInTheDocument();
    expect(screen.getByText("staging")).toBeInTheDocument();
  });

  it("affiche le nom du validateur quand une étape est validée", () => {
    const members = [makeMember({ user_id: "user-1", username: "alice" })];
    const steps = [makeStep({ state: "completed", validated_by: "user-1" })];

    render(<StepList steps={steps} members={members} />);

    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("n'affiche aucun nom de validateur pour une étape non validée", () => {
    const steps = [makeStep({ state: "pending", validated_by: null })];

    render(<StepList steps={steps} members={[]} />);

    expect(screen.queryByText("alice")).not.toBeInTheDocument();
  });

  it("affiche l'id utilisateur si le validateur est introuvable dans members", () => {
    const steps = [
      makeStep({ state: "completed", validated_by: "unknown-user-id" }),
    ];

    render(<StepList steps={steps} members={[]} />);

    expect(screen.getByText("unknown-user-id")).toBeInTheDocument();
  });

  it("rend une liste vide sans erreur quand steps est vide", () => {
    const { container } = render(<StepList steps={[]} members={[]} />);

    expect(container.querySelectorAll("div").length).toBeGreaterThanOrEqual(1);
  });
});
