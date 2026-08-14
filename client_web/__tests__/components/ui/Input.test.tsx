import { render, screen } from "@testing-library/react";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("applique la bordure danger en cas d'erreur", () => {
    render(<Input label="Email" error="Requis" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveStyle({ border: "1px solid oklch(0.55 0.18 25)" });
  });

  it("affiche le hint quand pas d'erreur", () => {
    render(<Input label="Nom" hint="Votre nom complet" />);
    expect(screen.getByText("Votre nom complet")).toBeInTheDocument();
  });

  it("n'affiche pas le hint quand il y a une erreur", () => {
    render(<Input label="Email" hint="Un email valide" error="Requis" />);
    expect(screen.queryByText("Un email valide")).not.toBeInTheDocument();
    expect(screen.getByText("Requis")).toBeInTheDocument();
  });

  it("a un vrai label associé (pas de placeholder-only, exigence PDF)", () => {
    render(<Input label="Titre" />);
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
  });
});
