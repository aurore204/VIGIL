import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RulesPage from "@/app/[locale]/(app)/rules/page";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { Team, Rule } from "@/lib/types";

jest.mock("@/lib/api", () => ({
  api: {
    getTeams: jest.fn(),
    getTeamRules: jest.fn(),
  },
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/components/rules/CreateRuleModal", () => ({
  CreateRuleModal: ({ onClose }: any) => (
    <div data-testid="create-rule-modal">
      <button onClick={onClose}>close-rule-modal</button>
    </div>
  ),
}));

jest.mock("@/components/rules/WebhookSecretModal", () => ({
  WebhookSecretModal: ({ onClose }: any) => (
    <div data-testid="webhook-modal">
      <button onClick={onClose}>close-webhook-modal</button>
    </div>
  ),
}));

const mockUser = {
  id: "user-1",
  email: "alice@test.com",
  username: "alice",
  language: "fr",
  created_at: "2026-01-01T00:00:00Z",
};

const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: "team-1",
  name: "Team Alpha",
  description: null,
  manager_id: "user-1",
  members: [],
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: "rule-1",
  team_id: "team-1",
  created_by: "user-1",
  name: "Ma règle",
  enabled: true,
  trigger: {
    service: "github",
    event: "workflow_run",
    filters: { conclusion: "failure" },
  },
  reaction: { type: "vigil_create_incident", payload: {} },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("RulesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: "fake-token" });
    (api.getTeams as jest.Mock).mockResolvedValue([]);
    (api.getTeamRules as jest.Mock).mockResolvedValue([]);
  });

  it("affiche un état de chargement puis le contenu", async () => {
    render(<RulesPage />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );
  });

  it("affiche le message 'noManagerTeam' si l'utilisateur n'est manager d'aucune team", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "quelquun-dautre" }),
    ]);

    render(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("noManagerTeam")).toBeInTheDocument();
    });
  });

  it("charge automatiquement les règles de la première team manager", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ id: "team-1", manager_id: "user-1" }),
    ]);
    (api.getTeamRules as jest.Mock).mockResolvedValue([
      makeRule({ name: "Règle CI" }),
    ]);

    render(<RulesPage />);

    await waitFor(() => {
      expect(api.getTeamRules).toHaveBeenCalledWith("team-1");
      expect(screen.getByText("Règle CI")).toBeInTheDocument();
    });
  });

  it("affiche le message vide quand il n'y a aucune règle", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "user-1" }),
    ]);

    render(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("empty")).toBeInTheDocument();
    });
  });

  it("décrit correctement une règle github workflow_run failure", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "user-1" }),
    ]);
    (api.getTeamRules as jest.Mock).mockResolvedValue([makeRule()]);

    render(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText(/triggerWhenFailure/)).toBeInTheDocument();
    });
  });

  it("recharge les règles au changement de team sélectionnée", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ id: "team-1", name: "Team A", manager_id: "user-1" }),
      makeTeam({ id: "team-2", name: "Team B", manager_id: "user-1" }),
    ]);
    (api.getTeamRules as jest.Mock).mockResolvedValue([]);

    render(<RulesPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.selectOptions(screen.getByLabelText("team"), "team-2");

    await waitFor(() => {
      expect(api.getTeamRules).toHaveBeenCalledWith("team-2");
    });
  });

  it("ouvre et ferme le modal de création de règle", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "user-1" }),
    ]);

    render(<RulesPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("createRule"));
    expect(screen.getByTestId("create-rule-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByText("close-rule-modal"));
    expect(screen.queryByTestId("create-rule-modal")).not.toBeInTheDocument();
  });

  it("ouvre et ferme le modal de secret webhook", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "user-1" }),
    ]);

    render(<RulesPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("configureWebhook"));
    expect(screen.getByTestId("webhook-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByText("close-webhook-modal"));
    expect(screen.queryByTestId("webhook-modal")).not.toBeInTheDocument();
  });
});
