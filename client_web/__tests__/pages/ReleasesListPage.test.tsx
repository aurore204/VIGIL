import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReleasesPage from "@/app/[locale]/(app)/releases/page";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import { useAuthStore } from "@/lib/store";
import type { Team, Release } from "@/lib/types";

jest.mock("@/lib/api", () => ({
  api: {
    getTeams: jest.fn(),
    getReleases: jest.fn(),
    getOnlineUsers: jest.fn(),
    getRelease: jest.fn(),
    createRelease: jest.fn(),
  },
}));

jest.mock("@/lib/websocket", () => ({
  vigilWs: { on: jest.fn(), off: jest.fn() },
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/components/releases/ReleaseCard", () => ({
  ReleaseCard: ({ release, teamName }: any) => (
    <div>
      {release.title} — {teamName}
    </div>
  ),
}));

jest.mock("@/components/releases/CreateReleaseModal", () => ({
  CreateReleaseModal: ({ onClose, onSubmit }: any) => (
    <div data-testid="create-modal">
      <button onClick={onClose}>close-modal</button>
      <button
        onClick={() =>
          onSubmit("team-1", "Nouvelle release", ["build", "deploy"], undefined)
        }
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

const makeRelease = (overrides: Partial<Release> = {}): Release => ({
  id: "rel-1",
  team_id: "team-1",
  created_by: "user-1",
  title: "Release v1",
  description: null,
  state: "in_progress",
  steps: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("ReleasesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: "fake-token" });
    (api.getTeams as jest.Mock).mockResolvedValue([]);
    (api.getReleases as jest.Mock).mockResolvedValue([]);
    (api.getOnlineUsers as jest.Mock).mockResolvedValue([]);
  });

  it("affiche un état de chargement puis le contenu", async () => {
    render(<ReleasesPage />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );
  });

  it("affiche le message vide quand il n'y a aucune release", async () => {
    render(<ReleasesPage />);
    await waitFor(() => {
      expect(screen.getByText("empty")).toBeInTheDocument();
    });
  });

  it("affiche les releases chargées avec le nom de leur team", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ name: "Team Alpha" }),
    ]);
    (api.getReleases as jest.Mock).mockResolvedValue([
      makeRelease({ title: "Release X" }),
    ]);

    render(<ReleasesPage />);

    await waitFor(() => {
      expect(screen.getByText("Release X — Team Alpha")).toBeInTheDocument();
    });
  });

  it("n'affiche pas le bouton de création si l'utilisateur n'est manager d'aucune team", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "quelquun-dautre" }),
    ]);

    render(<ReleasesPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    expect(screen.queryByTestId("create-modal")).not.toBeInTheDocument();
  });

  it("crée une release et affiche un toast de succès", async () => {
    (api.getTeams as jest.Mock).mockResolvedValue([
      makeTeam({ manager_id: "user-1" }),
    ]);
    (api.createRelease as jest.Mock).mockResolvedValue({});

    render(<ReleasesPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("create"));
    await userEvent.click(screen.getByText("submit-modal"));

    await waitFor(() => {
      expect(api.createRelease).toHaveBeenCalledWith("team-1", {
        title: "Nouvelle release",
        description: undefined,
        steps: [{ name: "build" }, { name: "deploy" }],
      });
      expect(mockShowToast).toHaveBeenCalledWith("toastCreated", "success");
    });
  });

  it("enregistre les handlers WebSocket au montage et les retire au démontage", async () => {
    const { unmount } = render(<ReleasesPage />);
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );

    expect(vigilWs.on).toHaveBeenCalledWith(
      "release_state_changed",
      expect.any(Function),
    );

    unmount();

    expect(vigilWs.off).toHaveBeenCalledWith(
      "release_state_changed",
      expect.any(Function),
    );
  });
});
