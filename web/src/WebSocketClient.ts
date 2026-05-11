/**
 * WebSocketClient.ts — NetKit Web
 *
 * Native WebSocket wrapper mirroring Swift NetKit's `WebSocketClient` actor.
 * No auto-reconnect in this version (deferred, matching the task spec).
 *
 * State machine: disconnected → connecting → connected → disconnected
 */

import { NetworkError } from "./NetworkError.js";

// ---------------------------------------------------------------------------
// Message type — mirrors Swift `WebSocketMessage`
// ---------------------------------------------------------------------------

export type WebSocketMessageKind = "text" | "data";

export interface TextMessage {
  readonly kind: "text";
  readonly value: string;
}

export interface DataMessage {
  readonly kind: "data";
  readonly value: ArrayBuffer;
}

/** Mirrors Swift `WebSocketMessage` enum. */
export type WebSocketMessage = TextMessage | DataMessage;

// Convenience constructors
export const WebSocketMessage = {
  text(value: string): TextMessage {
    return { kind: "text", value };
  },
  data(value: ArrayBuffer): DataMessage {
    return { kind: "data", value };
  },
} as const;

// ---------------------------------------------------------------------------
// Connection state — mirrors Swift `WebSocketState`
// ---------------------------------------------------------------------------

export type WebSocketState =
  | { readonly kind: "disconnected" }
  | { readonly kind: "connecting" }
  | { readonly kind: "connected" }
  | { readonly kind: "reconnecting"; readonly attempt: number };

export const WebSocketState = {
  disconnected: { kind: "disconnected" } as const,
  connecting: { kind: "connecting" } as const,
  connected: { kind: "connected" } as const,
  reconnecting: (attempt: number) => ({ kind: "reconnecting", attempt }) as const,
} as const;

// ---------------------------------------------------------------------------
// Listener types
// ---------------------------------------------------------------------------

export type MessageListener = (message: WebSocketMessage) => void;
export type ErrorListener = (error: NetworkError) => void;
export type StateChangeListener = (state: WebSocketState) => void;

// ---------------------------------------------------------------------------
// WebSocketClientOptions
// ---------------------------------------------------------------------------

export interface WebSocketClientOptions {
  /** Protocols forwarded to the native `WebSocket` constructor. */
  protocols?: string | string[];
  /**
   * Override the `WebSocket` constructor (for testing with mock WS servers).
   */
  webSocketImpl?: typeof WebSocket;
}

// ---------------------------------------------------------------------------
// WebSocketClient
// ---------------------------------------------------------------------------

/**
 * Native WebSocket wrapper.  Mirrors Swift `WebSocketClient`.
 *
 * Auto-reconnect is NOT implemented (deferred per spec).
 *
 * ```ts
 * const ws = new WebSocketClient("wss://example.com/ws");
 * ws.onMessage = (msg) => console.log(msg);
 * await ws.connect();
 * await ws.send(WebSocketMessage.text('{"event":"ping"}'));
 * ws.disconnect();
 * ```
 */
export class WebSocketClient {
  private readonly url: string;
  private readonly protocols: string | string[] | undefined;
  private readonly WebSocketCtor: typeof WebSocket;

  private socket: WebSocket | null = null;
  private _state: WebSocketState = WebSocketState.disconnected;

  // -------------------------------------------------------------------------
  // Event listeners (direct assignment pattern — simpler than EventTarget)
  // -------------------------------------------------------------------------

  /** Called for every inbound message. */
  onMessage: MessageListener | null = null;
  /** Called when a `NetworkError` occurs. */
  onError: ErrorListener | null = null;
  /** Called whenever the connection state changes. */
  onStateChange: StateChangeListener | null = null;

  constructor(url: string, options: WebSocketClientOptions = {}) {
    this.url = url;
    this.protocols = options.protocols;
    this.WebSocketCtor = options.webSocketImpl ?? globalThis.WebSocket;
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  get state(): WebSocketState {
    return this._state;
  }

  private setState(s: WebSocketState): void {
    this._state = s;
    this.onStateChange?.(s);
  }

  // -------------------------------------------------------------------------
  // connect — mirrors Swift `WebSocketClient.connect()`
  // -------------------------------------------------------------------------

  /**
   * Opens the WebSocket connection.
   *
   * Returns a Promise that resolves once the socket is open (or rejects on
   * immediate failure).
   */
  connect(): Promise<void> {
    if (this._state.kind === "connected" || this._state.kind === "connecting") {
      return Promise.resolve();
    }

    this.setState(WebSocketState.connecting);

    return new Promise<void>((resolve, reject) => {
      const ws = new this.WebSocketCtor(
        this.url,
        this.protocols as string | string[] | undefined,
      );

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        this.socket = ws;
        this.setState(WebSocketState.connected);
        resolve();
      };

      ws.onmessage = (event: MessageEvent) => {
        let message: WebSocketMessage;
        if (typeof event.data === "string") {
          message = WebSocketMessage.text(event.data);
        } else {
          message = WebSocketMessage.data(event.data as ArrayBuffer);
        }
        this.onMessage?.(message);
      };

      ws.onerror = () => {
        const err = NetworkError.wsError("WebSocket error");
        this.onError?.(err);
        if (this._state.kind === "connecting") {
          this.setState(WebSocketState.disconnected);
          reject(err);
        }
      };

      ws.onclose = (_event: CloseEvent) => {
        this.socket = null;
        this.setState(WebSocketState.disconnected);
      };
    });
  }

  // -------------------------------------------------------------------------
  // disconnect — mirrors Swift `WebSocketClient.disconnect()`
  // -------------------------------------------------------------------------

  /** Gracefully closes the connection. */
  disconnect(): void {
    if (this.socket == null) return;
    this.socket.close(1000, "Normal closure");
    this.socket = null;
    this.setState(WebSocketState.disconnected);
  }

  // -------------------------------------------------------------------------
  // send — mirrors Swift `WebSocketClient.send(_:)`
  // -------------------------------------------------------------------------

  /** Sends a message.  Throws `NetworkError.wsError` if not connected. */
  send(message: WebSocketMessage): void {
    if (this.socket == null || this._state.kind !== "connected") {
      throw NetworkError.wsError("Not connected");
    }
    if (message.kind === "text") {
      this.socket.send(message.value);
    } else {
      this.socket.send(message.value);
    }
  }

  /** Convenience: send a text string. */
  sendText(text: string): void {
    this.send(WebSocketMessage.text(text));
  }

  /** Convenience: send raw binary data. */
  sendData(data: ArrayBuffer): void {
    this.send(WebSocketMessage.data(data));
  }
}
