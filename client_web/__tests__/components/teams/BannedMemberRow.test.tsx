import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannedMemberRow } from "@/components/teams/BannedMemberRow";
import type { BannedMember } from "@/lib/types";

const makeBanned = (overrides: Partial<BannedMember> = {}): BannedMember => ({
  user_id: "user-1",
  username: "bob",
  email: "bob@test.com",
  banned_by: "manager-1",
  banned_by_username: "alice",
  expires_at: null,
  reason: null,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("BannedMemberRow", () => {
  it("affiche le nom d'utilisateur banni", () => {
    render(
      <BannedMemberRow
        banned={makeBanned()}
        canUnban={false}
        onUnban={jest.fn()}
      />,
    );
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("affiche le nom de la personne qui a banni", () => {
    render(
      <BannedMemberRow
        banned={makeBanned()}
        canUnban={false}
        onUnban={jest.fn()}
      />,
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it('affiche "permanently" quand expires_at est null', () => {
    render(
      <BannedMemberRow
        banned={makeBanned({ expires_at: null })}
        canUnban={false}
        onUnban={jest.fn()}
      />,
    );
    expect(screen.getByText(/permanently/)).toBeInTheDocument();
  });

  it('affiche "until" avec une date quand expires_at est présent', () => {
    render(
      <BannedMemberRow
        banned={makeBanned({ expires_at: "2026-06-01T12:00:00Z" })}
        canUnban={false}
        onUnban={jest.fn()}
      />,
    );
    expect(screen.getByText(/until/)).toBeInTheDocument();
  });

  it("n'affiche pas de raison si elle est absente", () => {
    render(
      <BannedMemberRow
        banned={makeBanned({ reason: null })}
        canUnban={false}
        onUnban={jest.fn()}
      />,
    );
    expect(screen.queryByText(/reason/)).not.toBeInTheDocument();
  });

  it("affiche la raison quand elle est présente", () => {
    render(
      <BannedMemberRow
        banned={makeBanned({ reason: "comportement inapproprié" })}
        canUnban={false}
        onUnban={jest.fn()}
      />,
    );
    expect(screen.getByText(/comportement inapproprié/)).toBeInTheDocument();
  });

  it("n'affiche pas le bouton unban quand canUnban est false", () => {
    render(
      <BannedMemberRow
        banned={makeBanned()}
        canUnban={false}
        onUnban={jest.fn()}
      />,
    );
    expect(screen.queryByText("unban")).not.toBeInTheDocument();
  });

  it("affiche le bouton unban quand canUnban est true", () => {
    render(
      <BannedMemberRow banned={makeBanned()} canUnban onUnban={jest.fn()} />,
    );
    expect(screen.getByText("unban")).toBeInTheDocument();
  });

  it("appelle onUnban avec le bon user_id et username", async () => {
    const onUnban = jest.fn();
    render(
      <BannedMemberRow
        banned={makeBanned({ user_id: "user-42", username: "charlie" })}
        canUnban
        onUnban={onUnban}
      />,
    );

    await userEvent.click(screen.getByText("unban"));

    expect(onUnban).toHaveBeenCalledWith("user-42", "charlie");
  });
});
