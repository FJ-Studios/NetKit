/**
 * WebSocketClient.ts — NetKit Web
 *
 * Native WebSocket wrapper mirroring Swift NetKit's `WebSocketClient` actor.
 * No auto-reconnect in this version (deferred, matching the task spec).
 *
 * State machine: disconnected → connecting → connected → disconnected
 */
import { NetworkError } from "./NetworkError.js";
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
export declare const WebSocketMessage: {
    readonly text: (value: string) => TextMessage;
    readonly data: (value: ArrayBuffer) => DataMessage;
};
export type WebSocketState = {
    readonly kind: "disconnected";
} | {
    readonly kind: "connecting";
} | {
    readonly kind: "connected";
} | {
    readonly kind: "reconnecting";
    readonly attempt: number;
};
export declare const WebSocketState: {
    readonly disconnected: {
        readonly kind: "disconnected";
    };
    readonly connecting: {
        readonly kind: "connecting";
    };
    readonly connected: {
        readonly kind: "connected";
    };
    readonly reconnecting: (attempt: number) => {
        readonly kind: "reconnecting";
        readonly attempt: number;
    };
};
export type MessageListener = (message: WebSocketMessage) => void;
export type ErrorListener = (error: NetworkError) => void;
export type StateChangeListener = (state: WebSocketState) => void;
export interface WebSocketClientOptions {
    /** Protocols forwarded to the native `WebSocket` constructor. */
    protocols?: string | string[];
    /**
     * Override the `WebSocket` constructor (for testing with mock WS servers).
     */
    webSocketImpl?: typeof WebSocket;
}
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
export declare class WebSocketClient {
    private readonly url;
    private readonly protocols;
    private readonly WebSocketCtor;
    private socket;
    private _state;
    /** Called for every inbound message. */
    onMessage: MessageListener | null;
    /** Called when a `NetworkError` occurs. */
    onError: ErrorListener | null;
    /** Called whenever the connection state changes. */
    onStateChange: StateChangeListener | null;
    constructor(url: string, options?: WebSocketClientOptions);
    get state(): WebSocketState;
    private setState;
    /**
     * Opens the WebSocket connection.
     *
     * Returns a Promise that resolves once the socket is open (or rejects on
     * immediate failure).
     */
    connect(): Promise<void>;
    /** Gracefully closes the connection. */
    disconnect(): void;
    /** Sends a message.  Throws `NetworkError.wsError` if not connected. */
    send(message: WebSocketMessage): void;
    /** Convenience: send a text string. */
    sendText(text: string): void;
    /** Convenience: send raw binary data. */
    sendData(data: ArrayBuffer): void;
}
