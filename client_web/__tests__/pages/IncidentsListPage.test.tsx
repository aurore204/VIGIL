import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IncidentsPage from "@/app/[locale]/(app)/incidents/page";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import { useAuthStore } from "@/lib/store";
import type { Team, Incident } from "@/lib/types";

jest.mock("@/lib/api", () => ({
  api: {
    getTeams: jest.fn(),
    getIncidents: jest.fn(),
    getOnlineUsers: jest.fn(),
    getIncident: jest.fn(),
    createIncident: jest.fn(),
  },
}));

jest.mock("@/lib/websocket", () => ({
  vigilWs: { on: jest.fn(), off: jest.fn() },
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/components/incidents/IncidentTable", () => ({
  IncidentTable: ({ incidents }: { incidents: Incident[] }) => (
    <div data-testid="incident-table">
      {incidents.map((i) => (
        <div key={i.id}>{i.title}</div>
      ))}
    </div>
  ),
}));

jest.mock("@/components/incidents/CreateIncidentModal", () => ({
  CreateIncidentModal: ({ onClose, onSubmit }: any) => (
    <div data-testid="create-modal">
      <button onClick={onClose}>close-modal</button>
      <button
        onClick={() => onSubmit("team-1", "Nouveau titre", "high", undefined)}
      >
        submit-modal
      </button>
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

const makeIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "inc-1",
  team_id: "team-1",
  created_by: "user-1",
  assigned_to: null,
  title: "Panne serveur",
  description: null,
  state: "open",
  severity: "critical",
  timeline: [],
  resolved_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("IncidentsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: "fake-token" });
    (api.getTeams as jest.Mock).mockResolvedValue([]);
    (api.getIncidents as jest.Mock).mockResolvedValue([]);
    (api.getOnlineUsers as jest.Mock).mockResolvedValue([]);
  });

  it("affiche un état de chargement puis le contenu", async () => {
    render(<IncidentsPage />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );
  });

  it("affiche les incidents chargés", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getIncidents as jest.Mock).mockResolvedValue([
      makeIncident({ title: "Incident A" }),
    ]);

    render(<IncidentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Incident A")).toBeInTheDocument();
    });
  });

  it("filtre les incidents par recherche texte", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getIncidents as jest.Mock).mockResolvedValue([
      makeIncident({ id: "inc-1", title: "Panne réseau" }),
      makeIncident({ id: "inc-2", title: "Fuite mémoire" }),
    ]);

    render(<IncidentsPage />);
    await waitFor(() =>
      expect(screen.getByText("Panne réseau")).toBeInTheDocument(),
    );

    await userEvent.type(
      screen.getByPlaceholderText("searchPlaceholder"),
      "réseau",
    );

    expect(screen.getByText("Panne réseau")).toBeInTheDocument();
    expect(screen.queryByText("Fuite mémoire")).not.toBeInTheDocument();
  });

  it("filtre les incidents par sévérité", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getIncidents as jest.Mock).mockResolvedValue([
      makeIncident({
        id: "inc-1",
        title: "Incident critique",
        severity: "critical",
      }),
      makeIncident({ id: "inc-2", title: "Incident mineur", severity: "low" }),
    ]);

    render(<IncidentsPage />);
    await waitFor(() =>
      expect(screen.getByText("Incident critique")).toBeInTheDocument(),
    );

    await userEvent.selectOptions(
      screen.getByLabelText("severityLabel"),
      "critical",
    );

    expect(screen.getByText("Incident critique")).toBeInTheDocument();
    expect(screen.queryByText("Incident mineur")).not.toBeInTheDocument();
  });

  it("filtre les incidents par état", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getIncidents as jest.Mock).mockResolvedValue([
      makeIncident({ id: "inc-1", title: "Incident ouvert", state: "open" }),
      makeIncident({
        id: "inc-2",
        title: "Incident résolu",
        state: "resolved",
      }),
    ]);

    render(<IncidentsPage />);
    await waitFor(() =>
      expect(screen.getByText("Incident ouvert")).toBeInTheDocument(),
    );

    await userEvent.selectOptions(
      screen.getByLabelText("stateLabel"),
      "resolved",
    );

    expect(screen.getByText("Incident résolu")).toBeInTheDocument();
    expect(screen.queryByText("Incident ouvert")).not.toBeInTheDocument();
  });

  it("n'affiche pas le bouton de création si l'utilisateur n'est manager d'aucune team", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "quelquun-dautre" }),
    ]);

    render(<IncidentsPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    expect(screen.queryByTestId("create-modal")).not.toBeInTheDocument();
  });

  it("affiche le modal de création et le ferme au clic sur close", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "user-1" }),
    ]);

    render(<IncidentsPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("create"));
    expect(screen.getByTestId("create-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByText("close-modal"));
    expect(screen.queryByTestId("create-modal")).not.toBeInTheDocument();
  });

  it("crée un incident et affiche un toast de succès", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "user-1" }),
    ]);
    (api.createIncident as jest.Mock).mockResolvedValue({});

    render(<IncidentsPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("create"));
    await userEvent.click(screen.getByText("submit-modal"));

    await waitFor(() => {
      expect(api.createIncident).toHaveBeenCalledWith("team-1", {
        title: "Nouveau titre",
        severity: "high",
        description: undefined,
      });
      expect(mockShowToast).toHaveBeenCalledWith("toastCreated", "success");
    });
  });

  it("affiche le nombre total d'utilisateurs en ligne", async () => {
    (api.getOnlineUsers as jest.Mock).mockResolvedValue(["bob", "charlie"]);

    render(<IncidentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/2/)).toBeInTheDocument();
    });
  });

  it("enregistre les handlers WebSocket au montage et les retire au démontage", async () => {
    const { unmount } = render(<IncidentsPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    expect(vigilWs.on).toHaveBeenCalledWith(
      "incident_state_changed",
      expect.any(Function),
    );

    unmount();

    expect(vigilWs.off).toHaveBeenCalledWith(
      "incident_state_changed",
      expect.any(Function),
    );
  });
});
