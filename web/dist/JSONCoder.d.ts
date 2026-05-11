/**
 * JSONCoder.ts — NetKit Web
 *
 * JSON encode/decode helpers with pluggable date strategies, mirroring
 * Swift's `JSONEncoder.DateEncodingStrategy` / `JSONDecoder.DateDecodingStrategy`.
 */
export type DateEncodingStrategy = "iso8601" | "epoch";
export type DateDecodingStrategy = "iso8601" | "epoch";
export interface JSONCoderOptions {
    /** Strategy used when serialising `Date` values. Defaults to `"iso8601"`. */
    dateEncoding?: DateEncodingStrategy;
    /** Strategy used when deserialising date strings/numbers. Defaults to `"iso8601"`. */
    dateDecoding?: DateDecodingStrategy;
}
/**
 * Stateless JSON encode/decode utility.
 *
 * ```ts
 * const coder = new JSONCoder({ dateEncoding: "iso8601" });
 * const json = coder.encode({ createdAt: new Date() });
 * const model = coder.decode<MyModel>(json);
 * ```
 */
export declare class JSONCoder {
    private readonly dateEncoding;
    private readonly dateDecoding;
    constructor(options?: JSONCoderOptions);
    /** Serialises a value to a JSON string, applying the date strategy. */
    encode(value: unknown): string;
    private substituteEpoch;
    /** Serialises a value to a plain object (structuredClone-safe). */
    encodeToObject(value: unknown): unknown;
    /**
     * Deserialises a JSON string, applying the date strategy.
     *
     * Note: Because JSON carries no type metadata, date fields must be
     * explicitly detected by the caller; this method revives obvious date
     * strings (ISO 8601) and epoch numbers only when `detectDates` is true.
     */
    decode<T>(json: string, detectDates?: boolean): T;
    /** Deserialises from a plain object (e.g. already-parsed fetch response). */
    decodeFromObject<T>(obj: unknown, detectDates?: boolean): T;
    private reviver;
}
/** Default `JSONCoder` with iso8601 strategies (mirrors Swift's default decoder). */
export declare const defaultCoder: JSONCoder;
/** Epoch `JSONCoder` for numeric timestamps. */
export declare const epochCoder: JSONCoder;
