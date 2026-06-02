// Tests/NetworkKitTests/OpenAI/ToolCallAccumulatorTests.swift
// NetKit — ToolCallAccumulator unit tests (W1)

import Foundation
import Testing
@testable import NetKit

@Suite("ToolCallAccumulator Tests")
struct ToolCallAccumulatorTests {

    // MARK: - accumulatesArgumentsFragments

    @Test("Three argument fragments accumulate into a single JSON args buffer")
    func accumulatesArgumentsFragments() async {
        let acc = ToolCallAccumulator()

        // First chunk: id + function name
        await acc.absorb(ChunkToolCallDelta(
            index: 0,
            id: "call_abc123",
            type: "function",
            function: ChunkFunctionDelta(name: "get_weather", arguments: "{\"loc")
        ))

        // Second chunk: more arguments
        await acc.absorb(ChunkToolCallDelta(
            index: 0,
            id: nil,
            type: nil,
            function: ChunkFunctionDelta(name: nil, arguments: "ation\": \"Pa")
        ))

        // Third chunk: closing brace
        await acc.absorb(ChunkToolCallDelta(
            index: 0,
            id: nil,
            type: nil,
            function: ChunkFunctionDelta(name: nil, arguments: "ris\"}")
        ))

        let calls = await acc.finalize()
        #expect(calls.count == 1)
        #expect(calls[0].id == "call_abc123")
        #expect(calls[0].function.name == "get_weather")
        #expect(calls[0].function.arguments == "{\"location\": \"Paris\"}")
    }

    // MARK: - finalizeReturnsSortedByIndex

    @Test("finalize() returns tool calls sorted by their index field")
    func finalizeReturnsSortedByIndex() async {
        let acc = ToolCallAccumulator()

        // Insert out-of-order
        await acc.absorb(ChunkToolCallDelta(
            index: 2,
            id: "call_2",
            type: "function",
            function: ChunkFunctionDelta(name: "func_two", arguments: "{}")
        ))
        await acc.absorb(ChunkToolCallDelta(
            index: 0,
            id: "call_0",
            type: "function",
            function: ChunkFunctionDelta(name: "func_zero", arguments: "{}")
        ))
        await acc.absorb(ChunkToolCallDelta(
            index: 1,
            id: "call_1",
            type: "function",
            function: ChunkFunctionDelta(name: "func_one", arguments: "{}")
        ))

        let calls = await acc.finalize()
        #expect(calls.count == 3)
        #expect(calls[0].index == 0)
        #expect(calls[1].index == 1)
        #expect(calls[2].index == 2)
        #expect(calls[0].function.name == "func_zero")
        #expect(calls[1].function.name == "func_one")
        #expect(calls[2].function.name == "func_two")
    }

    // MARK: - idPreservedFromFirstChunkOnly

    @Test("id is set from first chunk and not overwritten by later nil-id chunks")
    func idPreservedFromFirstChunkOnly() async {
        let acc = ToolCallAccumulator()

        await acc.absorb(ChunkToolCallDelta(
            index: 0,
            id: "call_first",
            type: "function",
            function: ChunkFunctionDelta(name: "do_thing", arguments: "{\"a\":")
        ))
        // Second chunk has no id
        await acc.absorb(ChunkToolCallDelta(
            index: 0,
            id: nil,
            type: nil,
            function: ChunkFunctionDelta(name: nil, arguments: "1}")
        ))

        let calls = await acc.finalize()
        #expect(calls.count == 1)
        #expect(calls[0].id == "call_first")
        #expect(calls[0].function.arguments == "{\"a\":1}")
    }

    // MARK: - resetClearsAccumulation

    @Test("reset() clears all accumulated state")
    func resetClearsAccumulation() async {
        let acc = ToolCallAccumulator()

        await acc.absorb(ChunkToolCallDelta(
            index: 0,
            id: "call_gone",
            type: "function",
            function: ChunkFunctionDelta(name: "gone", arguments: "{}")
        ))
        await acc.reset()

        let calls = await acc.finalize()
        #expect(calls.isEmpty)
    }

    // MARK: - emptyAccumulatorFinalizes

    @Test("finalize() on a fresh accumulator returns an empty array")
    func emptyAccumulatorFinalizes() async {
        let acc = ToolCallAccumulator()
        let calls = await acc.finalize()
        #expect(calls.isEmpty)
    }
}
