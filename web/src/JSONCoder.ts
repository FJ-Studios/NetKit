/**
 * JSONCoder.ts — NetKit Web
 *
 * JSON encode/decode helpers with pluggable date strategies, mirroring
 * Swift's `JSONEncoder.DateEncodingStrategy` / `JSONDecoder.DateDecodingStrategy`.
 */

// ---------------------------------------------------------------------------
// Date strategy types
// ---------------------------------------------------------------------------

export type DateEncodingStrategy = "iso8601" | "epoch";
export type DateDecodingStrategy = "iso8601" | "epoch";

export interface JSONCoderOptions {
  /** Strategy used when serialising `Date` values. Defaults to `"iso8601"`. */
  dateEncoding?: DateEncodingStrategy;
  /** Strategy used when deserialising date strings/numbers. Defaults to `"iso8601"`. */
  dateDecoding?: DateDecodingStrategy;
}

// ---------------------------------------------------------------------------
// JSONCoder
// ---------------------------------------------------------------------------

/**
 * Stateless JSON encode/decode utility.
 *
 * ```ts
 * const coder = new JSONCoder({ dateEncoding: "iso8601" });
 * const json = coder.encode({ createdAt: new Date() });
 * const model = coder.decode<MyModel>(json);
 * ```
 */
export class JSONCoder {
  private readonly dateEncoding: DateEncodingStrategy;
  private readonly dateDecoding: DateDecodingStrategy;

  constructor(options: JSONCoderOptions = {}) {
    this.dateEncoding = options.dateEncoding ?? "iso8601";
    this.dateDecoding = options.dateDecoding ?? "iso8601";
  }

  // -------------------------------------------------------------------------
  // Encode
  // -------------------------------------------------------------------------

  /** Serialises a value to a JSON string, applying the date strategy. */
  encode(value: unknown): string {
    if (this.dateEncoding === "epoch") {
      // JSON.stringify calls Date.toJSON() before the replacer sees it,
      // converting Date → ISO string. We pre-process the tree to swap Dates
      // for their epoch-ms number before stringifying.
      return JSON.stringify(this.substituteEpoch(value));
    }
    // iso8601: Date.toJSON() already produces an ISO string — pass through.
    return JSON.stringify(value);
  }

  private substituteEpoch(value: unknown): unknown {
    if (value instanceof Date) return value.getTime();
    if (Array.isArray(value)) return value.map((v) => this.substituteEpoch(v));
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.substituteEpoch(v);
      }
      return out;
    }
    return value;
  }

  /** Serialises a value to a plain object (structuredClone-safe). */
  encodeToObject(value: unknown): unknown {
    return JSON.parse(this.encode(value)) as unknown;
  }

  // -------------------------------------------------------------------------
  // Decode
  // -------------------------------------------------------------------------

  /**
   * Deserialises a JSON string, applying the date strategy.
   *
   * Note: Because JSON carries no type metadata, date fields must be
   * explicitly detected by the caller; this method revives obvious date
   * strings (ISO 8601) and epoch numbers only when `detectDates` is true.
   */
  decode<T>(json: string, detectDates = false): T {
    const strategy = this.dateDecoding;
    const reviver = detectDates ? this.reviver(strategy) : undefined;
    try {
      return JSON.parse(json, reviver) as T;
    } catch (err) {
      throw new Error(`JSONCoder: failed to parse JSON — ${String(err)}`);
    }
  }

  /** Deserialises from a plain object (e.g. already-parsed fetch response). */
  decodeFromObject<T>(obj: unknown, detectDates = false): T {
    return this.decode<T>(JSON.stringify(obj), detectDates);
  }

  private reviver(strategy: DateDecodingStrategy): (key: string, value: unknown) => unknown {
    return (_key: string, value: unknown): unknown => {
      if (strategy === "iso8601" && typeof value === "string") {
        if (ISO8601_RE.test(value)) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) return d;
        }
      }
      if (strategy === "epoch" && typeof value === "number") {
        // Heuristic: epoch ms in range [2000-01-01, 2100-01-01]
        if (value > 946_684_800_000 && value < 4_102_444_800_000) {
          return new Date(value);
        }
      }
      return value;
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Loose ISO 8601 datetime pattern (covers the subset emitted by `Date.toISOString()`).
 */
const ISO8601_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

// ---------------------------------------------------------------------------
// Convenience singleton
// ---------------------------------------------------------------------------

/** Default `JSONCoder` with iso8601 strategies (mirrors Swift's default decoder). */
export const defaultCoder = new JSONCoder();

/** Epoch `JSONCoder` for numeric timestamps. */
export const epochCoder = new JSONCoder({
  dateEncoding: "epoch",
  dateDecoding: "epoch",
});
