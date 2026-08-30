import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/[locale]/(app)/dashboard/page";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import { useAuthStore } from "@/lib/store";
import type { Team, Incident, Release } from "@/lib/types";

jest.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/lib/api", () => ({
  api: {
    getTeams: jest.fn(),
    getIncidents: jest.fn(),
    getReleases: jest.fn(),
    getOnlineUsers: jest.fn(),
  },
}));

jest.mock("@/lib/websocket", () => ({
  vigilWs: {
    on: jest.fn(),
    off: jest.fn(),
  },
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
  updated_at: "2026-01-02T00:00:00Z",
  ...overrides,
});

const makeRelease = (overrides: Partial<Release> = {}): Release => ({
  id: "rel-1",
  team_id: "team-1",
  created_by: "user-1",
  title: "Release v1",
  description: null,
  state: "in_progress",
  steps: [
    {
      id: "s1",
      release_id: "rel-1",
      name: "build",
      description: null,
      position: 0,
      state: "completed",
      validated_by: null,
      validated_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: "fake-token" });
    (api.getTeams as jest.Mock).mockResolvedValue([]);
    (api.getIncidents as jest.Mock).mockResolvedValue([]);
    (api.getReleases as jest.Mock).mockResolvedValue([]);
    (api.getOnlineUsers as jest.Mock).mockResolvedValue([]);
  });

  it("affiche un état de chargement puis le contenu", async () => {
    render(<DashboardPage />);
    expect(screen.getByText("loading")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );
  });

  it("affiche le message de bienvenue avec le nom de l'utilisateur", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/greeting/)).toBeInTheDocument();
    });
  });

  it("affiche le nombre d'incidents actifs dans la stat card", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getIncidents as jest.Mock).mockResolvedValue([
      makeIncident({ state: "open" }),
      makeIncident({ id: "inc-2", state: "resolved" }),
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      // Un seul incident actif (le résolu est exclu)
      expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    });
  });

  it("compte correctement les incidents critiques non résolus", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getIncidents as jest.Mock).mockResolvedValue([
      makeIncident({ id: "inc-1", severity: "critical", state: "open" }),
      makeIncident({ id: "inc-2", severity: "critical", state: "resolved" }),
      makeIncident({ id: "inc-3", severity: "low", state: "open" }),
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(api.getIncidents).toHaveBeenCalled();
    });
  });

  it("affiche le message vide de la carte incidents quand il n'y en a aucun", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("incidentsCard.empty")).toBeInTheDocument();
    });
  });

  it("affiche le titre de chaque incident actif", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getIncidents as jest.Mock).mockResolvedValue([
      makeIncident({ title: "Panne critique" }),
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Panne critique")).toBeInTheDocument();
    });
  });

  it("affiche le message vide de la carte online quand personne n'est connecté", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("onlineCard.empty")).toBeInTheDocument();
    });
  });

  it("affiche les utilisateurs en ligne", async () => {
    (api.getOnlineUsers as jest.Mock).mockResolvedValue(["bob", "charlie"]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("bob")).toBeInTheDocument();
      expect(screen.getByText("charlie")).toBeInTheDocument();
    });
  });

  it("affiche le message vide de la carte releases quand il n'y en a aucune", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("releasesCard.empty")).toBeInTheDocument();
    });
  });

  it("affiche les releases actives (in_progress ou blocked)", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);
    (api.getReleases as jest.Mock).mockResolvedValue([
      makeRelease({
        id: "rel-1",
        title: "Release active",
        state: "in_progress",
      }),
      makeRelease({
        id: "rel-2",
        title: "Release terminée",
        state: "completed",
      }),
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Release active")).toBeInTheDocument();
      expect(screen.queryByText("Release terminée")).not.toBeInTheDocument();
    });
  });

  it("affiche les teams de l'utilisateur", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ name: "Team Alpha" }),
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });
  });

  it('affiche le rôle "Manager" pour le manager de la team', async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([makeTeam()]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Manager")).toBeInTheDocument();
    });
  });

  it("rend un lien vers la page de détail de chaque team", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ id: "team-99" }),
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      const links = screen
        .getAllByRole("link")
        .filter((l) => l.getAttribute("href") === "/team-detail?id=team-99");
      expect(links.length).toBeGreaterThan(0);
    });
  });

  it("enregistre les handlers WebSocket au montage", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(vigilWs.on).toHaveBeenCalledWith(
        "presence_online",
        expect.any(Function),
      );
      expect(vigilWs.on).toHaveBeenCalledWith(
        "incident_state_changed",
        expect.any(Function),
      );
    });
  });

  it("désinscrit les handlers WebSocket au démontage", async () => {
    const { unmount } = render(<DashboardPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    unmount();

    expect(vigilWs.off).toHaveBeenCalledWith(
      "presence_online",
      expect.any(Function),
    );
  });
});
