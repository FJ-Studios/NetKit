// Sources/NetworkKit/OpenAI/ToolCallAccumulator.swift
// NetKit — ToolCall delta accumulator (W1)

import Foundation

// MARK: - OpenAIToolCall

public struct OpenAIToolCall: Sendable, Codable {
    public let index: Int
    public var id: String
    public var type: String
    public var function: OpenAIToolCallFunction

    public init(index: Int, id: String, type: String, function: OpenAIToolCallFunction) {
        self.index = index
        self.id = id
        self.type = type
        self.function = function
    }
}

// MARK: - OpenAIToolCallFunction

public struct OpenAIToolCallFunction: Sendable, Codable {
    public var name: String
    public var arguments: String

    public init(name: String, arguments: String) {
        self.name = name
        self.arguments = arguments
    }
}

// MARK: - ToolCallAccumulator

public actor ToolCallAccumulator {

    private var accumulated: [Int: OpenAIToolCall] = [:]

    public init() {}

    /// Absorb a single tool call delta chunk into the accumulator.
    public func absorb(_ delta: ChunkToolCallDelta) {
        var current = accumulated[delta.index] ?? OpenAIToolCall(
            index: delta.index,
            id: "",
            type: "function",
            function: OpenAIToolCallFunction(name: "", arguments: "")
        )

        if let id = delta.id, !id.isEmpty {
            current.id = id
        }
        if let type = delta.type, !type.isEmpty {
            current.type = type
        }
        if let nm = delta.function?.name, !nm.isEmpty {
            current.function.name = nm
        }
        if let frag = delta.function?.arguments {
            current.function.arguments += frag
        }

        accumulated[delta.index] = current
    }

    /// Return accumulated tool calls sorted by index and reset the buffer.
    public func finalize() -> [OpenAIToolCall] {
        accumulated.values.sorted(by: { $0.index < $1.index })
    }

    /// Reset accumulator state (e.g., between requests).
    public func reset() {
        accumulated = [:]
    }
}
