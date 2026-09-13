import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

// WebSocket server the dashboard connects to for live events:
// "paid" { counterparty, amount, txHash, ... }
// "frozen" { counterparty, amount, riskBrief, ... }
// "resolved" { counterparty, amount, approved, txHash?, ... }

export interface BaseEvent {
  type: string;
  paymentId?: string;
  timestamp?: number;
}

export interface PaidEvent extends BaseEvent {
  type: "paid";
  paymentId: string;
  counterparty: string;
  counterpartyId?: string;
  amount: number;
  amountUsdc?: number;
  txHash: string | null;
  description?: string;
  timestamp: number;
}

export interface FrozenEvent extends BaseEvent {
  type: "frozen";
  paymentId: string;
  counterparty: string;
  counterpartyId?: string;
  amount: number;
  amountUsdc?: number;
  description?: string;
  riskBrief: string;
  reason?: string;
  timestamp: number;
}

export interface ResolvedEvent extends BaseEvent {
  type: "resolved";
  paymentId: string;
  counterparty: string;
  counterpartyId?: string;
  amount: number;
  amountUsdc?: number;
  approved: boolean;
  txHash?: string | null;
  description?: string;
  timestamp: number;
}

export type WsEvent = PaidEvent | FrozenEvent | ResolvedEvent | (BaseEvent & Record<string, any>);

let wss: WebSocketServer | null = null;

/**
 * Attaches a WebSocketServer instance to the provided HTTP server.
 */
export function initWebSocketServer(httpServer: HttpServer): WebSocketServer {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (socket: WebSocket) => {
    console.log(`[ws] Dashboard client connected. Total connected: ${wss?.clients.size ?? 1}`);

    socket.on("message", (raw: string | Buffer) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch {
        // Non-JSON or unhandled message; ignore
      }
    });

    socket.on("close", () => {
      console.log(`[ws] Dashboard client disconnected. Remaining connected: ${wss?.clients.size ?? 0}`);
    });

    socket.on("error", (err) => {
      console.error("[ws] Client connection error:", err);
    });
  });

  wss.on("error", (err) => {
    console.error("[ws] WebSocket server error:", err);
  });

  return wss;
}

/**
 * Returns the active WebSocketServer instance, if initialized.
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

/**
 * Broadcasts a JSON event payload to all currently connected WebSocket clients.
 */
export function broadcastEvent(event: WsEvent): void {
  if (!wss) {
    console.warn(`[ws] Cannot broadcast event "${event.type}": WebSocket server not initialized`);
    return;
  }

  const payload = JSON.stringify(event);
  let recipientCount = 0;

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      recipientCount++;
    }
  }

  console.log(`[ws] Broadcasted "${event.type}" event to ${recipientCount} client(s)`);
}

export const broadcast = broadcastEvent;

/**
 * Helper to broadcast a "paid" event.
 */
export function broadcastPaid(event: Omit<PaidEvent, "type">): void {
  broadcastEvent({
    type: "paid",
    ...event,
  });
}

/**
 * Helper to broadcast a "frozen" event.
 */
export function broadcastFrozen(event: Omit<FrozenEvent, "type">): void {
  broadcastEvent({
    type: "frozen",
    ...event,
  });
}

/**
 * Helper to broadcast a "resolved" event.
 */
export function broadcastResolved(event: Omit<ResolvedEvent, "type">): void {
  broadcastEvent({
    type: "resolved",
    ...event,
  });
}

/**
 * Gracefully shuts down the WebSocket server.
 */
export function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) {
      resolve();
      return;
    }
    wss.close(() => {
      wss = null;
      resolve();
    });
  });
}
