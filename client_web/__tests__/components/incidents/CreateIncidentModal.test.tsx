import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateIncidentModal } from "@/components/incidents/CreateIncidentModal";
import type { Team } from "@/lib/types";

jest.mock("@/components/shared/Modal", () => ({
  Modal: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div role="dialog">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

const teams: Team[] = [
  {
    id: "team-1",
    name: "Team Alpha",
    description: null,
    manager_id: "u1",
    members: [],
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("CreateIncidentModal", () => {
  it("affiche les champs du formulaire", () => {
    render(
      <CreateIncidentModal
        teams={teams}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });

  it("appelle onClose au clic sur annuler", async () => {
    const onClose = jest.fn();
    render(
      <CreateIncidentModal
        teams={teams}
        onClose={onClose}
        onSubmit={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByText("cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onSubmit avec les bonnes valeurs quand le formulaire est valide", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <CreateIncidentModal
        teams={teams}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const teamSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(teamSelect, "team-1");
    const inputs = screen.getAllByRole("textbox");
    await userEvent.type(inputs[0], "Panne serveur");
    await userEvent.click(screen.getByText("submit"));

    expect(onSubmit).toHaveBeenCalledWith(
      "team-1",
      "Panne serveur",
      "medium",
      undefined,
    );
  });

  it("ne soumet pas si le titre est vide", async () => {
    const onSubmit = jest.fn();
    render(
      <CreateIncidentModal
        teams={teams}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const teamSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(teamSelect, "team-1");
    await userEvent.click(screen.getByText("submit"));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
