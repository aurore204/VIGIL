import type { WsEvent } from './types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

type WsEventHandler = (event: any) => void;
class VIGILWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, WsEventHandler[]> = new Map();
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private token: string | null = null;
  private shouldReconnect = true;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandlerAttached = false;

  connect(token: string) {
    if (
      this.token === token &&
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.token = token;
    this.shouldReconnect = true;
    this.attachVisibilityHandler();
    this.createConnection();
  }

  private attachVisibilityHandler() {
    if (this.visibilityHandlerAttached || typeof document === 'undefined') return;
    this.visibilityHandlerAttached = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // si le socket n'est plus ouvert, on relance une connexion propre.
        if (this.token && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.reconnectDelay = 1000;
          this.createConnection();
        }
      }
    });

    // Le navigateur va parfois couper le WS juste avant de mettre la page en bfcache.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        console.log('Page restaurée depuis le bfcache — reconnexion WS si nécessaire');
        if (this.token && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.reconnectDelay = 1000;
          this.createConnection();
        }
      }
    });
  }

  private createConnection() {
    if (!this.token) return;
    this.ws?.close();
    this.ws = new WebSocket(`${WS_URL}?token=${this.token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connecté', WS_URL);
      this.reconnectDelay = 1000;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        const handlers = this.handlers.get(data.type) || [];
        handlers.forEach(handler => handler(data));

        const allHandlers = this.handlers.get('*') || [];
        allHandlers.forEach(handler => handler(data));
      } catch (e) {
        console.error('Erreur parsing WS message', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket fermé — code:', event.code, 'reason:', event.reason, 'clean:', event.wasClean);
      this.stopHeartbeat();


      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      if (this.shouldReconnect) {
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
          this.createConnection();
        }, this.reconnectDelay);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket erreur:', error);
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  on(eventType: string, handler: WsEventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: WsEventHandler) {
    const handlers = this.handlers.get(eventType) || [];
    this.handlers.set(eventType, handlers.filter(h => h !== handler));
  }

  watch(resourceId: string, resourceType: string, teamId: string) {
    this.send({ type: 'watch', resource_id: resourceId, resource_type: resourceType, team_id: teamId });
  }

  unwatch(resourceId: string, resourceType: string, teamId: string) {
    this.send({ type: 'unwatch', resource_id: resourceId, resource_type: resourceType, team_id: teamId });
  }

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const vigilWs = new VIGILWebSocket();