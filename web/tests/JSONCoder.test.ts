/**
 * JSONCoder.test.ts
 *
 * Date strategy parity tests for JSONCoder (iso8601 ↔ epoch).
 */

import { describe, it, expect } from "vitest";
import { JSONCoder, defaultCoder, epochCoder } from "../src/JSONCoder.js";

// ---------------------------------------------------------------------------
// ISO 8601 strategy (default)
// ---------------------------------------------------------------------------

describe("JSONCoder — iso8601 strategy", () => {
  const coder = new JSONCoder({ dateEncoding: "iso8601", dateDecoding: "iso8601" });
  const epoch = new Date("2024-06-15T12:00:00.000Z");

  it("encodes Date as ISO string", () => {
    const json = coder.encode({ ts: epoch });
    const obj = JSON.parse(json) as { ts: string };
    expect(obj.ts).toBe("2024-06-15T12:00:00.000Z");
  });

  it("decodes ISO string back to Date with detectDates=true", () => {
    const json = JSON.stringify({ ts: "2024-06-15T12:00:00.000Z" });
    const result = coder.decode<{ ts: Date }>(json, true);
    expect(result.ts).toBeInstanceOf(Date);
    expect(result.ts.toISOString()).toBe("2024-06-15T12:00:00.000Z");
  });

  it("does NOT revive dates when detectDates=false (default)", () => {
    const json = JSON.stringify({ ts: "2024-06-15T12:00:00.000Z" });
    const result = coder.decode<{ ts: string }>(json);
    expect(typeof result.ts).toBe("string");
  });

  it("defaultCoder singleton uses iso8601", () => {
    const json = defaultCoder.encode({ ts: epoch });
    expect(json).toContain("2024-06-15T12:00:00.000Z");
  });

  it("round-trips string values unchanged", () => {
    const data = { name: "Alice", score: 42 };
    const result = coder.decode<typeof data>(coder.encode(data));
    expect(result).toEqual(data);
  });

  it("encodeToObject returns plain object with iso string", () => {
    const obj = coder.encodeToObject({ ts: epoch }) as { ts: string };
    expect(typeof obj.ts).toBe("string");
    expect(obj.ts).toBe("2024-06-15T12:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Epoch strategy
// ---------------------------------------------------------------------------

describe("JSONCoder — epoch strategy", () => {
  const coder = new JSONCoder({ dateEncoding: "epoch", dateDecoding: "epoch" });
  const epoch = new Date("2024-06-15T12:00:00.000Z");

  it("encodes Date as numeric epoch ms", () => {
    const json = coder.encode({ ts: epoch });
    const obj = JSON.parse(json) as { ts: number };
    expect(obj.ts).toBe(epoch.getTime());
    expect(typeof obj.ts).toBe("number");
  });

  it("decodes epoch number back to Date with detectDates=true", () => {
    const ms = epoch.getTime();
    const json = JSON.stringify({ ts: ms });
    const result = coder.decode<{ ts: Date }>(json, true);
    expect(result.ts).toBeInstanceOf(Date);
    expect(result.ts.getTime()).toBe(ms);
  });

  it("epochCoder singleton uses epoch strategy", () => {
    const json = epochCoder.encode({ ts: epoch });
    const obj = JSON.parse(json) as { ts: number };
    expect(obj.ts).toBe(epoch.getTime());
  });

  it("does not revive small numbers as dates", () => {
    const json = JSON.stringify({ count: 42 });
    const result = epochCoder.decode<{ count: number }>(json, true);
    expect(typeof result.count).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("JSONCoder — error handling", () => {
  it("throws on invalid JSON", () => {
    const coder = new JSONCoder();
    expect(() => coder.decode("{bad json}")).toThrow();
  });

  it("decodeFromObject is equivalent to encode+decode", () => {
    const coder = new JSONCoder();
    const data = { x: 1, y: "hello" };
    const result = coder.decodeFromObject<typeof data>(data);
    expect(result).toEqual(data);
  });
});
