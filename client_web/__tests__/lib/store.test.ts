import { useAuthStore } from "@/lib/store";
import type { User } from "@/lib/types";

const mockUser: User = {
  id: "user-1",
  email: "alice@test.com",
  username: "alice",
  language: "fr",
  created_at: "2026-01-01T00:00:00Z",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    // Réinitialise le store et le localStorage avant chaque test,
    // car le store Zustand est un singleton partagé entre les tests.
    localStorage.clear();
    useAuthStore.setState({ user: null, token: null });
  });

  it("l'état initial n'a ni utilisateur ni token", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it("setAuth stocke le user et le token dans le store", () => {
    useAuthStore.getState().setAuth(mockUser, "fake-jwt-token");

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe("fake-jwt-token");
  });

  it("setAuth persiste le token dans localStorage", () => {
    useAuthStore.getState().setAuth(mockUser, "fake-jwt-token");

    expect(localStorage.getItem("vigil_token")).toBe("fake-jwt-token");
  });

  it("setUser met à jour uniquement le user, sans toucher au token", () => {
    useAuthStore.setState({ token: "token-existant" });

    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe("token-existant");
  });

  it("clearAuth réinitialise user et token", () => {
    useAuthStore.getState().setAuth(mockUser, "fake-jwt-token");

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it("clearAuth supprime le token de localStorage", () => {
    useAuthStore.getState().setAuth(mockUser, "fake-jwt-token");

    useAuthStore.getState().clearAuth();

    expect(localStorage.getItem("vigil_token")).toBeNull();
  });

  it("isAuthenticated retourne false sans token", () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it("isAuthenticated retourne true avec un token", () => {
    useAuthStore.getState().setAuth(mockUser, "fake-jwt-token");

    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it("isAuthenticated retourne false après clearAuth", () => {
    useAuthStore.getState().setAuth(mockUser, "fake-jwt-token");
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });
});
