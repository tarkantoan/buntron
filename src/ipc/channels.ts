// ============================================================
// Buntron - IPC Channel Management
// ============================================================

import { EventEmitter } from "events";

type ChannelHandler = (event: any, ...args: any[]) => any;

/**
 * Manages IPC channel registrations and routing
 */
export class ChannelManager extends EventEmitter {
  private handlers: Map<string, ChannelHandler> = new Map();
  private listeners: Map<string, Set<ChannelHandler>> = new Map();

  /**
   * Register a handler for invoke-style IPC calls
   */
  handle(channel: string, handler: ChannelHandler): void {
    if (this.handlers.has(channel)) {
      throw new Error(`Handler already registered for channel: ${channel}`);
    }
    this.handlers.set(channel, handler);
  }

  /**
   * Remove a handler for a channel
   */
  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /**
   * Register a listener for send-style IPC messages
   */
  onChannel(channel: string, listener: ChannelHandler): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(listener);
  }

  /**
   * Remove a listener from a channel
   */
  offChannel(channel: string, listener: ChannelHandler): void {
    this.listeners.get(channel)?.delete(listener);
  }

  /**
   * Register a one-time listener
   */
  onceChannel(channel: string, listener: ChannelHandler): void {
    const wrapper: ChannelHandler = (event, ...args) => {
      this.offChannel(channel, wrapper);
      return listener(event, ...args);
    };
    this.onChannel(channel, wrapper);
  }

  /**
   * Get handler for a channel
   */
  getHandler(channel: string): ChannelHandler | undefined {
    return this.handlers.get(channel);
  }

  /**
   * Get all listeners for a channel
   */
  getListeners(channel: string): Set<ChannelHandler> {
    return this.listeners.get(channel) || new Set();
  }

  /**
   * Check if a channel has a handler
   */
  hasHandler(channel: string): boolean {
    return this.handlers.has(channel);
  }

  /**
   * Clear all handlers and listeners
   */
  clear(): void {
    this.handlers.clear();
    this.listeners.clear();
    this.removeAllListeners();
  }

  /**
   * Get list of registered channels
   */
  getChannels(): string[] {
    const channels = new Set<string>();
    for (const ch of this.handlers.keys()) channels.add(ch);
    for (const ch of this.listeners.keys()) channels.add(ch);
    return Array.from(channels);
  }
}

export default ChannelManager;
