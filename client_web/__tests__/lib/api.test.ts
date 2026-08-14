import { api } from '@/lib/api';

describe('api client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('envoie le token stocké en localStorage dans le header Authorization', async () => {
    localStorage.setItem('vigil_token', 'mon-token-jwt');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await api.getTeams();

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer mon-token-jwt');
  });

  it("n'envoie pas de header Authorization sans token stocké", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await api.getTeams();

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('retourne data.data en cas de succès', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'team-1', name: 'Team Alpha' } }),
    });

    const result = await api.getTeam('team-1');

    expect(result).toEqual({ id: 'team-1', name: 'Team Alpha' });
  });

  it('lance une erreur avec le message du serveur en cas de réponse non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Team introuvable' }),
    });

    await expect(api.getTeam('team-inconnue')).rejects.toThrow('Team introuvable');
  });

  it('lance un message générique si le serveur ne fournit pas de message d\'erreur', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    await expect(api.getTeam('team-inconnue')).rejects.toThrow('Une erreur est survenue');
  });

  it('createTeam envoie une requête POST avec le bon body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'team-2' } }),
    });

    await api.createTeam('Nouvelle team', 'une description');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/teams');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: 'Nouvelle team', description: 'une description' });
  });

  it('deleteTeam envoie une requête DELETE', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });

    await api.deleteTeam('team-1');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/teams/team-1');
    expect(options.method).toBe('DELETE');
  });

  it('createIncident construit correctement l\'URL avec le teamId', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'inc-1' } }),
    });

    await api.createIncident('team-1', { title: 'Panne', severity: 'high' });

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/teams/team-1/incidents');
  });

  it('acknowledgeIncident envoie une requête PATCH sans body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'inc-1', state: 'acknowledged' } }),
    });

    await api.acknowledgeIncident('inc-1');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/incidents/inc-1/acknowledge');
    expect(options.method).toBe('PATCH');
  });

  it('addReaction envoie le bon emoji dans le body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });

    await api.addReaction('inc-1', 'entry-1', '+1');

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ emoji: '+1' });
  });

  it('removeReaction construit l\'URL avec l\'emoji encodé dans le chemin', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });

    await api.removeReaction('inc-1', 'entry-1', 'fire');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/incidents/inc-1/timeline/entry-1/reactions/fire');
    expect(options.method).toBe('DELETE');
  });

  it('createRule envoie trigger et reaction dans le body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'rule-1' } }),
    });

    const trigger = { service: 'github', event: 'workflow_run', filters: {} };
    const reaction = { type: 'vigil_create_incident', payload: {} };

    await api.createRule('team-1', { name: 'Ma règle', trigger, reaction });

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.trigger).toEqual(trigger);
    expect(body.reaction).toEqual(reaction);
  });
});