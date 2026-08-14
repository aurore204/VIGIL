import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateRuleModal } from "@/components/rules/CreateRuleModal";
import { api } from "@/lib/api";

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

const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/lib/api", () => ({
  api: {
    createRule: jest.fn(),
  },
}));

describe("CreateRuleModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("affiche le champ nom de règle", () => {
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(/nameLabel/)).toBeInTheDocument();
  });

  it("appelle onClose au clic sur annuler", async () => {
    const onClose = jest.fn();
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={onClose}
        onCreated={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByText("cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ne soumet pas si le nom de la règle est vide", async () => {
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByText("submit"));

    expect(api.createRule).not.toHaveBeenCalled();
  });

  it("crée une règle vigil_create_incident avec les valeurs par défaut", async () => {
    (api.createRule as jest.Mock).mockResolvedValue({ id: "rule-1" });
    const onCreated = jest.fn();
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={onCreated}
      />,
    );

    await userEvent.type(screen.getByLabelText(/nameLabel/), "Ma règle CI");
    await userEvent.click(screen.getByText("submit"));

    expect(api.createRule).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({
        name: "Ma règle CI",
        enabled: true,
        trigger: {
          service: "github",
          event: "workflow_run",
          filters: { conclusion: "failure" },
        },
        reaction: expect.objectContaining({ type: "vigil_create_incident" }),
      }),
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("bascule vers la réaction http_post et affiche le champ URL", async () => {
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    const reactionSelect = screen.getByLabelText(/reactionLabel/);
    await userEvent.selectOptions(reactionSelect, "http_post");

    expect(screen.getByLabelText(/httpUrlLabel/)).toBeInTheDocument();
  });

  it("crée une règle http_post avec l'URL fournie", async () => {
    (api.createRule as jest.Mock).mockResolvedValue({ id: "rule-2" });
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/nameLabel/), "Règle HTTP");
    await userEvent.selectOptions(
      screen.getByLabelText(/reactionLabel/),
      "http_post",
    );
    await userEvent.type(
      screen.getByLabelText(/httpUrlLabel/),
      "https://example.com/hook",
    );
    await userEvent.click(screen.getByText("submit"));

    expect(api.createRule).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({
        reaction: {
          type: "http_post",
          payload: { url: "https://example.com/hook" },
        },
      }),
    );
  });

  it("affiche un toast de succès après création", async () => {
    (api.createRule as jest.Mock).mockResolvedValue({ id: "rule-1" });
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/nameLabel/), "Ma règle");
    await userEvent.click(screen.getByText("submit"));

    expect(mockShowToast).toHaveBeenCalledWith("toastCreated", "success");
  });

  it("affiche un toast d'erreur si la création échoue", async () => {
    (api.createRule as jest.Mock).mockRejectedValue(
      new Error("Erreur serveur"),
    );
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/nameLabel/), "Ma règle");
    await userEvent.click(screen.getByText("submit"));

    expect(mockShowToast).toHaveBeenCalledWith("Erreur serveur", "error");
  });

  it("décoche includeRepoName retire le suffixe du titre construit", async () => {
    (api.createRule as jest.Mock).mockResolvedValue({ id: "rule-1" });
    render(
      <CreateRuleModal
        teamId="team-1"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/nameLabel/), "Ma règle");
    const checkbox = screen
      .getByText("includeRepoName")
      .closest("label")!
      .querySelector("input")!;
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByText("submit"));

    const call = (api.createRule as jest.Mock).mock.calls[0][1];
    expect(call.reaction.payload.title).not.toContain(
      "sur {{repository.name}}",
    );
  });
});
