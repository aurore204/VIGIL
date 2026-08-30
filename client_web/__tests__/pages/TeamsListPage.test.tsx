import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamsPage from "@/app/[locale]/(app)/teams/page";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import { useAuthStore } from "@/lib/store";
import type { Team } from "@/lib/types";

jest.mock("@/lib/api", () => ({
  api: {
    getTeams: jest.fn(),
    getIncidents: jest.fn(),
    getIncident: jest.fn(),
    getTeam: jest.fn(),
    createTeam: jest.fn(),
    joinTeam: jest.fn(),
  },
}));

jest.mock("@/lib/websocket", () => ({
  vigilWs: { on: jest.fn(), off: jest.fn() },
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/components/teams/TeamCard", () => ({
  TeamCard: ({ team }: any) => <div>{team.name}</div>,
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

describe("TeamsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: "fake-token" });
    (api.getTeams as jest.Mock).mockResolvedValue([]);
    (api.getIncidents as jest.Mock).mockResolvedValue([]);
  });

  it("affiche un état de chargement puis le contenu", async () => {
    render(<TeamsPage />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );
  });

  it("affiche le message vide quand il n'y a aucune team", async () => {
    render(<TeamsPage />);
    await waitFor(() => {
      expect(screen.getByText("emptyTitle")).toBeInTheDocument();
    });
  });

  it("affiche les teams chargées", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ name: "Team Alpha" }),
    ]);

    render(<TeamsPage />);

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });
  });

  it("ouvre le modal de création et crée une team", async () => {
    (api.createTeam as jest.Mock).mockResolvedValue({});

    render(<TeamsPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getAllByText("create")[0]);
    await userEvent.type(
      screen.getByPlaceholderText("createModal.namePlaceholder"),
      "Nouvelle Team",
    );
    await userEvent.click(screen.getByText("createModal.submit"));

    await waitFor(() => {
      expect(api.createTeam).toHaveBeenCalledWith("Nouvelle Team", undefined);
      expect(mockShowToast).toHaveBeenCalledWith("toastCreated", "success");
    });
  });

  it("ouvre le modal de jointure et rejoint une team avec un code", async () => {
    (api.joinTeam as jest.Mock).mockResolvedValue({});

    render(<TeamsPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getAllByText("join")[0]);
    await userEvent.type(
      screen.getByPlaceholderText("joinModal.codePlaceholder"),
      "ABC12345",
    );
    await userEvent.click(screen.getByText("joinModal.submit"));

    await waitFor(() => {
      expect(api.joinTeam).toHaveBeenCalledWith("ABC12345");
      expect(mockShowToast).toHaveBeenCalledWith("toastJoined", "success");
    });
  });

  it("affiche un toast d'erreur générique si le code de jointure est invalide", async () => {
    (api.joinTeam as jest.Mock).mockRejectedValue(new Error("Code invalide"));

    render(<TeamsPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getAllByText("join")[0]);
    await userEvent.type(
      screen.getByPlaceholderText("joinModal.codePlaceholder"),
      "BADCODE",
    );
    await userEvent.click(screen.getByText("joinModal.submit"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Code invalide", "error");
    });
  });

  it("calcule le total d'incidents actifs toutes teams confondues", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ id: "team-1" }),
      makeTeam({ id: "team-2" }),
    ]);
    (api.getIncidents as jest.Mock).mockImplementation((teamId: string) =>
      Promise.resolve(
        teamId === "team-1" ? [{ state: "open" }] : [{ state: "resolved" }],
      ),
    );

    render(<TeamsPage />);

    await waitFor(() => {
      expect(screen.getByText(/1 incident/)).toBeInTheDocument();
    });
  });

  it("enregistre les handlers WebSocket au montage", async () => {
    render(<TeamsPage />);
    await waitFor(() => {
      expect(vigilWs.on).toHaveBeenCalledWith(
        "member_kicked",
        expect.any(Function),
      );
    });
  });
});
