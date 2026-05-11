/**
 * NetworkError.ts — NetKit Web
 *
 * Discriminated-union mirroring Swift NetworkKit's `NetworkError` enum.
 * Each variant carries typed context so callers can pattern-match precisely.
 */

// ---------------------------------------------------------------------------
// Variant tags (string literal union — exhaustiveness-checkable at compile time)
// ---------------------------------------------------------------------------

export type NetworkErrorKind =
  | "requestFailed"
  | "unexpectedStatusCode"
  | "invalidData"
  | "jsonParsingFailed"
  | "wsError"
  | "unknown";

// ---------------------------------------------------------------------------
// Per-variant payload shapes
// ---------------------------------------------------------------------------

export interface RequestFailedError {
  readonly kind: "requestFailed";
  readonly description: string;
}

export interface UnexpectedStatusCodeError {
  readonly kind: "unexpectedStatusCode";
  readonly statusCode: number;
  /** Raw response headers, serialised as a single string (optional). */
  readonly headers?: string;
}

export interface InvalidDataError {
  readonly kind: "invalidData";
}

export interface JsonParsingFailedError {
  readonly kind: "jsonParsingFailed";
  readonly cause: unknown;
}

export interface WsError {
  readonly kind: "wsError";
  readonly description: string;
}

export interface UnknownError {
  readonly kind: "unknown";
  readonly cause: unknown;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type NetworkErrorVariant =
  | RequestFailedError
  | UnexpectedStatusCodeError
  | InvalidDataError
  | JsonParsingFailedError
  | WsError
  | UnknownError;

// ---------------------------------------------------------------------------
// NetworkError class — extends Error so it's throwable
// ---------------------------------------------------------------------------

/**
 * `NetworkError` mirrors the Swift `NetworkError` enum case-for-case.
 *
 * ```ts
 * throw NetworkError.requestFailed("Connection timed out");
 * throw NetworkError.unexpectedStatusCode(404);
 * throw NetworkError.wsError("Socket closed unexpectedly");
 * ```
 */
export class NetworkError extends Error {
  readonly variant: NetworkErrorVariant;

  private constructor(variant: NetworkErrorVariant) {
    super(NetworkError.describeVariant(variant));
    this.name = "NetworkError";
    this.variant = variant;
    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // -------------------------------------------------------------------------
  // Static factory methods — match Swift enum cases
  // -------------------------------------------------------------------------

  /** Mirrors `NetworkError.requestFailed(description:)`. */
  static requestFailed(description: string): NetworkError {
    return new NetworkError({ kind: "requestFailed", description });
  }

  /** Mirrors `NetworkError.unexpectedStatusCode(_:headers:)`. */
  static unexpectedStatusCode(
    statusCode: number,
    headers?: string,
  ): NetworkError {
    const variant: UnexpectedStatusCodeError =
      headers !== undefined
        ? { kind: "unexpectedStatusCode", statusCode, headers }
        : { kind: "unexpectedStatusCode", statusCode };
    return new NetworkError(variant);
  }

  /** Mirrors `NetworkError.invalidData`. */
  static invalidData(): NetworkError {
    return new NetworkError({ kind: "invalidData" });
  }

  /** Mirrors `NetworkError.jsonParsingFailed(_:)`. */
  static jsonParsingFailed(cause: unknown): NetworkError {
    return new NetworkError({ kind: "jsonParsingFailed", cause });
  }

  /** Mirrors `NetworkError.wsError(description:)`. */
  static wsError(description: string): NetworkError {
    return new NetworkError({ kind: "wsError", description });
  }

  /** Mirrors `NetworkError.unknown(_:)`. */
  static unknown(cause: unknown): NetworkError {
    return new NetworkError({ kind: "unknown", cause });
  }

  // -------------------------------------------------------------------------
  // Description — matches Swift CustomStringConvertible
  // -------------------------------------------------------------------------

  get description(): string {
    return NetworkError.describeVariant(this.variant);
  }

  private static describeVariant(v: NetworkErrorVariant): string {
    switch (v.kind) {
      case "requestFailed":
        return `Request failed: ${v.description}`;
      case "unexpectedStatusCode":
        return `Invalid status code: ${v.statusCode}`;
      case "invalidData":
        return "Invalid data";
      case "jsonParsingFailed":
        return `Failed to parse JSON: ${String(v.cause)}`;
      case "wsError":
        return `WebSocket error: ${v.description}`;
      case "unknown":
        return `An unknown error occurred ${String(v.cause)}`;
    }
  }

  // -------------------------------------------------------------------------
  // Serialisation helpers (for golden-fixture tests)
  // -------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return { message: this.message, ...this.variant };
  }

  static fromJSON(raw: Record<string, unknown>): NetworkError {
    const kind = raw["kind"] as NetworkErrorKind;
    switch (kind) {
      case "requestFailed":
        return NetworkError.requestFailed(String(raw["description"] ?? ""));
      case "unexpectedStatusCode":
        return NetworkError.unexpectedStatusCode(
          Number(raw["statusCode"] ?? 0),
          raw["headers"] != null ? String(raw["headers"]) : undefined,
        );
      case "invalidData":
        return NetworkError.invalidData();
      case "jsonParsingFailed":
        return NetworkError.jsonParsingFailed(raw["cause"]);
      case "wsError":
        return NetworkError.wsError(String(raw["description"] ?? ""));
      case "unknown":
        return NetworkError.unknown(raw["cause"]);
      default:
        return NetworkError.unknown(new Error(`Unknown kind: ${String(kind)}`));
    }
  }

  // -------------------------------------------------------------------------
  // Type narrowing helpers
  // -------------------------------------------------------------------------

  is<K extends NetworkErrorKind>(
    kind: K,
  ): this is NetworkError & { variant: Extract<NetworkErrorVariant, { kind: K }> } {
    return this.variant.kind === kind;
  }
}
