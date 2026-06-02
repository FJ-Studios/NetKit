// Tests/NetworkKitTests/OpenAI/SSEParserTests.swift
// NetKit — SSEParser unit tests (W1)

import Foundation
import Testing
@testable import NetKit

@Suite("SSEParser Tests")
struct SSEParserTests {

    // MARK: - parsesSingleChunk

    @Test("Parses a single well-formed SSE event")
    func parsesSingleChunk() async {
        let parser = SSEParser()
        let raw = "data: {\"id\":\"1\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-4\",\"choices\":[]}\n\n"
        let bytes = Array(raw.utf8)
        let events = await parser.feed(bytes)
        #expect(events.count == 1)
        #expect(events[0].data.contains("chat.completion.chunk"))
    }

    // MARK: - parsesMultiByteSplitAcrossPackets

    @Test("Reassembles multi-byte UTF-8 emoji split across two packets")
    func parsesMultiByteSplitAcrossPackets() async {
        // 🎉 is U+1F389 → 4 bytes: F0 9F 8E 89
        // Build a payload containing an emoji, then split the SSE at the
        // byte boundary inside the emoji's encoding.
        let emoji = "🎉"
        let emojiBytes = Array(emoji.utf8)  // [0xF0, 0x9F, 0x8E, 0x89]
        #expect(emojiBytes.count == 4)

        let prefix = "data: {\"msg\":\""
        let suffix = "\"}\n\n"
        let fullBytes = Array(prefix.utf8) + emojiBytes + Array(suffix.utf8)

        // Split inside the 4-byte emoji: first 2 bytes in packet 1, rest in packet 2
        let split = Array(prefix.utf8).count + 2  // mid-emoji
        let packet1 = Array(fullBytes[0..<split])
        let packet2 = Array(fullBytes[split...])

        let parser = SSEParser()
        let events1 = await parser.feed(packet1)
        // Incomplete event — no \n\n boundary reached yet
        #expect(events1.isEmpty)

        let events2 = await parser.feed(packet2)
        // Now we have a complete event; it must decode to a valid UTF-8 string
        #expect(events2.count == 1)
        #expect(events2[0].data.contains(emoji))
    }

    // MARK: - ignoresHeartbeatComments

    @Test("Heartbeat keep-alive comment lines are ignored")
    func ignoresHeartbeatComments() async {
        let parser = SSEParser()
        // A comment-only block produces no event
        let commentBlock = ": keep-alive\n\n"
        let events1 = await parser.feed(Array(commentBlock.utf8))
        #expect(events1.isEmpty)

        // A block with a comment line followed by data still yields the data event
        let mixed = ": ping\ndata: {\"ok\":true}\n\n"
        let events2 = await parser.feed(Array(mixed.utf8))
        #expect(events2.count == 1)
        #expect(events2[0].data == "{\"ok\":true}")
    }

    // MARK: - terminatesOnDoneMarker

    @Test("Stream terminates silently on data: [DONE]")
    func terminatesOnDoneMarker() async {
        let parser = SSEParser()
        // The DONE event should produce no SSEEvent (nil return from parseBlock)
        let done = "data: [DONE]\n\n"
        let events = await parser.feed(Array(done.utf8))
        #expect(events.isEmpty)
    }

    // MARK: - parsesMultipleEventsInOneFeed

    @Test("Multiple events in a single feed are all returned")
    func parsesMultipleEventsInOneFeed() async {
        let parser = SSEParser()
        let two = "data: first\n\ndata: second\n\n"
        let events = await parser.feed(Array(two.utf8))
        #expect(events.count == 2)
        #expect(events[0].data == "first")
        #expect(events[1].data == "second")
    }

    // MARK: - parsesEventTypeField

    @Test("event: field is surfaced on SSEEvent")
    func parsesEventTypeField() async {
        let parser = SSEParser()
        let raw = "event: ping\ndata: {}\n\n"
        let events = await parser.feed(Array(raw.utf8))
        #expect(events.count == 1)
        #expect(events[0].event == "ping")
    }
}
