/**
 * NetworkError.ts — NetKit Web
 *
 * Discriminated-union mirroring Swift NetworkKit's `NetworkError` enum.
 * Each variant carries typed context so callers can pattern-match precisely.
 */
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
class NetworkError extends Error {
    variant;
    constructor(variant) {
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
    static requestFailed(description) {
        return new NetworkError({ kind: "requestFailed", description });
    }
    /** Mirrors `NetworkError.unexpectedStatusCode(_:headers:)`. */
    static unexpectedStatusCode(statusCode, headers) {
        const variant = headers !== undefined
            ? { kind: "unexpectedStatusCode", statusCode, headers }
            : { kind: "unexpectedStatusCode", statusCode };
        return new NetworkError(variant);
    }
    /** Mirrors `NetworkError.invalidData`. */
    static invalidData() {
        return new NetworkError({ kind: "invalidData" });
    }
    /** Mirrors `NetworkError.jsonParsingFailed(_:)`. */
    static jsonParsingFailed(cause) {
        return new NetworkError({ kind: "jsonParsingFailed", cause });
    }
    /** Mirrors `NetworkError.wsError(description:)`. */
    static wsError(description) {
        return new NetworkError({ kind: "wsError", description });
    }
    /** Mirrors `NetworkError.unknown(_:)`. */
    static unknown(cause) {
        return new NetworkError({ kind: "unknown", cause });
    }
    // -------------------------------------------------------------------------
    // Description — matches Swift CustomStringConvertible
    // -------------------------------------------------------------------------
    get description() {
        return NetworkError.describeVariant(this.variant);
    }
    static describeVariant(v) {
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
    toJSON() {
        return { message: this.message, ...this.variant };
    }
    static fromJSON(raw) {
        const kind = raw["kind"];
        switch (kind) {
            case "requestFailed":
                return NetworkError.requestFailed(String(raw["description"] ?? ""));
            case "unexpectedStatusCode":
                return NetworkError.unexpectedStatusCode(Number(raw["statusCode"] ?? 0), raw["headers"] != null ? String(raw["headers"]) : undefined);
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
    is(kind) {
        return this.variant.kind === kind;
    }
}

/**
 * EndPoint.ts — NetKit Web
 *
 * Request-building abstraction mirroring Swift NetworkKit's `EndPoint` protocol.
 * Consumers implement `EndPoint` and pass it to `HTTPClient.sendRequest()`.
 */
// ---------------------------------------------------------------------------
// buildURL — mirrors Swift `createRequest(endPoint:)` URL construction
// ---------------------------------------------------------------------------
/**
 * Builds a fully-qualified `URL` from an `EndPoint`, applying the same logic
 * as Swift's `NetworkProtocol.createRequest(endPoint:)`.
 */
function buildURL(endpoint) {
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
function appendQueryParams(url, params) {
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            url.searchParams.append(key, String(value));
        }
        else if (Array.isArray(value)) {
            for (const item of value) {
                url.searchParams.append(`${key}[]`, item);
            }
        }
        else {
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
function buildRequest(endpoint) {
    const url = buildURL(endpoint);
    const headers = new Headers(endpoint.header ?? {});
    let body;
    if (endpoint.body != null) {
        body = JSON.stringify(endpoint.body);
        if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
    }
    const init = {
        method: endpoint.method,
        headers,
    };
    if (body !== undefined) {
        init.body = body;
    }
    return new Request(url.toString(), init);
}

/**
 * JSONCoder.ts — NetKit Web
 *
 * JSON encode/decode helpers with pluggable date strategies, mirroring
 * Swift's `JSONEncoder.DateEncodingStrategy` / `JSONDecoder.DateDecodingStrategy`.
 */
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
class JSONCoder {
    dateEncoding;
    dateDecoding;
    constructor(options = {}) {
        this.dateEncoding = options.dateEncoding ?? "iso8601";
        this.dateDecoding = options.dateDecoding ?? "iso8601";
    }
    // -------------------------------------------------------------------------
    // Encode
    // -------------------------------------------------------------------------
    /** Serialises a value to a JSON string, applying the date strategy. */
    encode(value) {
        if (this.dateEncoding === "epoch") {
            // JSON.stringify calls Date.toJSON() before the replacer sees it,
            // converting Date → ISO string. We pre-process the tree to swap Dates
            // for their epoch-ms number before stringifying.
            return JSON.stringify(this.substituteEpoch(value));
        }
        // iso8601: Date.toJSON() already produces an ISO string — pass through.
        return JSON.stringify(value);
    }
    substituteEpoch(value) {
        if (value instanceof Date)
            return value.getTime();
        if (Array.isArray(value))
            return value.map((v) => this.substituteEpoch(v));
        if (value !== null && typeof value === "object") {
            const out = {};
            for (const [k, v] of Object.entries(value)) {
                out[k] = this.substituteEpoch(v);
            }
            return out;
        }
        return value;
    }
    /** Serialises a value to a plain object (structuredClone-safe). */
    encodeToObject(value) {
        return JSON.parse(this.encode(value));
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
    decode(json, detectDates = false) {
        const strategy = this.dateDecoding;
        const reviver = detectDates ? this.reviver(strategy) : undefined;
        try {
            return JSON.parse(json, reviver);
        }
        catch (err) {
            throw new Error(`JSONCoder: failed to parse JSON — ${String(err)}`);
        }
    }
    /** Deserialises from a plain object (e.g. already-parsed fetch response). */
    decodeFromObject(obj, detectDates = false) {
        return this.decode(JSON.stringify(obj), detectDates);
    }
    reviver(strategy) {
        return (_key, value) => {
            if (strategy === "iso8601" && typeof value === "string") {
                if (ISO8601_RE.test(value)) {
                    const d = new Date(value);
                    if (!isNaN(d.getTime()))
                        return d;
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
const ISO8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
// ---------------------------------------------------------------------------
// Convenience singleton
// ---------------------------------------------------------------------------
/** Default `JSONCoder` with iso8601 strategies (mirrors Swift's default decoder). */
const defaultCoder = new JSONCoder();
/** Epoch `JSONCoder` for numeric timestamps. */
const epochCoder = new JSONCoder({
    dateEncoding: "epoch",
    dateDecoding: "epoch",
});

/**
 * HTTPClient.ts — NetKit Web
 *
 * Fetch-based HTTP client mirroring Swift NetworkKit's `NetworkProtocol` +
 * `NetworkService` combination.  Adds AbortController support and exponential-
 * backoff retry on transient failures — features not in the Swift version but
 * natural in a browser context.
 */
const DEFAULT_RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
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
class HTTPClient {
    timeoutMs;
    maxAttempts;
    baseDelayMs;
    retryableStatusCodes;
    defaultHeaders;
    fetchImpl;
    constructor(options = {}) {
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
    async sendRequest(endpoint) {
        return this.sendRequestWithRetry(endpoint, 1);
    }
    /**
     * Sends a request and returns the raw `Response` without decoding.
     * Useful for streaming, binary downloads, etc.
     */
    async sendRawRequest(endpoint) {
        return this.attemptRaw(endpoint);
    }
    // -------------------------------------------------------------------------
    // Internal retry loop
    // -------------------------------------------------------------------------
    async sendRequestWithRetry(endpoint, attempt) {
        try {
            return await this.attemptRequest(endpoint);
        }
        catch (err) {
            if (err instanceof NetworkError) {
                const shouldRetry = attempt < this.maxAttempts &&
                    this.isRetryable(err);
                if (shouldRetry) {
                    await delay(this.baseDelayMs * Math.pow(2, attempt - 1));
                    return this.sendRequestWithRetry(endpoint, attempt + 1);
                }
            }
            throw err;
        }
    }
    isRetryable(err) {
        if (err.is("unexpectedStatusCode")) {
            return this.retryableStatusCodes.includes(err.variant.statusCode);
        }
        // Retry transport errors but not cancellations / decode errors
        return err.is("requestFailed");
    }
    // -------------------------------------------------------------------------
    // Single attempt
    // -------------------------------------------------------------------------
    async attemptRequest(endpoint) {
        const response = await this.attemptRaw(endpoint);
        // Mirrors Swift: guard 200..<400 ~= httpResponse.statusCode
        if (response.status < 200 || response.status >= 400) {
            const rawHeaders = [];
            response.headers.forEach((v, k) => rawHeaders.push(`${k}: ${v}`));
            const headersStr = rawHeaders.join("\n");
            throw NetworkError.unexpectedStatusCode(response.status, headersStr);
        }
        let text;
        try {
            text = await response.text();
        }
        catch (err) {
            throw NetworkError.invalidData();
        }
        if (!text.trim()) {
            // 204 No Content etc. — return undefined cast to T (caller's responsibility)
            return undefined;
        }
        try {
            return defaultCoder.decode(text);
        }
        catch (err) {
            throw NetworkError.jsonParsingFailed(err);
        }
    }
    async attemptRaw(endpoint) {
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), this.timeoutMs);
        // Merge default headers with endpoint headers
        const mergedEndpoint = {
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
        }
        catch (err) {
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
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * WebSocketClient.ts — NetKit Web
 *
 * Native WebSocket wrapper mirroring Swift NetKit's `WebSocketClient` actor.
 * No auto-reconnect in this version (deferred, matching the task spec).
 *
 * State machine: disconnected → connecting → connected → disconnected
 */
// Convenience constructors
const WebSocketMessage = {
    text(value) {
        return { kind: "text", value };
    },
    data(value) {
        return { kind: "data", value };
    },
};
const WebSocketState = {
    disconnected: { kind: "disconnected" },
    connecting: { kind: "connecting" },
    connected: { kind: "connected" },
    reconnecting: (attempt) => ({ kind: "reconnecting", attempt }),
};
// ---------------------------------------------------------------------------
// WebSocketClient
// ---------------------------------------------------------------------------
/**
 * Native WebSocket wrapper.  Mirrors Swift `WebSocketClient`.
 *
 * Auto-reconnect is NOT implemented (deferred per spec).
 *
 * ```ts
 * const ws = new WebSocketClient("wss://example.com/ws");
 * ws.onMessage = (msg) => console.log(msg);
 * await ws.connect();
 * await ws.send(WebSocketMessage.text('{"event":"ping"}'));
 * ws.disconnect();
 * ```
 */
class WebSocketClient {
    url;
    protocols;
    WebSocketCtor;
    socket = null;
    _state = WebSocketState.disconnected;
    // -------------------------------------------------------------------------
    // Event listeners (direct assignment pattern — simpler than EventTarget)
    // -------------------------------------------------------------------------
    /** Called for every inbound message. */
    onMessage = null;
    /** Called when a `NetworkError` occurs. */
    onError = null;
    /** Called whenever the connection state changes. */
    onStateChange = null;
    constructor(url, options = {}) {
        this.url = url;
        this.protocols = options.protocols;
        this.WebSocketCtor = options.webSocketImpl ?? globalThis.WebSocket;
    }
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    get state() {
        return this._state;
    }
    setState(s) {
        this._state = s;
        this.onStateChange?.(s);
    }
    // -------------------------------------------------------------------------
    // connect — mirrors Swift `WebSocketClient.connect()`
    // -------------------------------------------------------------------------
    /**
     * Opens the WebSocket connection.
     *
     * Returns a Promise that resolves once the socket is open (or rejects on
     * immediate failure).
     */
    connect() {
        if (this._state.kind === "connected" || this._state.kind === "connecting") {
            return Promise.resolve();
        }
        this.setState(WebSocketState.connecting);
        return new Promise((resolve, reject) => {
            const ws = new this.WebSocketCtor(this.url, this.protocols);
            ws.binaryType = "arraybuffer";
            ws.onopen = () => {
                this.socket = ws;
                this.setState(WebSocketState.connected);
                resolve();
            };
            ws.onmessage = (event) => {
                let message;
                if (typeof event.data === "string") {
                    message = WebSocketMessage.text(event.data);
                }
                else {
                    message = WebSocketMessage.data(event.data);
                }
                this.onMessage?.(message);
            };
            ws.onerror = () => {
                const err = NetworkError.wsError("WebSocket error");
                this.onError?.(err);
                if (this._state.kind === "connecting") {
                    this.setState(WebSocketState.disconnected);
                    reject(err);
                }
            };
            ws.onclose = (_event) => {
                if (this.socket == null)
                    return; // already handled by disconnect()
                this.socket = null;
                this.setState(WebSocketState.disconnected);
            };
        });
    }
    // -------------------------------------------------------------------------
    // disconnect — mirrors Swift `WebSocketClient.disconnect()`
    // -------------------------------------------------------------------------
    /** Gracefully closes the connection. */
    disconnect() {
        if (this.socket == null)
            return;
        const sock = this.socket;
        this.socket = null;
        this.setState(WebSocketState.disconnected);
        // Close after state change so onclose handler (which checks socket == null)
        // does not emit a second state-change event.
        sock.close(1000, "Normal closure");
    }
    // -------------------------------------------------------------------------
    // send — mirrors Swift `WebSocketClient.send(_:)`
    // -------------------------------------------------------------------------
    /** Sends a message.  Throws `NetworkError.wsError` if not connected. */
    send(message) {
        if (this.socket == null || this._state.kind !== "connected") {
            throw NetworkError.wsError("Not connected");
        }
        if (message.kind === "text") {
            this.socket.send(message.value);
        }
        else {
            this.socket.send(message.value);
        }
    }
    /** Convenience: send a text string. */
    sendText(text) {
        this.send(WebSocketMessage.text(text));
    }
    /** Convenience: send raw binary data. */
    sendData(data) {
        this.send(WebSocketMessage.data(data));
    }
}

export { HTTPClient, JSONCoder, NetworkError, WebSocketClient, WebSocketMessage, WebSocketState, buildRequest, buildURL, defaultCoder, epochCoder };
//# sourceMappingURL=index.js.map
