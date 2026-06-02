// Sources/NetworkKit/OpenAI/SSEParser.swift
// NetKit — Server-Sent Events parser (W1)
//
// Handles:
//   - multi-byte UTF-8 split across packet boundaries
//   - \n\n event boundary detection
//   - data: [DONE] terminator
//   - heartbeat keep-alive comments (: prefix) — ignored

import Foundation

// MARK: - SSEEvent

public struct SSEEvent: Sendable {
    public let data: String
    public let event: String?

    public init(data: String, event: String? = nil) {
        self.data = data
        self.event = event
    }
}

// MARK: - SSEParser

public actor SSEParser {

    private var byteBuffer: [UInt8] = []
    private var pendingEventType: String? = nil

    public init() {}

    /// Feed raw bytes into the parser and receive any complete SSE events.
    /// Returns nil for heartbeat/comment lines and the [DONE] terminator.
    public func feed(_ bytes: [UInt8]) -> [SSEEvent] {
        byteBuffer.append(contentsOf: bytes)
        return drainEvents()
    }

    /// Feed a Data chunk; handles multi-byte UTF-8 boundaries by buffering
    /// incomplete sequences until the next feed call.
    public func feed(_ data: Data) -> [SSEEvent] {
        byteBuffer.append(contentsOf: data)
        return drainEvents()
    }

    /// Returns all pending events if the buffer is terminated with \n\n.
    private func drainEvents() -> [SSEEvent] {
        var events: [SSEEvent] = []

        // Work on the byte buffer, slicing at \n\n boundaries.
        // We need to detect the two-newline boundary in bytes to handle
        // multi-byte UTF-8 correctly (we never split a codepoint).
        while let range = findDoubleNewline(in: byteBuffer) {
            // eventBytes = everything before the delimiter
            let eventBytes = Array(byteBuffer[0..<range.lowerBound])
            // Consume eventBytes + delimiter from the front
            byteBuffer = Array(byteBuffer[range.upperBound...])

            // Decode the block — if it fails, the bytes are incomplete UTF-8;
            // put them back and stop until more bytes arrive.
            guard let block = String(bytes: eventBytes, encoding: .utf8) else {
                byteBuffer = eventBytes + byteBuffer
                break
            }

            if let event = parseBlock(block) {
                events.append(event)
            }
        }

        return events
    }

    /// Find the first occurrence of \n\n (or \r\n\r\n) in the byte buffer.
    /// Returns the range covering the delimiter so it can be removed.
    private func findDoubleNewline(in buffer: [UInt8]) -> Range<Int>? {
        let lf: UInt8 = 0x0A  // \n
        let cr: UInt8 = 0x0D  // \r

        var i = 0
        while i < buffer.count - 1 {
            if buffer[i] == lf && buffer[i + 1] == lf {
                return i..<(i + 2)
            }
            if i + 3 < buffer.count,
               buffer[i] == cr, buffer[i + 1] == lf,
               buffer[i + 2] == cr, buffer[i + 3] == lf {
                return i..<(i + 4)
            }
            i += 1
        }
        return nil
    }

    /// Parse a single SSE event block (text between \n\n boundaries).
    /// Returns nil for pure-comment blocks or the [DONE] terminator.
    private func parseBlock(_ block: String) -> SSEEvent? {
        var dataLines: [String] = []
        var eventType: String? = nil

        let lines = block.components(separatedBy: "\n")
        for rawLine in lines {
            let line = rawLine.hasSuffix("\r") ? String(rawLine.dropLast()) : rawLine

            // Comment / heartbeat — ignore
            if line.hasPrefix(":") { continue }

            if line.hasPrefix("event:") {
                eventType = String(line.dropFirst(6)).trimmingCharacters(in: .init(charactersIn: " "))
            } else if line.hasPrefix("data:") {
                let payload = String(line.dropFirst(5))
                let trimmed = payload.hasPrefix(" ") ? String(payload.dropFirst()) : payload

                // [DONE] terminator — stop accumulation, return nil (stream is over)
                if trimmed == "[DONE]" { return nil }

                dataLines.append(trimmed)
            }
            // id: and retry: fields intentionally ignored (out of W1 scope)
        }

        guard !dataLines.isEmpty else { return nil }

        let data = dataLines.joined(separator: "\n")
        return SSEEvent(data: data, event: eventType)
    }
}
