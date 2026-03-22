// ============================================================
// Buntron - WebSocket IPC Server
// ============================================================
// Handles IPC communication between main Bun process and
// renderer processes running in WebView2 instances.
// ============================================================

import { EventEmitter } from "events";
import type { Server, ServerWebSocket } from "bun";
import type { IPCMessage } from "../native/types";
import {
  deserializeMessage,
  serializeMessage,
  createReplyMessage,
  createEventMessage,
  INTERNAL_CHANNELS,
} from "./protocol";

interface WSData {
  windowId: number;
  authenticated: boolean;
}

export class IPCWebSocketServer extends EventEmitter {
  private server: Server | null = null;
  private clients: Map<number, ServerWebSocket<WSData>> = new Map();
  private port: number = 0;
  private token: string;
  private handlers: Map<string, (event: any, ...args: any[]) => any> =
    new Map();
  private onceHandlers: Map<
    string,
    Array<(event: any, ...args: any[]) => any>
  > = new Map();

  constructor() {
    super();
    // Generate a random auth token for security
    this.token = crypto.randomUUID();
  }

  /**
   * Start the WebSocket server on a random available port
   */
  async start(): Promise<number> {
    const self = this;

    this.server = Bun.serve<WSData>({
      port: 0, // Random available port
      fetch(req, server) {
        // Only accept WebSocket upgrades
        const url = new URL(req.url);
        if (url.pathname === "/buntron-ipc") {
          const tokenParam = url.searchParams.get("token");
          if (tokenParam !== self.token) {
            return new Response("Unauthorized", { status: 401 });
          }

          const windowId = parseInt(url.searchParams.get("windowId") || "0");
          const upgraded = server.upgrade(req, {
            data: { windowId, authenticated: true },
          });
          if (upgraded) return undefined;
          return new Response("WebSocket upgrade failed", { status: 500 });
        }
        return new Response("Buntron IPC Server", { status: 200 });
      },
      websocket: {
        open(ws) {
          self.clients.set(ws.data.windowId, ws);
          self.emit("client-connected", ws.data.windowId);

          // Send handshake
          ws.send(
            serializeMessage(
              createEventMessage(INTERNAL_CHANNELS.HANDSHAKE, {
                windowId: ws.data.windowId,
              }),
            ),
          );
        },
        message(ws, message) {
          const data =
            typeof message === "string"
              ? message
              : new TextDecoder().decode(message);
          const msg = deserializeMessage(data);
          if (!msg) return;

          msg.senderId = ws.data.windowId;
          self.handleMessage(ws, msg);
        },
        close(ws) {
          self.clients.delete(ws.data.windowId);
          self.emit("client-disconnected", ws.data.windowId);
        },
        drain(ws) {},
      },
    });

    this.port = this.server.port;
    return this.port;
  }

  /**
   * Stop the IPC server
   */
  stop(): void {
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
    this.clients.clear();
    this.handlers.clear();
    this.onceHandlers.clear();
  }

  /**
   * Get connection URL for a specific window
   */
  getConnectionUrl(windowId: number): string {
    return `ws://127.0.0.1:${this.port}/buntron-ipc?token=${this.token}&windowId=${windowId}`;
  }

  /**
   * Get auth token
   */
  getToken(): string {
    return this.token;
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Register an IPC handler for a channel (for ipcMain.handle)
   */
  handle(channel: string, handler: (event: any, ...args: any[]) => any): void {
    this.handlers.set(channel, handler);
  }

  /**
   * Remove an IPC handler
   */
  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /**
   * Register a one-time IPC listener
   */
  handleOnce(
    channel: string,
    handler: (event: any, ...args: any[]) => any,
  ): void {
    if (!this.onceHandlers.has(channel)) {
      this.onceHandlers.set(channel, []);
    }
    this.onceHandlers.get(channel)!.push(handler);
  }

  /**
   * Send a message to a specific renderer window
   */
  sendToWindow(windowId: number, channel: string, ...args: any[]): void {
    const client = this.clients.get(windowId);
    if (client) {
      client.send(serializeMessage(createEventMessage(channel, ...args)));
    }
  }

  /**
   * Send a message to all renderer windows
   */
  sendToAll(channel: string, ...args: any[]): void {
    const msg = serializeMessage(createEventMessage(channel, ...args));
    for (const client of this.clients.values()) {
      client.send(msg);
    }
  }

  /**
   * Check if a window is connected
   */
  isConnected(windowId: number): boolean {
    return this.clients.has(windowId);
  }

  /**
   * Get connected window IDs
   */
  getConnectedWindows(): number[] {
    return Array.from(this.clients.keys());
  }

  // ---- Private ----

  private async handleMessage(
    ws: ServerWebSocket<WSData>,
    msg: IPCMessage,
  ): Promise<void> {
    const { channel, type, args, id, senderId } = msg;

    const ipcEvent = {
      sender: {
        id: senderId || ws.data.windowId,
        send: (ch: string, ...a: any[]) =>
          this.sendToWindow(ws.data.windowId, ch, ...a),
      },
      reply: (ch: string, ...a: any[]) =>
        this.sendToWindow(ws.data.windowId, ch, ...a),
      returnValue: undefined as any,
    };

    if (type === "send") {
      // Fire event on ipcMain
      this.emit(`ipc:${channel}`, ipcEvent, ...args);
      this.emit("ipc-message", channel, ipcEvent, ...args);
    } else if (type === "invoke") {
      // Handle invoke (request-response)
      const handler = this.handlers.get(channel);

      // Check once handlers
      const onceList = this.onceHandlers.get(channel);
      const onceHandler = onceList?.shift();
      if (onceList?.length === 0) this.onceHandlers.delete(channel);

      const activeHandler = handler || onceHandler;

      if (activeHandler) {
        try {
          const result = await activeHandler(ipcEvent, ...args);
          ws.send(serializeMessage(createReplyMessage(id, result)));
        } catch (err) {
          ws.send(
            serializeMessage(
              createReplyMessage(id, null, (err as Error).message),
            ),
          );
        }
      } else {
        ws.send(
          serializeMessage(
            createReplyMessage(id, null, `No handler for channel: ${channel}`),
          ),
        );
      }
    }
  }
}

export default IPCWebSocketServer;
