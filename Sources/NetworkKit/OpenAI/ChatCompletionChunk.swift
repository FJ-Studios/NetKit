// Sources/NetworkKit/OpenAI/ChatCompletionChunk.swift
// NetKit — OpenAI streaming chunk types (W1)

import Foundation

// MARK: - ChatCompletionChunk

public struct ChatCompletionChunk: Sendable, Codable {
    public let id: String
    public let object: String
    public let created: Int
    public let model: String
    public let choices: [ChunkChoice]
    public let usage: ChunkUsage?

    public init(
        id: String,
        object: String,
        created: Int,
        model: String,
        choices: [ChunkChoice],
        usage: ChunkUsage? = nil
    ) {
        self.id = id
        self.object = object
        self.created = created
        self.model = model
        self.choices = choices
        self.usage = usage
    }
}

// MARK: - ChunkChoice

public struct ChunkChoice: Sendable, Codable {
    public let index: Int
    public let delta: ChunkDelta
    public let finishReason: String?

    enum CodingKeys: String, CodingKey {
        case index
        case delta
        case finishReason = "finish_reason"
    }

    public init(index: Int, delta: ChunkDelta, finishReason: String? = nil) {
        self.index = index
        self.delta = delta
        self.finishReason = finishReason
    }
}

// MARK: - ChunkDelta

public struct ChunkDelta: Sendable, Codable {
    public let role: String?
    public let content: String?
    public let toolCalls: [ChunkToolCallDelta]?

    enum CodingKeys: String, CodingKey {
        case role
        case content
        case toolCalls = "tool_calls"
    }

    public init(role: String? = nil, content: String? = nil, toolCalls: [ChunkToolCallDelta]? = nil) {
        self.role = role
        self.content = content
        self.toolCalls = toolCalls
    }
}

// MARK: - ChunkToolCallDelta

public struct ChunkToolCallDelta: Sendable, Codable {
    public let index: Int
    public let id: String?
    public let type: String?
    public let function: ChunkFunctionDelta?

    public init(index: Int, id: String? = nil, type: String? = nil, function: ChunkFunctionDelta? = nil) {
        self.index = index
        self.id = id
        self.type = type
        self.function = function
    }
}

// MARK: - ChunkFunctionDelta

public struct ChunkFunctionDelta: Sendable, Codable {
    public let name: String?
    public let arguments: String?

    public init(name: String? = nil, arguments: String? = nil) {
        self.name = name
        self.arguments = arguments
    }
}

// MARK: - ChunkUsage

public struct ChunkUsage: Sendable, Codable {
    public let promptTokens: Int?
    public let completionTokens: Int?
    public let totalTokens: Int?

    enum CodingKeys: String, CodingKey {
        case promptTokens = "prompt_tokens"
        case completionTokens = "completion_tokens"
        case totalTokens = "total_tokens"
    }

    public init(promptTokens: Int? = nil, completionTokens: Int? = nil, totalTokens: Int? = nil) {
        self.promptTokens = promptTokens
        self.completionTokens = completionTokens
        self.totalTokens = totalTokens
    }
}
