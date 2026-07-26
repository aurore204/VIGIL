import { api } from '@/lib/api';

global.fetch = jest.fn();

const mockFetch = (data: unknown, ok = true) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: async () => ({ success: true, data, message: 'ok' }),
  });
};

const mockFetchError = (error: string, code: string) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ success: false, error, code }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('api.login', () => {
  it('envoie les bonnes données', async () => {
    mockFetch({ token: 'jwt', user: { id: '1', email: 'test@test.com' } });
    await api.login('test@test.com', 'password');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'password' }),
      })
    );
  });

  it('lance une erreur si la réponse est ko', async () => {
    mockFetchError('Email ou mot de passe incorrect', 'INVALID_CREDENTIALS');
    await expect(api.login('bad@test.com', 'wrong')).rejects.toThrow(
      'Email ou mot de passe incorrect'
    );
  });
});

describe('api.register', () => {
  it('envoie email, password et username', async () => {
    mockFetch({ token: 'jwt', user: { id: '1' } });
    await api.register('test@test.com', 'password', 'testuser');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'password', username: 'testuser' }),
      })
    );
  });
});

describe('api avec token', () => {
  it('inclut le token Authorization dans les headers', async () => {
    localStorage.setItem('vigil_token', 'my-jwt-token');
    mockFetch({ id: '1', email: 'test@test.com' });
    await api.me();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      })
    );
  });
});

describe('api.createIncident', () => {
  it('envoie les données de l incident', async () => {
    mockFetch({ id: '1', title: 'Serveur down' });
    await api.createIncident('team-1', { title: 'Serveur down', severity: 'critical' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/teams/team-1/incidents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Serveur down', severity: 'critical' }),
      })
    );
  });
});