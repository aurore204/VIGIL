import { api } from "@/lib/api";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

function mockResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve({ data, success: ok }),
  });
}

describe("api — requêtes incidents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    mockLocalStorage.setItem("vigil_token", "fake-token");
  });

  it("getIncidents appelle le bon endpoint avec le token", async () => {
    mockFetch.mockReturnValue(mockResponse([{ id: "inc-1" }]));
    await api.getIncidents("team-1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/teams/team-1/incidents"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fake-token",
        }),
      }),
    );
  });

  it("createIncident envoie un POST avec le bon body", async () => {
    mockFetch.mockReturnValue(mockResponse({ id: "inc-new" }));
    await api.createIncident("team-1", { title: "Test", severity: "high" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/teams/team-1/incidents"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Test", severity: "high" }),
      }),
    );
  });

  it("acknowledgeIncident envoie un PATCH", async () => {
    mockFetch.mockReturnValue(
      mockResponse({ id: "inc-1", state: "acknowledged" }),
    );
    await api.acknowledgeIncident("inc-1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/incidents/inc-1/acknowledge"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("lance une erreur exploitable quand la réponse n'est pas ok", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Incident introuvable" }),
      }),
    );
    await expect(api.getIncident("inc-inconnu")).rejects.toThrow(
      "Incident introuvable",
    );
  });

  it("n'ajoute pas de header Authorization si aucun token n'est stocké", async () => {
    mockLocalStorage.clear();
    mockFetch.mockReturnValue(mockResponse([]));
    await api.getTeams();

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it("addReaction envoie l'emoji dans le body", async () => {
    mockFetch.mockReturnValue(mockResponse([]));
    await api.addReaction("inc-1", "entry-1", "fire");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/incidents/inc-1/timeline/entry-1/reactions"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ emoji: "fire" }),
      }),
    );
  });

  it("removeReaction envoie un DELETE avec l'emoji dans l'URL", async () => {
    mockFetch.mockReturnValue(mockResponse([]));
    await api.removeReaction("inc-1", "entry-1", "fire");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/incidents/inc-1/timeline/entry-1/reactions/fire",
      ),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("deleteIncident envoie un DELETE", async () => {
    mockFetch.mockReturnValue(mockResponse(undefined));
    await api.deleteIncident("inc-1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/incidents/inc-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("updateIncident envoie un PATCH avec les champs modifiés", async () => {
    mockFetch.mockReturnValue(
      mockResponse({ id: "inc-1", title: "Nouveau titre" }),
    );
    await api.updateIncident("inc-1", { title: "Nouveau titre" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/incidents/inc-1"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Nouveau titre" }),
      }),
    );
  });
});
