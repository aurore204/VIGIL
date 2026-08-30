import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WebhookSecretModal } from "@/components/rules/WebhookSecretModal";
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
    createWebhookSecret: jest.fn(),
  },
}));

Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

describe("WebhookSecretModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("affiche le chemin du webhook incluant le teamId", () => {
    render(<WebhookSecretModal teamId="team-42" onClose={jest.fn()} />);
    expect(screen.getByText("/webhooks/github/team-42")).toBeInTheDocument();
  });

  it("copie le chemin du webhook dans le presse-papier au clic", async () => {
    render(<WebhookSecretModal teamId="team-42" onClose={jest.fn()} />);

    await userEvent.click(screen.getByTitle("copyUrl"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "/webhooks/github/team-42",
    );
    expect(mockShowToast).toHaveBeenCalledWith("toastUrlCopied", "success");
  });

  it("appelle onClose au clic sur annuler", async () => {
    const onClose = jest.fn();
    render(<WebhookSecretModal teamId="team-1" onClose={onClose} />);

    await userEvent.click(screen.getByText("cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ne soumet pas si le secret est vide", async () => {
    render(<WebhookSecretModal teamId="team-1" onClose={jest.fn()} />);

    await userEvent.click(screen.getByText("submit"));

    expect(api.createWebhookSecret).not.toHaveBeenCalled();
  });

  it("appelle createWebhookSecret avec les bonnes valeurs", async () => {
    (api.createWebhookSecret as jest.Mock).mockResolvedValue(undefined);
    render(<WebhookSecretModal teamId="team-1" onClose={jest.fn()} />);

    await userEvent.type(
      screen.getByLabelText(/secretLabel/),
      "mon-secret-webhook",
    );
    await userEvent.click(screen.getByText("submit"));

    expect(api.createWebhookSecret).toHaveBeenCalledWith(
      "team-1",
      "github",
      "mon-secret-webhook",
    );
  });

  it("ferme le modal après une sauvegarde réussie", async () => {
    (api.createWebhookSecret as jest.Mock).mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<WebhookSecretModal teamId="team-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/secretLabel/), "mon-secret");
    await userEvent.click(screen.getByText("submit"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith("toastSaved", "success");
  });

  it("affiche un toast d'erreur si la sauvegarde échoue", async () => {
    (api.createWebhookSecret as jest.Mock).mockRejectedValue(
      new Error("Secret invalide"),
    );
    render(<WebhookSecretModal teamId="team-1" onClose={jest.fn()} />);

    await userEvent.type(screen.getByLabelText(/secretLabel/), "x");
    await userEvent.click(screen.getByText("submit"));

    expect(mockShowToast).toHaveBeenCalledWith("Secret invalide", "error");
  });
});
