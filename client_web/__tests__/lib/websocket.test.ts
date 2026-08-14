import { vigilWs } from '@/lib/websocket';

// Mock minimal de WebSocket, pilotable manuellement depuis les tests.
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  sentMessages: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: 'test close', wasClean: true });
  }

  // Aides pour piloter le mock depuis les tests
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
}

describe('vigilWs', () => {
  beforeEach(() => {
    MockWebSocket.reset();
    (global as any).WebSocket = MockWebSocket;
    jest.useFakeTimers();
  });

  afterEach(() => {
    vigilWs.disconnect();
    jest.useRealTimers();
  });

  it('connect crée une connexion WebSocket avec le token en query param', () => {
    vigilWs.connect('mon-token');

    const instance = MockWebSocket.instances[0];
    expect(instance.url).toContain('token=mon-token');
  });

  it('on() enregistre un handler qui reçoit les messages du bon type', () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    instance.simulateOpen();

    const handler = jest.fn();
    vigilWs.on('incident_state_changed', handler);

    instance.simulateMessage({ type: 'incident_state_changed', incident_id: 'inc-1', new_state: 'acknowledged', by: 'alice' });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'incident_state_changed', incident_id: 'inc-1' })
    );
  });

  it("un handler enregistré sur un autre type d'événement n'est pas appelé", () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    instance.simulateOpen();

    const handler = jest.fn();
    vigilWs.on('incident_assigned', handler);

    instance.simulateMessage({ type: 'incident_state_changed', incident_id: 'inc-1', new_state: 'open', by: 'alice' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('off() désinscrit correctement un handler', () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    instance.simulateOpen();

    const handler = jest.fn();
    vigilWs.on('incident_assigned', handler);
    vigilWs.off('incident_assigned', handler);

    instance.simulateMessage({ type: 'incident_assigned', incident_id: 'inc-1', assigned_to: 'bob' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('un message JSON invalide ne fait pas planter le client', () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    instance.simulateOpen();

    expect(() => {
      instance.onmessage?.({ data: 'ceci-nest-pas-du-json' });
    }).not.toThrow();
  });

  it('watch() envoie un message de type watch avec les bons champs', () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    instance.simulateOpen();

    vigilWs.watch('inc-1', 'incident', 'team-1');

    const sent = JSON.parse(instance.sentMessages[instance.sentMessages.length - 1]);
    expect(sent).toEqual({ type: 'watch', resource_id: 'inc-1', resource_type: 'incident', team_id: 'team-1' });
  });

  it('unwatch() envoie un message de type unwatch avec les bons champs', () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    instance.simulateOpen();

    vigilWs.unwatch('inc-1', 'incident', 'team-1');

    const sent = JSON.parse(instance.sentMessages[instance.sentMessages.length - 1]);
    expect(sent).toEqual({ type: 'unwatch', resource_id: 'inc-1', resource_type: 'incident', team_id: 'team-1' });
  });

  it("watch() n'envoie rien si le socket n'est pas ouvert", () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    // Ne pas appeler simulateOpen() : readyState reste CONNECTING

    vigilWs.watch('inc-1', 'incident', 'team-1');

    expect(instance.sentMessages.length).toBe(0);
  });

  it('disconnect() ferme le socket et empêche la reconnexion automatique', () => {
    vigilWs.connect('mon-token');
    const instance = MockWebSocket.instances[0];
    instance.simulateOpen();

    vigilWs.disconnect();

    expect(instance.readyState).toBe(MockWebSocket.CLOSED);

    // Avance le temps : aucune nouvelle connexion ne doit être créée
    jest.advanceTimersByTime(5000);
    expect(MockWebSocket.instances.length).toBe(1);
  });
});