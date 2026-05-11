/**
 * EndPoint.ts — NetKit Web
 *
 * Request-building abstraction mirroring Swift NetworkKit's `EndPoint` protocol.
 * Consumers implement `EndPoint` and pass it to `HTTPClient.sendRequest()`.
 */

// ---------------------------------------------------------------------------
// RequestMethod — mirrors Swift `RequestMethod` enum
// ---------------------------------------------------------------------------

export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// ---------------------------------------------------------------------------
// QueryParam value types — mirrors Swift's [String: Any]
// ---------------------------------------------------------------------------

export type QueryParamValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, string>;

export type QueryParams = Record<string, QueryParamValue>;

// ---------------------------------------------------------------------------
// EndPoint interface — mirrors Swift `EndPoint` protocol
// ---------------------------------------------------------------------------

/**
 * Describes an API endpoint.  Implement this interface for each resource.
 *
 * ```ts
 * const getUsers: EndPoint = {
 *   host: "api.example.com",
 *   path: "/users",
 *   method: "GET",
 *   header: { Authorization: "Bearer token123" },
 * };
 * ```
 */
export interface EndPoint {
  readonly host: string;
  readonly port?: number;
  /** Defaults to `"https"`. */
  readonly scheme?: string;
  /** API path prefix, e.g. `"/api/v1"`. Defaults to `""`. */
  readonly apiPath?: string;
  /** Extra file path segment (mirrors Swift's `apiFilePath`). Defaults to `""`. */
  readonly apiFilePath?: string;
  readonly path: string;
  readonly method: RequestMethod;
  readonly header?: Record<string, string>;
  /** Request body as a plain object — will be JSON-serialised. */
  readonly body?: Record<string, unknown>;
  readonly queryParams?: QueryParams;
}

// ---------------------------------------------------------------------------
// buildURL — mirrors Swift `createRequest(endPoint:)` URL construction
// ---------------------------------------------------------------------------

/**
 * Builds a fully-qualified `URL` from an `EndPoint`, applying the same logic
 * as Swift's `NetworkProtocol.createRequest(endPoint:)`.
 */
export function buildURL(endpoint: EndPoint): URL {
  const scheme = endpoint.scheme ?? "https";
  const apiPath = endpoint.apiPath ?? "";
  const port = endpoint.port != null ? `:${endpoint.port}` : "";
  const base = `${scheme}://${endpoint.host}${port}${apiPath}${endpoint.path}`;
  const url = new URL(base);

  if (endpoint.queryParams) {
    appendQueryParams(url, endpoint.queryParams);
  }

  return url;
}

/**
 * Converts a `QueryParams` map to `URLSearchParams`, honouring nested
 * objects (→ `key[subKey]=value`) and arrays (→ `key[]=value`).
 *
 * Mirrors the Swift `[URLQueryItem].init(from:)` extension.
 */
function appendQueryParams(url: URL, params: QueryParams): void {
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      url.searchParams.append(key, String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(`${key}[]`, item);
      }
    } else {
      // nested object → key[subKey]=value
      for (const [subKey, subValue] of Object.entries(value)) {
        url.searchParams.append(`${key}[${subKey}]`, subValue);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// buildRequest — mirrors Swift `createRequest(endPoint:)` fully
// ---------------------------------------------------------------------------

/**
 * Builds a `Request` (Fetch API) from an `EndPoint`.
 */
export function buildRequest(endpoint: EndPoint): Request {
  const url = buildURL(endpoint);
  const headers = new Headers(endpoint.header ?? {});

  let body: string | undefined;
  if (endpoint.body != null) {
    body = JSON.stringify(endpoint.body);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  return new Request(url.toString(), {
    method: endpoint.method,
    headers,
    body,
  });
}
