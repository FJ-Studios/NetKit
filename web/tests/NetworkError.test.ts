/**
 * NetworkError.test.ts
 *
 * Taxonomy + serialise round-trip tests for the NetworkError discriminated union.
 */

import { describe, it, expect } from "vitest";
import { NetworkError } from "../src/NetworkError.js";

// ---------------------------------------------------------------------------
// Factory / kind tests
// ---------------------------------------------------------------------------

describe("NetworkError — taxonomy", () => {
  it("requestFailed has correct kind and description", () => {
    const err = NetworkError.requestFailed("timeout");
    expect(err.variant.kind).toBe("requestFailed");
    expect(err.description).toBe("Request failed: timeout");
    expect(err).toBeInstanceOf(NetworkError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("NetworkError");
  });

  it("unexpectedStatusCode carries status code", () => {
    const err = NetworkError.unexpectedStatusCode(404);
    expect(err.variant.kind).toBe("unexpectedStatusCode");
    expect(err.description).toBe("Invalid status code: 404");
    if (err.is("unexpectedStatusCode")) {
      expect(err.variant.statusCode).toBe(404);
      expect(err.variant.headers).toBeUndefined();
    }
  });

  it("unexpectedStatusCode with headers", () => {
    const err = NetworkError.unexpectedStatusCode(500, "Content-Type: application/json");
    expect(err.description).toBe("Invalid status code: 500");
    if (err.is("unexpectedStatusCode")) {
      expect(err.variant.headers).toBe("Content-Type: application/json");
    }
  });

  it("invalidData description matches Swift", () => {
    const err = NetworkError.invalidData();
    expect(err.variant.kind).toBe("invalidData");
    expect(err.description).toBe("Invalid data");
  });

  it("jsonParsingFailed wraps cause", () => {
    const cause = new SyntaxError("Unexpected token");
    const err = NetworkError.jsonParsingFailed(cause);
    expect(err.variant.kind).toBe("jsonParsingFailed");
    expect(err.description).toContain("Failed to parse JSON");
    if (err.is("jsonParsingFailed")) {
      expect(err.variant.cause).toBe(cause);
    }
  });

  it("wsError carries description", () => {
    const err = NetworkError.wsError("Socket closed");
    expect(err.variant.kind).toBe("wsError");
    expect(err.description).toBe("WebSocket error: Socket closed");
  });

  it("unknown wraps arbitrary error", () => {
    const cause = new Error("mystery");
    const err = NetworkError.unknown(cause);
    expect(err.variant.kind).toBe("unknown");
    expect(err.description).toContain("An unknown error occurred");
  });

  it("is() type-narrows correctly", () => {
    const err = NetworkError.unexpectedStatusCode(403);
    expect(err.is("unexpectedStatusCode")).toBe(true);
    expect(err.is("requestFailed")).toBe(false);
    expect(err.is("wsError")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Serialise round-trip
// ---------------------------------------------------------------------------

describe("NetworkError — JSON round-trip", () => {
  const cases: Array<NetworkError> = [
    NetworkError.requestFailed("Connection refused"),
    NetworkError.unexpectedStatusCode(422, "X-Request-Id: abc"),
    NetworkError.invalidData(),
    NetworkError.jsonParsingFailed("bad token"),
    NetworkError.wsError("Abnormal closure"),
    NetworkError.unknown("something weird"),
  ];

  for (const original of cases) {
    it(`round-trips ${original.variant.kind}`, () => {
      const json = original.toJSON();
      expect(json["kind"]).toBe(original.variant.kind);

      const restored = NetworkError.fromJSON(json);
      expect(restored.variant.kind).toBe(original.variant.kind);
      expect(restored.description).toBe(original.description);
    });
  }
});

// ---------------------------------------------------------------------------
// Throwable / catchable
// ---------------------------------------------------------------------------

describe("NetworkError — throwable", () => {
  it("can be thrown and caught", () => {
    expect(() => {
      throw NetworkError.requestFailed("test");
    }).toThrow(NetworkError);
  });

  it("instanceof check works after throw/catch", () => {
    try {
      throw NetworkError.unexpectedStatusCode(503);
    } catch (err) {
      expect(err instanceof NetworkError).toBe(true);
      if (err instanceof NetworkError) {
        expect(err.is("unexpectedStatusCode")).toBe(true);
      }
    }
  });
});
