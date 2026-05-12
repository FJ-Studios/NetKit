/**
 * HTTPClient.ts — NetKit Web
 *
 * Fetch-based HTTP client mirroring Swift NetworkKit's `NetworkProtocol` +
 * `NetworkService` combination.  Adds AbortController support and exponential-
 * backoff retry on transient failures — features not in the Swift version but
 * natural in a browser context.
 */
import type { EndPoint } from "./EndPoint.js";
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
export declare class HTTPClient {
    private readonly timeoutMs;
    private readonly maxAttempts;
    private readonly baseDelayMs;
    private readonly retryableStatusCodes;
    private readonly defaultHeaders;
    private readonly fetchImpl;
    constructor(options?: HTTPClientOptions);
    /**
     * Sends a request and decodes the JSON response body into `T`.
     *
     * Throws `NetworkError` on:
     * - Network/transport failures → `requestFailed`
     * - Non-2xx status codes → `unexpectedStatusCode`
     * - JSON decode failures → `jsonParsingFailed`
     * - AbortController timeout → `requestFailed` (with "timeout" description)
     */
    sendRequest<T>(endpoint: EndPoint): Promise<T>;
    /**
     * Sends a request and returns the raw `Response` without decoding.
     * Useful for streaming, binary downloads, etc.
     */
    sendRawRequest(endpoint: EndPoint): Promise<Response>;
    private sendRequestWithRetry;
    private isRetryable;
    private attemptRequest;
    private attemptRaw;
}
