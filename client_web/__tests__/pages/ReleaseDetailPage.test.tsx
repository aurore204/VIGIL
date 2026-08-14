import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReleaseDetailPage from "@/app/[locale]/(app)/releases/[id]/page";
import { api } from "@/lib/api";
import { vigilWs } from "@/lib/websocket";
import { useAuthStore } from "@/lib/store";
import type { Release, Team } from "@/lib/types";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "rel-1" }),
}));
jest.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/api", () => ({
  api: {
    getRelease: jest.fn(),
    getTeam: jest.fn(),
    startRelease: jest.fn(),
    cancelRelease: jest.fn(),
    validateStep: jest.fn(),
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
  ReleaseStateBadge: ({ state }: { state: string }) => <span>{state}</span>,
}));

jest.mock("@/components/releases/StepList", () => ({
  StepList: () => <div data-testid="step-list" />,
}));

jest.mock("@/components/shared/PresenceIndicator", () => ({
  PresenceIndicator: ({ watchers }: { watchers: string[] }) => (
    <div data-testid="presence">{watchers.join(",")}</div>
  ),
}));

const mockUser = {
  id: "user-1",
  email: "alice@test.com",
  username: "alice",
  language: "fr",
  created_at: "2026-01-01T00:00:00Z",
};

const makeStep = (overrides: any = {}) => ({
  id: "s1",
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

const makeRelease = (overrides: Partial<Release> = {}): Release => ({
  id: "rel-1",
  team_id: "team-1",
  created_by: "user-1",
  title: "Release v1",
  description: null,
  state: "created",
  steps: [makeStep()],
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

describe("ReleaseDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, token: "fake-token" });
    (api.getRelease as jest.Mock).mockResolvedValue(makeRelease());
    (api.getTeam as jest.Mock).mockResolvedValue(makeTeam());
  });

  it("affiche un état de chargement puis le contenu", async () => {
    render(<ReleaseDetailPage />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("loading")).not.toBeInTheDocument(),
    );
  });

  it("affiche le titre de la release", async () => {
    render(<ReleaseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Release v1")).toBeInTheDocument();
    });
  });

  it('affiche le bouton "start" pour un manager quand la release est "created"', async () => {
    render(<ReleaseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("start")).toBeInTheDocument();
    });
  });

  it('appelle startRelease au clic sur "start"', async () => {
    (api.startRelease as jest.Mock).mockResolvedValue({});
    render(<ReleaseDetailPage />);
    await waitFor(() => expect(screen.getByText("start")).toBeInTheDocument());

    await userEvent.click(screen.getByText("start"));

    await waitFor(() => {
      expect(api.startRelease).toHaveBeenCalledWith("rel-1");
      expect(mockShowToast).toHaveBeenCalledWith("toastStarted", "success");
    });
  });

  it("ouvre la confirmation d'annulation puis appelle cancelRelease", async () => {
    (api.cancelRelease as jest.Mock).mockResolvedValue({});
    render(<ReleaseDetailPage />);
    await waitFor(() => expect(screen.getByText("cancel")).toBeInTheDocument());

    await userEvent.click(screen.getByText("cancel"));
    await userEvent.click(screen.getByText("cancelConfirmLabel"));

    await waitFor(() => {
      expect(api.cancelRelease).toHaveBeenCalledWith("rel-1");
    });
  });

  it("n'affiche pas les boutons de gestion pour un non-manager", async () => {
    (api.getTeam as jest.Mock).mockResolvedValue(
      makeTeam({
        members: [
          {
            user_id: "user-1",
            username: "alice",
            email: "alice@test.com",
            role: "observer",
            joined_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );

    render(<ReleaseDetailPage />);

    await waitFor(() => {
      expect(screen.queryByText("start")).not.toBeInTheDocument();
    });
  });

  it('affiche le bouton "validate" pour l\'étape courante en cours', async () => {
    const release = makeRelease({
      state: "in_progress",
      steps: [makeStep({ id: "s1", state: "pending" })],
    });
    (api.getRelease as jest.Mock).mockResolvedValue(release);
    (api.getTeam as jest.Mock).mockResolvedValue(
      makeTeam({
        members: [
          {
            user_id: "user-1",
            username: "alice",
            email: "alice@test.com",
            role: "responder",
            joined_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );

    render(<ReleaseDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("validate")).toBeInTheDocument();
    });
  });

  it('appelle validateStep au clic sur "validate"', async () => {
    const release = makeRelease({
      state: "in_progress",
      steps: [makeStep({ id: "s1", state: "pending" })],
    });
    (api.getRelease as jest.Mock).mockResolvedValue(release);
    (api.getTeam as jest.Mock).mockResolvedValue(
      makeTeam({
        members: [
          {
            user_id: "user-1",
            username: "alice",
            email: "alice@test.com",
            role: "responder",
            joined_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    (api.validateStep as jest.Mock).mockResolvedValue({});

    render(<ReleaseDetailPage />);
    await waitFor(() =>
      expect(screen.getByText("validate")).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("validate"));

    await waitFor(() => {
      expect(api.validateStep).toHaveBeenCalledWith("rel-1", "s1");
    });
  });

  it("affiche l'avertissement quand la release est bloquée", async () => {
    (api.getRelease as jest.Mock).mockResolvedValue(
      makeRelease({ state: "blocked" }),
    );

    render(<ReleaseDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("blockedWarning")).toBeInTheDocument();
    });
  });

  it("s'abonne (watch) au montage et se désabonne (unwatch) au démontage", async () => {
    const { unmount } = render(<ReleaseDetailPage />);
    await waitFor(() => {
      expect(vigilWs.watch).toHaveBeenCalledWith("rel-1", "release", "team-1");
    });

    unmount();

    expect(vigilWs.unwatch).toHaveBeenCalledWith("rel-1", "release", "team-1");
  });

  it("affiche le nom du créateur de la release", async () => {
    render(<ReleaseDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
  });

  it("retourne à /releases au clic sur le bouton retour", async () => {
    render(<ReleaseDetailPage />);
    await waitFor(() => expect(screen.getByText("back")).toBeInTheDocument());

    await userEvent.click(screen.getByText("back"));

    expect(mockPush).toHaveBeenCalledWith("/releases");
  });
});
