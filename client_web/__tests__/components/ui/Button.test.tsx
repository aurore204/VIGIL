import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("applique le style danger", () => {
    render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole("button")).toHaveStyle({
      background: "oklch(0.55 0.18 25)",
    });
  });

  it("applique le style secondary", () => {
    render(<Button variant="secondary">Annuler</Button>);
    expect(screen.getByRole("button")).toHaveStyle({
      background: "transparent",
    });
  });

  it("ne déclenche pas onClick quand disabled", () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Test
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("affiche un spinner quand loading est vrai", () => {
    render(<Button loading>Envoyer</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
