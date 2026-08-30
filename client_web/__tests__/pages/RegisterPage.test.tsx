import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "@/app/[locale]/auth/register/page";
import { api } from "@/lib/api";

const mockPush = jest.fn();
jest.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockPush }),
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/lib/api", () => ({
  api: {
    register: jest.fn(),
  },
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("affiche tous les champs du formulaire", () => {
    render(<RegisterPage />);
    expect(
      screen.getByPlaceholderText("register.usernamePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("register.emailPlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByPlaceholderText("register.passwordPlaceholder").length,
    ).toBe(2);
  });

  it("affiche une erreur si les mots de passe ne correspondent pas", async () => {
    render(<RegisterPage />);

    await userEvent.type(
      screen.getByPlaceholderText("register.usernamePlaceholder"),
      "alice",
    );
    await userEvent.type(
      screen.getByPlaceholderText("register.emailPlaceholder"),
      "alice@test.com",
    );
    const passwordFields = screen.getAllByPlaceholderText(
      "register.passwordPlaceholder",
    );
    await userEvent.type(passwordFields[0], "password123");
    await userEvent.type(passwordFields[1], "password456");
    await userEvent.click(screen.getByRole("button"));

    expect(
      screen.getByText("register.errors.passwordMismatch"),
    ).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it("affiche une erreur si le mot de passe fait moins de 8 caractères", async () => {
    render(<RegisterPage />);

    await userEvent.type(
      screen.getByPlaceholderText("register.usernamePlaceholder"),
      "alice",
    );
    await userEvent.type(
      screen.getByPlaceholderText("register.emailPlaceholder"),
      "alice@test.com",
    );
    const passwordFields = screen.getAllByPlaceholderText(
      "register.passwordPlaceholder",
    );
    await userEvent.type(passwordFields[0], "court");
    await userEvent.type(passwordFields[1], "court");
    await userEvent.click(screen.getByRole("button"));

    expect(
      screen.getByText("register.errors.passwordTooShort"),
    ).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it("appelle api.register puis redirige vers /auth/login en cas de succès", async () => {
    (api.register as jest.Mock).mockResolvedValue({ token: "jwt", user: {} });

    render(<RegisterPage />);

    await userEvent.type(
      screen.getByPlaceholderText("register.usernamePlaceholder"),
      "alice",
    );
    await userEvent.type(
      screen.getByPlaceholderText("register.emailPlaceholder"),
      "alice@test.com",
    );
    const passwordFields = screen.getAllByPlaceholderText(
      "register.passwordPlaceholder",
    );
    await userEvent.type(passwordFields[0], "password123");
    await userEvent.type(passwordFields[1], "password123");
    await userEvent.click(screen.getByRole("button"));

    expect(api.register).toHaveBeenCalledWith(
      "alice@test.com",
      "password123",
      "alice",
    );
    expect(mockPush).toHaveBeenCalledWith("/auth/login");
  });

  it("affiche un message d'erreur si l'inscription échoue (ex: email déjà utilisé)", async () => {
    (api.register as jest.Mock).mockRejectedValue(
      new Error("Un compte avec cet email existe déjà"),
    );

    render(<RegisterPage />);

    await userEvent.type(
      screen.getByPlaceholderText("register.usernamePlaceholder"),
      "alice",
    );
    await userEvent.type(
      screen.getByPlaceholderText("register.emailPlaceholder"),
      "alice@test.com",
    );
    const passwordFields = screen.getAllByPlaceholderText(
      "register.passwordPlaceholder",
    );
    await userEvent.type(passwordFields[0], "password123");
    await userEvent.type(passwordFields[1], "password123");
    await userEvent.click(screen.getByRole("button"));

    expect(
      await screen.findByText("Un compte avec cet email existe déjà"),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("rend un lien vers la page de connexion", () => {
    render(<RegisterPage />);
    const link = screen.getByText("tabs.login").closest("a");
    expect(link).toHaveAttribute("href", "/auth/login");
  });
});
