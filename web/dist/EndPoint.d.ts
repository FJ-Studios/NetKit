/**
 * EndPoint.ts — NetKit Web
 *
 * Request-building abstraction mirroring Swift NetworkKit's `EndPoint` protocol.
 * Consumers implement `EndPoint` and pass it to `HTTPClient.sendRequest()`.
 */
export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type QueryParamValue = string | number | boolean | string[] | Record<string, string>;
export type QueryParams = Record<string, QueryParamValue>;
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
/**
 * Builds a fully-qualified `URL` from an `EndPoint`, applying the same logic
 * as Swift's `NetworkProtocol.createRequest(endPoint:)`.
 */
export declare function buildURL(endpoint: EndPoint): URL;
/**
 * Builds a `Request` (Fetch API) from an `EndPoint`.
 */
export declare function buildRequest(endpoint: EndPoint): Request;
