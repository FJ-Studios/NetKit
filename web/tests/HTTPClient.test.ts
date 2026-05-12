/**
 * HTTPClient.test.ts
 *
 * vitest + msw tests for HTTPClient: happy path, status-code errors,
 * JSON decode failure, timeout, and retry behaviour.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse, delay as mswDelay } from "msw";
import { setupServer } from "msw/node";
import { HTTPClient } from "../src/HTTPClient.js";
import { NetworkError } from "../src/NetworkError.js";
import type { EndPoint } from "../src/EndPoint.js";

// ---------------------------------------------------------------------------
// MSW server setup
// ---------------------------------------------------------------------------

const BASE = "https://api.test.local";

interface User {
  id: number;
  name: string;
}

const handlers = [
  http.get(`${BASE}/users`, () =>
    HttpResponse.json([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]),
  ),
  http.post(`${BASE}/users`, () =>
    HttpResponse.json({ id: 3, name: "Charlie" }, { status: 201 }),
  ),
  http.get(`${BASE}/not-found`, () =>
    HttpResponse.json({ message: "not found" }, { status: 404 }),
  ),
  http.get(`${BASE}/server-error`, () =>
    HttpResponse.json({ message: "oops" }, { status: 500 }),
  ),
  http.get(`${BASE}/bad-json`, () =>
    new HttpResponse("this is not json", { status: 200, headers: { "Content-Type": "text/plain" } }),
  ),
  http.get(`${BASE}/timeout`, async () => {
    await mswDelay("infinite");
    return HttpResponse.json({});
  }),
  http.get(`${BASE}/no-content`, () => new HttpResponse(null, { status: 204 })),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ep(path: string, method: EndPoint["method"] = "GET", body?: Record<string, unknown>): EndPoint {
  return { host: "api.test.local", scheme: "https", path, method, body };
}

const client = new HTTPClient({ timeoutMs: 3_000, retry: { maxAttempts: 1 } });

// ---------------------------------------------------------------------------
// Happy-path tests
// ---------------------------------------------------------------------------

describe("HTTPClient — happy path", () => {
  it("GET /users returns decoded array", async () => {
    const users = await client.sendRequest<User[]>(ep("/users"));
    expect(users).toHaveLength(2);
    expect(users[0]?.name).toBe("Alice");
  });

  it("POST /users returns 201 decoded body", async () => {
    const user = await client.sendRequest<User>(ep("/users", "POST", { name: "Charlie" }));
    expect(user.id).toBe(3);
    expect(user.name).toBe("Charlie");
  });

  it("204 No Content returns undefined without throwing", async () => {
    const result = await client.sendRequest<undefined>(ep("/no-content"));
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Error-path tests
// ---------------------------------------------------------------------------

describe("HTTPClient — errors", () => {
  it("404 throws NetworkError.unexpectedStatusCode(404)", async () => {
    await expect(client.sendRequest(ep("/not-found"))).rejects.toSatisfy(
      (e: unknown) => e instanceof NetworkError && e.is("unexpectedStatusCode") && (e.variant as { statusCode: number }).statusCode === 404,
    );
  });

  it("500 throws unexpectedStatusCode(500)", async () => {
    await expect(client.sendRequest(ep("/server-error"))).rejects.toSatisfy(
      (e: unknown) => e instanceof NetworkError && e.is("unexpectedStatusCode"),
    );
  });

  it("bad JSON body throws jsonParsingFailed", async () => {
    await expect(client.sendRequest(ep("/bad-json"))).rejects.toSatisfy(
      (e: unknown) => e instanceof NetworkError && e.is("jsonParsingFailed"),
    );
  });
});

// ---------------------------------------------------------------------------
// Timeout test
// ---------------------------------------------------------------------------

describe("HTTPClient — timeout", () => {
  it("timeout throws requestFailed with 'timed out'", async () => {
    const shortClient = new HTTPClient({ timeoutMs: 50, retry: { maxAttempts: 1 } });
    await expect(shortClient.sendRequest(ep("/timeout"))).rejects.toSatisfy(
      (e: unknown) => e instanceof NetworkError && e.is("requestFailed"),
    );
  });
});

// ---------------------------------------------------------------------------
// Retry tests
// ---------------------------------------------------------------------------

describe("HTTPClient — retry", () => {
  it("retries on 500 and succeeds on second attempt", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/flaky`, () => {
        callCount += 1;
        if (callCount < 2) {
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }
        return HttpResponse.json({ id: 42 });
      }),
    );

    const retryClient = new HTTPClient({
      timeoutMs: 3_000,
      retry: { maxAttempts: 3, baseDelayMs: 0 },
    });
    const result = await retryClient.sendRequest<{ id: number }>(ep("/flaky"));
    expect(result.id).toBe(42);
    expect(callCount).toBe(2);
  });

  it("exhausts retries and throws after maxAttempts", async () => {
    server.use(
      http.get(`${BASE}/always-500`, () =>
        HttpResponse.json({ error: "server error" }, { status: 500 }),
      ),
    );

    const retryClient = new HTTPClient({
      timeoutMs: 3_000,
      retry: { maxAttempts: 2, baseDelayMs: 0 },
    });
    await expect(retryClient.sendRequest(ep("/always-500"))).rejects.toBeInstanceOf(NetworkError);
  });

  it("does not retry 404 (non-retryable)", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/four-oh-four`, () => {
        callCount += 1;
        return HttpResponse.json({}, { status: 404 });
      }),
    );

    const retryClient = new HTTPClient({
      retry: { maxAttempts: 3, baseDelayMs: 0 },
    });
    await expect(retryClient.sendRequest(ep("/four-oh-four"))).rejects.toBeInstanceOf(NetworkError);
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Default headers
// ---------------------------------------------------------------------------

describe("HTTPClient — default headers", () => {
  it("merges defaultHeaders with endpoint headers", async () => {
    let capturedHeaders: Headers | null = null;
    server.use(
      http.get(`${BASE}/check-headers`, ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({});
      }),
    );

    const headerClient = new HTTPClient({
      defaultHeaders: { "X-Client": "netkit-web" },
      retry: { maxAttempts: 1 },
    });
    await headerClient.sendRequest(ep("/check-headers"));
    expect(capturedHeaders?.get("x-client")).toBe("netkit-web");
  });
});
