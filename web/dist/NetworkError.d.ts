/**
 * NetworkError.ts — NetKit Web
 *
 * Discriminated-union mirroring Swift NetworkKit's `NetworkError` enum.
 * Each variant carries typed context so callers can pattern-match precisely.
 */
export type NetworkErrorKind = "requestFailed" | "unexpectedStatusCode" | "invalidData" | "jsonParsingFailed" | "wsError" | "unknown";
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
export type NetworkErrorVariant = RequestFailedError | UnexpectedStatusCodeError | InvalidDataError | JsonParsingFailedError | WsError | UnknownError;
/**
 * `NetworkError` mirrors the Swift `NetworkError` enum case-for-case.
 *
 * ```ts
 * throw NetworkError.requestFailed("Connection timed out");
 * throw NetworkError.unexpectedStatusCode(404);
 * throw NetworkError.wsError("Socket closed unexpectedly");
 * ```
 */
export declare class NetworkError extends Error {
    readonly variant: NetworkErrorVariant;
    private constructor();
    /** Mirrors `NetworkError.requestFailed(description:)`. */
    static requestFailed(description: string): NetworkError;
    /** Mirrors `NetworkError.unexpectedStatusCode(_:headers:)`. */
    static unexpectedStatusCode(statusCode: number, headers?: string): NetworkError;
    /** Mirrors `NetworkError.invalidData`. */
    static invalidData(): NetworkError;
    /** Mirrors `NetworkError.jsonParsingFailed(_:)`. */
    static jsonParsingFailed(cause: unknown): NetworkError;
    /** Mirrors `NetworkError.wsError(description:)`. */
    static wsError(description: string): NetworkError;
    /** Mirrors `NetworkError.unknown(_:)`. */
    static unknown(cause: unknown): NetworkError;
    get description(): string;
    private static describeVariant;
    toJSON(): Record<string, unknown>;
    static fromJSON(raw: Record<string, unknown>): NetworkError;
    is<K extends NetworkErrorKind>(kind: K): this is NetworkError & {
        variant: Extract<NetworkErrorVariant, {
            kind: K;
        }>;
    };
}
