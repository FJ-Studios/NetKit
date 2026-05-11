/**
 * WebSocketClient.test.ts
 *
 * Unit tests for WebSocketClient using a mock WebSocket constructor.
 * Tests state transitions, send/receive, error handling, and disconnect.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocketClient, WebSocketMessage, WebSocketState } from "../src/WebSocketClient.js";
import { NetworkError } from "../src/NetworkError.js";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WsEventName = "open" | "message" | "error" | "close";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  binaryType: string = "arraybuffer";

  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  closeCode: number | undefined;
  closeReason: string | undefined;
  sentMessages: (string | ArrayBuffer)[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCode = code;
    this.closeReason = reason;
    this.onclose?.(new CloseEvent("close", { code: code ?? 1000, reason }));
  }

  // Test helpers — simulate server events
  simulateOpen(): void {
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: string | ArrayBuffer): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  simulateError(): void {
    this.onerror?.(new Event("error"));
  }

  simulateClose(code = 1000, reason = ""): void {
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }
}

function mockWebSocketImpl(url: string): MockWebSocket {
  return new MockWebSocket(url);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  MockWebSocket.instances = [];
});

describe("WebSocketClient — state transitions", () => {
  it("starts in disconnected state", () => {
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    expect(ws.state.kind).toBe("disconnected");
  });

  it("transitions to connecting then connected on open", async () => {
    const states: string[] = [];
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    ws.onStateChange = (s) => states.push(s.kind);

    const connectPromise = ws.connect();
    MockWebSocket.instances[0]!.simulateOpen();
    await connectPromise;

    expect(states).toContain("connecting");
    expect(states).toContain("connected");
    expect(ws.state.kind).toBe("connected");
  });

  it("transitions to disconnected after disconnect()", async () => {
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    const connectPromise = ws.connect();
    MockWebSocket.instances[0]!.simulateOpen();
    await connectPromise;

    ws.disconnect();
    expect(ws.state.kind).toBe("disconnected");
  });

  it("onStateChange fires for each transition", async () => {
    const states: string[] = [];
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    ws.onStateChange = (s) => states.push(s.kind);

    const connectPromise = ws.connect();
    MockWebSocket.instances[0]!.simulateOpen();
    await connectPromise;
    ws.disconnect();

    expect(states).toEqual(["connecting", "connected", "disconnected"]);
  });
});

describe("WebSocketClient — send/receive", () => {
  it("onMessage fires for text messages", async () => {
    const received: string[] = [];
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    ws.onMessage = (msg) => {
      if (msg.kind === "text") received.push(msg.value);
    };

    const connectPromise = ws.connect();
    const mock = MockWebSocket.instances[0]!;
    mock.simulateOpen();
    await connectPromise;

    mock.simulateMessage('{"event":"ping"}');
    expect(received).toEqual(['{"event":"ping"}']);
  });

  it("onMessage fires for binary messages", async () => {
    const received: ArrayBuffer[] = [];
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    ws.onMessage = (msg) => {
      if (msg.kind === "data") received.push(msg.value);
    };

    const connectPromise = ws.connect();
    const mock = MockWebSocket.instances[0]!;
    mock.simulateOpen();
    await connectPromise;

    const buf = new ArrayBuffer(4);
    mock.simulateMessage(buf);
    expect(received).toHaveLength(1);
  });

  it("sendText sends string through socket", async () => {
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    const connectPromise = ws.connect();
    const mock = MockWebSocket.instances[0]!;
    mock.simulateOpen();
    await connectPromise;

    ws.sendText("hello");
    expect(mock.sentMessages).toEqual(["hello"]);
  });

  it("send throws wsError when not connected", () => {
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    expect(() => ws.send(WebSocketMessage.text("hi"))).toThrow(NetworkError);
  });
});

describe("WebSocketClient — error handling", () => {
  it("onError fires and rejects connect() on socket error", async () => {
    const errors: NetworkError[] = [];
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    ws.onError = (e) => errors.push(e);

    const connectPromise = ws.connect();
    MockWebSocket.instances[0]!.simulateError();

    await expect(connectPromise).rejects.toBeInstanceOf(NetworkError);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.is("wsError")).toBe(true);
  });

  it("double connect() resolves immediately if already connected", async () => {
    const ws = new WebSocketClient("wss://example.com", {
      webSocketImpl: mockWebSocketImpl as unknown as typeof WebSocket,
    });
    const p1 = ws.connect();
    MockWebSocket.instances[0]!.simulateOpen();
    await p1;

    // Second connect should resolve immediately
    await expect(ws.connect()).resolves.toBeUndefined();
  });
});

describe("WebSocketClient — WebSocketMessage helpers", () => {
  it("WebSocketMessage.text factory sets kind and value", () => {
    const msg = WebSocketMessage.text("hello");
    expect(msg.kind).toBe("text");
    expect(msg.value).toBe("hello");
  });

  it("WebSocketMessage.data factory sets kind and value", () => {
    const buf = new ArrayBuffer(8);
    const msg = WebSocketMessage.data(buf);
    expect(msg.kind).toBe("data");
    expect(msg.value).toBe(buf);
  });
});

describe("WebSocketClient — WebSocketState helpers", () => {
  it("disconnected constant", () => {
    expect(WebSocketState.disconnected.kind).toBe("disconnected");
  });

  it("reconnecting carries attempt number", () => {
    const s = WebSocketState.reconnecting(3);
    expect(s.kind).toBe("reconnecting");
    expect(s.attempt).toBe(3);
  });
});
