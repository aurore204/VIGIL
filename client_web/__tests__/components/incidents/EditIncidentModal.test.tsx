import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditIncidentModal } from "@/components/incidents/EditIncidentModal";
import type { Incident } from "@/lib/types";

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

const incident: Incident = {
  id: "inc-1",
  team_id: "team-1",
  created_by: "user-1",
  assigned_to: null,
  title: "Titre initial",
  description: "Desc initiale",
  state: "open",
  severity: "medium",
  timeline: [],
  resolved_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("EditIncidentModal", () => {
  it("pré-remplit les champs avec les valeurs de l'incident", () => {
    render(
      <EditIncidentModal
        incident={incident}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Titre initial")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Desc initiale")).toBeInTheDocument();
  });

  it("appelle onSubmit avec les valeurs modifiées", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <EditIncidentModal
        incident={incident}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const titleInput = screen.getByDisplayValue("Titre initial");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Titre modifié");
    await userEvent.click(screen.getByText("submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Titre modifié",
      description: "Desc initiale",
      severity: "medium",
    });
  });

  it("appelle onClose au clic sur annuler", async () => {
    const onClose = jest.fn();
    render(
      <EditIncidentModal
        incident={incident}
        onClose={onClose}
        onSubmit={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByText("cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ne soumet pas si le titre est vidé", async () => {
    const onSubmit = jest.fn();
    render(
      <EditIncidentModal
        incident={incident}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const titleInput = screen.getByDisplayValue("Titre initial");
    await userEvent.clear(titleInput);
    await userEvent.click(screen.getByText("submit"));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
