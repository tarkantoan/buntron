// ============================================================
// Buntron - IPC Protocol Definition
// ============================================================

import type { IPCMessage } from "../native/types";

let _nextId = 0;

/**
 * Create a new IPC message ID
 */
export function nextMessageId(): number {
  return ++_nextId;
}

/**
 * Create a 'send' message (fire-and-forget)
 */
export function createSendMessage(channel: string, ...args: any[]): IPCMessage {
  return {
    id: nextMessageId(),
    channel,
    args,
    type: "send",
  };
}

/**
 * Create an 'invoke' message (request-response)
 */
export function createInvokeMessage(
  channel: string,
  ...args: any[]
): IPCMessage {
  return {
    id: nextMessageId(),
    channel,
    args,
    type: "invoke",
  };
}

/**
 * Create a reply message
 */
export function createReplyMessage(
  requestId: number,
  result: any,
  error?: string,
): IPCMessage {
  return {
    id: requestId,
    channel: "__reply__",
    args: [result],
    type: "reply",
    error,
  };
}

/**
 * Create an event message (broadcast)
 */
export function createEventMessage(
  channel: string,
  ...args: any[]
): IPCMessage {
  return {
    id: nextMessageId(),
    channel,
    args,
    type: "event",
  };
}

/**
 * Serialize IPC message to JSON string
 */
export function serializeMessage(msg: IPCMessage): string {
  return JSON.stringify(msg);
}

/**
 * Deserialize JSON string to IPC message
 */
export function deserializeMessage(data: string): IPCMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (
      parsed &&
      typeof parsed.channel === "string" &&
      typeof parsed.type === "string"
    ) {
      return parsed as IPCMessage;
    }
  } catch {}
  return null;
}

/**
 * IPC channel name validation
 */
export function isValidChannel(channel: string): boolean {
  return (
    typeof channel === "string" &&
    channel.length > 0 &&
    !channel.startsWith("__")
  );
}

/**
 * Reserved internal channels
 */
export const INTERNAL_CHANNELS = {
  REPLY: "__reply__",
  HANDSHAKE: "__handshake__",
  PING: "__ping__",
  PONG: "__pong__",
  WINDOW_ID: "__window_id__",
  READY: "__ready__",
} as const;
