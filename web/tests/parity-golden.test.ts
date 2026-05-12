/**
 * parity-golden.test.ts
 *
 * Cross-language parity fixtures validating that TS symbols and behaviours
 * match the Swift NetworkKit reference implementation.
 *
 * Fixture format mirrors Swift Tests/NetworkKitTests/ behaviour so that any
 * future Swift golden outputs can be validated against the same inputs here.
 */

import { describe, it, expect } from "vitest";
import { NetworkError } from "../src/NetworkError.js";
import { buildURL, buildRequest } from "../src/EndPoint.js";
import type { EndPoint } from "../src/EndPoint.js";
import { JSONCoder } from "../src/JSONCoder.js";

// ---------------------------------------------------------------------------
// Fixture 1 — EndPoint URL construction
//
// Swift reference (EndPointTests.swift):
//   TestEndPoint { host: "api.example.com", apiPath: "/api/v1", path: "/users",
//                  method: .GET, header: ["Authorization": "Bearer token123"] }
//   → request.url.scheme == "https"
//   → request.url.host   == "api.example.com"
//   → request.url.path   == "/api/v1/users"
//   → request.httpMethod == "GET"
// ---------------------------------------------------------------------------

describe("Parity Fixture 1 — EndPoint URL construction matches Swift", () => {
  const fixture: EndPoint = {
    host: "api.example.com",
    scheme: "https",
    apiPath: "/api/v1",
    path: "/users",
    method: "GET",
    header: { Authorization: "Bearer token123" },
  };

  it("scheme is https", () => {
    expect(buildURL(fixture).protocol).toBe("https:");
  });

  it("host matches", () => {
    expect(buildURL(fixture).hostname).toBe("api.example.com");
  });

  it("pathname is apiPath + path", () => {
    expect(buildURL(fixture).pathname).toBe("/api/v1/users");
  });

  it("method is GET", () => {
    expect(buildRequest(fixture).method).toBe("GET");
  });

  it("Authorization header preserved", () => {
    expect(buildRequest(fixture).headers.get("Authorization")).toBe("Bearer token123");
  });

  it("query params: page=1 and limit=20 both present", () => {
    const url = buildURL({ ...fixture, queryParams: { page: "1", limit: "20" } });
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("custom port 8090 appears in URL", () => {
    expect(buildURL({ ...fixture, port: 8090 }).port).toBe("8090");
  });
});

// ---------------------------------------------------------------------------
// Fixture 2 — NetworkError descriptions match Swift CustomStringConvertible
//
// Swift reference (NetworkServiceTests.swift):
//   NetworkError.requestFailed(description: "timeout").description
//     == "Request failed: timeout"
//   NetworkError.unexpectedStatusCode(404).description
//     == "Invalid status code: 404"
//   NetworkError.invalidData.description
//     == "Invalid data"
// ---------------------------------------------------------------------------

describe("Parity Fixture 2 — NetworkError descriptions match Swift", () => {
  it("requestFailed description", () => {
    expect(NetworkError.requestFailed("timeout").description)
      .toBe("Request failed: timeout");
  });

  it("unexpectedStatusCode 404 description", () => {
    expect(NetworkError.unexpectedStatusCode(404).description)
      .toBe("Invalid status code: 404");
  });

  it("unexpectedStatusCode 500 description", () => {
    expect(NetworkError.unexpectedStatusCode(500).description)
      .toBe("Invalid status code: 500");
  });

  it("invalidData description", () => {
    expect(NetworkError.invalidData().description).toBe("Invalid data");
  });

  it("wsError description", () => {
    expect(NetworkError.wsError("Not connected").description)
      .toBe("WebSocket error: Not connected");
  });

  it("unknown description starts with expected prefix", () => {
    const err = NetworkError.unknown(new Error("mystery"));
    expect(err.description).toContain("An unknown error occurred");
  });
});

// ---------------------------------------------------------------------------
// Fixture 3 — JSONCoder date strategy parity
//
// Swift reference: JSONDecoder with .custom(pocketbaseDateDecodingStrategy())
// defaults to ISO 8601 — here we validate the iso8601 strategy round-trips
// to the same value and epoch strategy round-trips numeric ms.
// ---------------------------------------------------------------------------

describe("Parity Fixture 3 — JSONCoder date strategy parity", () => {
  const knownDate = new Date("2024-06-15T12:00:00.000Z");
  const knownMs = knownDate.getTime();

  describe("iso8601 strategy", () => {
    const coder = new JSONCoder({ dateEncoding: "iso8601", dateDecoding: "iso8601" });

    it("encodes to ISO string (Swift default)", () => {
      const encoded = JSON.parse(coder.encode({ ts: knownDate })) as { ts: string };
      expect(encoded.ts).toBe("2024-06-15T12:00:00.000Z");
    });

    it("round-trips Date through encode/decode", () => {
      const json = coder.encode({ ts: knownDate });
      const decoded = coder.decode<{ ts: Date }>(json, true);
      expect(decoded.ts).toBeInstanceOf(Date);
      expect(decoded.ts.toISOString()).toBe(knownDate.toISOString());
    });
  });

  describe("epoch strategy", () => {
    const coder = new JSONCoder({ dateEncoding: "epoch", dateDecoding: "epoch" });

    it("encodes to numeric epoch ms", () => {
      const encoded = JSON.parse(coder.encode({ ts: knownDate })) as { ts: number };
      expect(encoded.ts).toBe(knownMs);
    });

    it("round-trips Date through encode/decode", () => {
      const json = coder.encode({ ts: knownDate });
      const decoded = coder.decode<{ ts: Date }>(json, true);
      expect(decoded.ts).toBeInstanceOf(Date);
      expect(decoded.ts.getTime()).toBe(knownMs);
    });
  });
});
