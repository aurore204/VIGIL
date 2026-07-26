import type { WsEvent } from './types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

type WsEventHandler = (event: WsEvent) => void;

class VIGILWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, WsEventHandler[]> = new Map();
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private token: string | null = null;
  private shouldReconnect = true;

  connect(token: string) {
    this.token = token;
    this.shouldReconnect = true;
    this.createConnection();
  }

  private createConnection() {
    if (!this.token) return;

    this.ws = new WebSocket(`${WS_URL}?token=${this.token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connecté');
      this.reconnectDelay = 1000;
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

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
          this.createConnection();
        }, this.reconnectDelay);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket erreur:', error);
    };
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
    this.ws?.close();
    this.ws = null;
  }
}

export const vigilWs = new VIGILWebSocket();