/**
 * EndPoint.test.ts
 *
 * Tests for the EndPoint interface, buildURL, and buildRequest helpers.
 * Mirrors Swift EndPointTests.swift behaviour.
 */

import { describe, it, expect } from "vitest";
import { buildURL, buildRequest } from "../src/EndPoint.js";
import type { EndPoint } from "../src/EndPoint.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseEndpoint: EndPoint = {
  host: "api.example.com",
  scheme: "https",
  apiPath: "/api/v1",
  path: "/users",
  method: "GET",
  header: { Authorization: "Bearer token123" },
};

// ---------------------------------------------------------------------------
// buildURL tests
// ---------------------------------------------------------------------------

describe("buildURL", () => {
  it("builds correct URL with scheme, host, apiPath and path", () => {
    const url = buildURL(baseEndpoint);
    expect(url.hostname).toBe("api.example.com");
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/api/v1/users");
  });

  it("defaults scheme to https when omitted", () => {
    const ep: EndPoint = { host: "example.com", path: "/test", method: "GET" };
    const url = buildURL(ep);
    expect(url.protocol).toBe("https:");
  });

  it("omits apiPath when not set", () => {
    const ep: EndPoint = { host: "example.com", path: "/items", method: "GET" };
    const url = buildURL(ep);
    expect(url.pathname).toBe("/items");
  });

  it("includes port in URL when specified", () => {
    const url = buildURL({ ...baseEndpoint, port: 8090 });
    expect(url.port).toBe("8090");
  });

  it("appends string query params", () => {
    const url = buildURL({ ...baseEndpoint, queryParams: { page: "1", limit: "20" } });
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("appends number query params", () => {
    const url = buildURL({ ...baseEndpoint, queryParams: { page: 2 } });
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("appends array query params as key[]", () => {
    const url = buildURL({ ...baseEndpoint, queryParams: { ids: ["1", "2", "3"] } });
    expect(url.searchParams.getAll("ids[]")).toEqual(["1", "2", "3"]);
  });

  it("appends nested-object query params as key[subKey]", () => {
    const url = buildURL({
      ...baseEndpoint,
      queryParams: { filter: { status: "active", role: "admin" } },
    });
    expect(url.searchParams.get("filter[status]")).toBe("active");
    expect(url.searchParams.get("filter[role]")).toBe("admin");
  });
});

// ---------------------------------------------------------------------------
// buildRequest tests
// ---------------------------------------------------------------------------

describe("buildRequest", () => {
  it("sets HTTP method", () => {
    const req = buildRequest(baseEndpoint);
    expect(req.method).toBe("GET");
  });

  it("sets Authorization header", () => {
    const req = buildRequest(baseEndpoint);
    expect(req.headers.get("Authorization")).toBe("Bearer token123");
  });

  it("POST with body sets Content-Type and body", async () => {
    const ep: EndPoint = {
      ...baseEndpoint,
      method: "POST",
      body: { name: "Alice" },
    };
    const req = buildRequest(ep);
    expect(req.method).toBe("POST");
    expect(req.headers.get("Content-Type")).toBe("application/json");
    const text = await req.text();
    expect(JSON.parse(text)).toEqual({ name: "Alice" });
  });

  it("respects all RequestMethod values", () => {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
    for (const method of methods) {
      const req = buildRequest({ ...baseEndpoint, method });
      expect(req.method).toBe(method);
    }
  });

  it("no body for GET", () => {
    const req = buildRequest(baseEndpoint);
    expect(req.body).toBeNull();
  });
});
