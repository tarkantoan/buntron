// ============================================================
// Buntron - Host Process Manager
// ============================================================
// Manages the lifecycle of the C# WebView2 host process.
// Handles communication via stdin/stdout JSON protocol.
// ============================================================

import { Subprocess } from "bun";
import { ensureHost, getHostExePath } from "./compiler";
import { EventEmitter } from "events";
import type { HostCommand, HostEvent } from "../native/types";

export class HostProcessManager extends EventEmitter {
  private process: Subprocess | null = null;
  private buntronRoot: string;
  private userDataFolder: string;
  private requestId: number = 0;
  private pendingRequests: Map<
    number,
    { resolve: Function; reject: Function; timeout: Timer }
  > = new Map();
  private isReady: boolean = false;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;
  private buffer: string = "";
  private shutdownCalled: boolean = false;

  constructor(buntronRoot: string, userDataFolder?: string) {
    super();
    this.buntronRoot = buntronRoot;
    this.userDataFolder =
      userDataFolder ||
      require("path").join(
        process.env.LOCALAPPDATA || process.env.APPDATA || "",
        "Buntron",
        "WebView2Data",
      );

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  /**
   * Start the host process
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error("Host process already running");
    }

    const hostExe = await ensureHost(this.buntronRoot);

    this.process = Bun.spawn([hostExe, this.userDataFolder], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      onExit: (proc, exitCode, signalCode) => {
        this.isReady = false;
        this.process = null;
        this.emit("exit", exitCode, signalCode);

        // Reject all pending requests
        for (const [id, req] of this.pendingRequests) {
          clearTimeout(req.timeout);
          req.reject(new Error("Host process exited"));
        }
        this.pendingRequests.clear();
      },
    });

    // Read stdout for events
    this.readStdout();

    // Read stderr for errors
    this.readStderr();

    // Wait for ready event with timeout
    const timeout = setTimeout(() => {
      this.readyReject(new Error("Host process startup timeout (10s)"));
    }, 10000);

    try {
      await this.readyPromise;
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      this.kill();
      throw err;
    }
  }

  /**
   * Send a command to the host process
   */
  async sendCommand(
    cmd: string,
    params: Record<string, any> = {},
  ): Promise<any> {
    if (!this.process || !this.isReady) {
      throw new Error("Host process not ready");
    }

    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Command '${cmd}' timed out (30s)`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const command: HostCommand = { id, cmd, params };
      const line = JSON.stringify(command) + "\n";

      try {
        this.process!.stdin.write(line);
        this.process!.stdin.flush();
      } catch (err) {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(new Error(`Failed to send command: ${(err as Error).message}`));
      }
    });
  }

  /**
   * Send a command without waiting for reply
   */
  sendCommandFire(cmd: string, params: Record<string, any> = {}): void {
    if (!this.process || !this.isReady) return;

    const id = ++this.requestId;
    const command: HostCommand = { id, cmd, params };
    const line = JSON.stringify(command) + "\n";

    try {
      this.process.stdin.write(line);
      this.process.stdin.flush();
    } catch {}
  }

  /**
   * Gracefully shut down the host process
   */
  async shutdown(): Promise<void> {
    if (this.shutdownCalled) return;
    this.shutdownCalled = true;

    if (this.process && this.isReady) {
      try {
        const command: HostCommand = {
          id: ++this.requestId,
          cmd: "quit",
          params: {},
        };
        this.process.stdin.write(JSON.stringify(command) + "\n");
        this.process.stdin.flush();

        // Wait for process to exit (max 5s)
        await Promise.race([
          new Promise<void>((resolve) => {
            this.once("exit", () => resolve());
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);
      } catch {}
    }

    this.kill();
  }

  /**
   * Force kill the host process
   */
  kill(): void {
    if (this.process) {
      try {
        this.process.kill();
      } catch {}
      this.process = null;
    }
    this.isReady = false;
  }

  /**
   * Check if host is running
   */
  get running(): boolean {
    return this.process !== null && this.isReady;
  }

  // ---- Private methods ----

  private async readStdout(): Promise<void> {
    if (!this.process?.stdout) return;

    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        this.buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let newlineIdx: number;
        while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
          const line = this.buffer.substring(0, newlineIdx).trim();
          this.buffer = this.buffer.substring(newlineIdx + 1);

          if (line) {
            this.processMessage(line);
          }
        }
      }
    } catch (err) {
      // Stream ended
    }
  }

  private async readStderr(): Promise<void> {
    if (!this.process?.stderr) return;

    const reader = this.process.stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text.trim()) {
          this.emit("stderr", text);
        }
      }
    } catch {}
  }

  private processMessage(line: string): void {
    let msg: HostEvent;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    const event = msg.event;

    // Handle ready event
    if (event === "ready") {
      this.isReady = true;
      this.readyResolve();
      this.emit("ready");
      return;
    }

    // Handle reply events (responses to commands)
    if (event === "reply" && msg.requestId !== undefined) {
      const pending = this.pendingRequests.get(msg.requestId!);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.requestId!);
        pending.resolve(msg.data || msg);
      }
      return;
    }

    // Handle error events
    if (event === "error") {
      const requestId = (msg as any).requestId;
      if (requestId !== undefined && requestId >= 0) {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          pending.reject(new Error((msg as any).message || "Host error"));
          return;
        }
      }
      this.emit("error", new Error((msg as any).message || "Host error"));
      return;
    }

    // Emit all other events
    this.emit("host-event", msg);
    this.emit(event, msg);
  }
}

export default HostProcessManager;
