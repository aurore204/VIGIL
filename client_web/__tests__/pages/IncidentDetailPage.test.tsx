import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IncidentDetailPage from "@/app/[locale]/(app)/incidents/[id]/page";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import { useAuthStore } from "@/lib/store";
import type { Incident, Team } from "@/lib/types";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "inc-1" }),
}));
jest.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/api", () => ({
  api: {
    getIncident: jest.fn(),
    getTeam: jest.fn(),
    getAvailableReactions: jest.fn(),
    acknowledgeIncident: jest.fn(),
    escalateIncident: jest.fn(),
    resolveIncident: jest.fn(),
    deleteIncident: jest.fn(),
    assignResponder: jest.fn(),
    updateIncident: jest.fn(),
    addTimelineEntry: jest.fn(),
    editTimelineEntry: jest.fn(),
    addReaction: jest.fn(),
    removeReaction: jest.fn(),
  },
}));

jest.mock("@/lib/websocket", () => ({
  vigilWs: {
    on: jest.fn(),
    off: jest.fn(),
    watch: jest.fn(),
    unwatch: jest.fn(),
  },
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/components/ui/Badge", () => ({
  IncidentStateBadge: ({ state }: { state: string }) => <span>{state}</span>,
  SeverityBadge: ({ severity }: { severity: string }) => (
    <span>{severity}</span>
  ),
}));

jest.mock("@/components/shared/PresenceIndicator", () => ({
  PresenceIndicator: ({ watchers }: { watchers: string[] }) => (
    <div data-testid="presence">{watchers.join(",")}</div>
  ),
}));

jest.mock("@/components/incidents/IncidentTimeline", () => ({
  IncidentTimeline: () => <div data-testid="timeline" />,
}));

jest.mock("@/components/incidents/IncidentInfo", () => ({
  IncidentInfo: () => <div data-testid="info" />,
}));

jest.mock("@/components/incidents/IncidentActions", () => ({
  IncidentActions: ({
    onAcknowledge,
    onEscalate,
    onResolve,
    onAssign,
    onEdit,
    onDelete,
  }: any) => (
    <div data-testid="actions">
      <button onClick={onAcknowledge}>do-acknowledge</button>
      <button onClick={onEscalate}>do-escalate</button>
      <button onClick={onResolve}>do-resolve</button>
      <button onClick={onAssign}>do-assign</button>
      <button onClick={onEdit}>do-edit</button>
      <button onClick={onDelete}>do-delete</button>
    </div>
  ),
}));

jest.mock("@/components/shared/AssignModal", () => ({
  AssignModal: ({ onAssign, onClose }: any) => (
    <div data-testid="assign-modal">
      <button onClick={() => onAssign("user-2")}>confirm-assign</button>
      <button onClick={onClose}>close-assign</button>
    </div>
  ),
}));

jest.mock("@/components/incidents/EditIncidentModal", () => ({
  EditIncidentModal: ({ onSubmit, onClose }: any) => (
    <div data-testid="edit-modal">
      <button onClick={() => onSubmit({ title: "Titre édité" })}>
        confirm-edit
      </button>
      <button onClick={onClose}>close-edit</button>
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

const makeIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "inc-1",
  team_id: "team-1",
  created_by: "user-1",
  assigned_to: null,
  title: "Panne serveur",
  description: "Une description",
  state: "open",
  severity: "high",
  timeline: [],
  resolved_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

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
  ],
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("IncidentDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: "fake-token" });
    (api.getIncident as jest.Mock).mockResolvedValue(makeIncident());
    (api.getTeam as jest.Mock).mockResolvedValue(makeTeam());
    (api.getAvailableReactions as jest.Mock).mockResolvedValue(["+1", "fire"]);
  });

  it("affiche un état de chargement puis le contenu", async () => {
    render(<IncidentDetailPage />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );
  });

  it("affiche le titre et la description de l'incident", async () => {
    render(<IncidentDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Panne serveur")).toBeInTheDocument();
      expect(screen.getByText("Une description")).toBeInTheDocument();
    });
  });

  it("appelle acknowledgeIncident au clic sur acknowledge", async () => {
    (api.acknowledgeIncident as jest.Mock).mockResolvedValue({});
    render(<IncidentDetailPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("do-acknowledge"));

    expect(api.acknowledgeIncident).toHaveBeenCalledWith("inc-1");
    expect(mockShowToast).toHaveBeenCalledWith("toastAcknowledged", "success");
  });

  it("appelle deleteIncident et redirige vers /incidents", async () => {
    (api.deleteIncident as jest.Mock).mockResolvedValue({});
    render(<IncidentDetailPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("do-delete"));

    await waitFor(() => {
      expect(api.deleteIncident).toHaveBeenCalledWith("inc-1");
      expect(mockPush).toHaveBeenCalledWith("/incidents");
    });
  });

  it("ouvre le modal assign et appelle assignResponder à la confirmation", async () => {
    (api.assignResponder as jest.Mock).mockResolvedValue({});
    render(<IncidentDetailPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("do-assign"));
    expect(screen.getByTestId("assign-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByText("confirm-assign"));

    expect(api.assignResponder).toHaveBeenCalledWith("inc-1", "user-2");
  });

  it("ouvre le modal edit et appelle updateIncident à la confirmation", async () => {
    (api.updateIncident as jest.Mock).mockResolvedValue({});
    render(<IncidentDetailPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("do-edit"));
    await userEvent.click(screen.getByText("confirm-edit"));

    expect(api.updateIncident).toHaveBeenCalledWith("inc-1", {
      title: "Titre édité",
    });
  });

  it("s'abonne (watch) au montage et se désabonne (unwatch) au démontage", async () => {
    const { unmount } = render(<IncidentDetailPage />);
    await waitFor(() => {
      expect(vigilWs.watch).toHaveBeenCalledWith("inc-1", "incident", "team-1");
    });

    unmount();

    expect(vigilWs.unwatch).toHaveBeenCalledWith("inc-1", "incident", "team-1");
  });

  it("affiche un toast d'erreur si acknowledgeIncident échoue", async () => {
    (api.acknowledgeIncident as jest.Mock).mockRejectedValue(
      new Error("Erreur serveur"),
    );
    render(<IncidentDetailPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("do-acknowledge"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Erreur serveur", "error");
    });
  });
});
