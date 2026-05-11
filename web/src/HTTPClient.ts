/**
 * HTTPClient.ts — NetKit Web
 *
 * Fetch-based HTTP client mirroring Swift NetworkKit's `NetworkProtocol` +
 * `NetworkService` combination.  Adds AbortController support and exponential-
 * backoff retry on transient failures — features not in the Swift version but
 * natural in a browser context.
 */

import { buildRequest } from "./EndPoint.js";
import type { EndPoint } from "./EndPoint.js";
import { NetworkError } from "./NetworkError.js";
import { defaultCoder } from "./JSONCoder.js";

// ---------------------------------------------------------------------------
// Retry configuration
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of attempts (1 = no retry). Defaults to 3. */
  maxAttempts?: number;
  /**
   * Base delay in milliseconds for exponential back-off.
   * Delay = baseDelayMs * 2^(attempt - 1).  Defaults to 200 ms.
   */
  baseDelayMs?: number;
  /**
   * HTTP status codes that should trigger a retry.
   * Defaults to [429, 500, 502, 503, 504].
   */
  retryableStatusCodes?: readonly number[];
}

const DEFAULT_RETRYABLE_STATUS_CODES: readonly number[] = [429, 500, 502, 503, 504];

// ---------------------------------------------------------------------------
// HTTPClient options
// ---------------------------------------------------------------------------

export interface HTTPClientOptions {
  /**
   * Base timeout per request in milliseconds.
   * An `AbortController` enforces this per-attempt.
   * Defaults to 30 000 ms.
   */
  timeoutMs?: number;
  /** Retry behaviour.  Pass `{ maxAttempts: 1 }` to disable. */
  retry?: RetryOptions;
  /**
   * Default headers merged into every request (endpoint headers take
   * precedence on conflicts).
   */
  defaultHeaders?: Record<string, string>;
  /**
   * Override the global `fetch`.  Useful for testing (pass `msw` fetch).
   */
  fetchImpl?: typeof fetch;
}

// ---------------------------------------------------------------------------
// HTTPClient
// ---------------------------------------------------------------------------

/**
 * Fetch-based HTTP client.  Mirrors Swift `NetworkService`/`NetworkProtocol`.
 *
 * ```ts
 * const client = new HTTPClient({ timeoutMs: 10_000 });
 *
 * const users = await client.sendRequest<User[]>({
 *   host: "api.example.com",
 *   path: "/users",
 *   method: "GET",
 *   header: { Authorization: "Bearer token" },
 * });
 * ```
 */
export class HTTPClient {
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly retryableStatusCodes: readonly number[];
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HTTPClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxAttempts = options.retry?.maxAttempts ?? 3;
    this.baseDelayMs = options.retry?.baseDelayMs ?? 200;
    this.retryableStatusCodes =
      options.retry?.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;
    this.defaultHeaders = options.defaultHeaders ?? {};
    // fetchImpl is resolved lazily at call-time if not injected, so that
    // test frameworks (e.g. msw) can patch globalThis.fetch after construction.
    this.fetchImpl = options.fetchImpl ?? ((...args) => globalThis.fetch(...args));
  }

  // -------------------------------------------------------------------------
  // sendRequest — mirrors Swift `NetworkProtocol.sendRequest<T>(endpoint:)`
  // -------------------------------------------------------------------------

  /**
   * Sends a request and decodes the JSON response body into `T`.
   *
   * Throws `NetworkError` on:
   * - Network/transport failures → `requestFailed`
   * - Non-2xx status codes → `unexpectedStatusCode`
   * - JSON decode failures → `jsonParsingFailed`
   * - AbortController timeout → `requestFailed` (with "timeout" description)
   */
  async sendRequest<T>(endpoint: EndPoint): Promise<T> {
    return this.sendRequestWithRetry<T>(endpoint, 1);
  }

  /**
   * Sends a request and returns the raw `Response` without decoding.
   * Useful for streaming, binary downloads, etc.
   */
  async sendRawRequest(endpoint: EndPoint): Promise<Response> {
    return this.attemptRaw(endpoint);
  }

  // -------------------------------------------------------------------------
  // Internal retry loop
  // -------------------------------------------------------------------------

  private async sendRequestWithRetry<T>(endpoint: EndPoint, attempt: number): Promise<T> {
    try {
      return await this.attemptRequest<T>(endpoint);
    } catch (err) {
      if (err instanceof NetworkError) {
        const shouldRetry =
          attempt < this.maxAttempts &&
          this.isRetryable(err);

        if (shouldRetry) {
          await delay(this.baseDelayMs * Math.pow(2, attempt - 1));
          return this.sendRequestWithRetry<T>(endpoint, attempt + 1);
        }
      }
      throw err;
    }
  }

  private isRetryable(err: NetworkError): boolean {
    if (err.is("unexpectedStatusCode")) {
      return this.retryableStatusCodes.includes(
        (err.variant as { statusCode: number }).statusCode,
      );
    }
    // Retry transport errors but not cancellations / decode errors
    return err.is("requestFailed");
  }

  // -------------------------------------------------------------------------
  // Single attempt
  // -------------------------------------------------------------------------

  private async attemptRequest<T>(endpoint: EndPoint): Promise<T> {
    const response = await this.attemptRaw(endpoint);

    // Mirrors Swift: guard 200..<400 ~= httpResponse.statusCode
    if (response.status < 200 || response.status >= 400) {
      const rawHeaders: string[] = [];
      response.headers.forEach((v, k) => rawHeaders.push(`${k}: ${v}`));
      const headersStr = rawHeaders.join("\n");
      throw NetworkError.unexpectedStatusCode(response.status, headersStr);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (err) {
      throw NetworkError.invalidData();
    }

    if (!text.trim()) {
      // 204 No Content etc. — return undefined cast to T (caller's responsibility)
      return undefined as unknown as T;
    }

    try {
      return defaultCoder.decode<T>(text);
    } catch (err) {
      throw NetworkError.jsonParsingFailed(err);
    }
  }

  private async attemptRaw(endpoint: EndPoint): Promise<Response> {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    // Merge default headers with endpoint headers
    const mergedEndpoint: EndPoint = {
      ...endpoint,
      header: { ...this.defaultHeaders, ...(endpoint.header ?? {}) },
    };

    const request = buildRequest(mergedEndpoint);

    try {
      const response = await this.fetchImpl(request, {
        signal: controller.signal,
      });
      clearTimeout(timerId);
      return response;
    } catch (err) {
      clearTimeout(timerId);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw NetworkError.requestFailed("Request timed out");
      }
      throw NetworkError.requestFailed(String(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
