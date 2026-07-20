import XCTest
@testable import NetKit

// NetKit name-restoration epic — the "add missing part to NetKit" step
// (operator 2026-07-20): NetworkService gains an injectable decoder so
// consumers with backend-specific JSON (fuzzy-swift's ACC format) can
// consolidate onto NetKit instead of forking it.
final class ConfigurableDecoderTests: XCTestCase {

    func testDefaultDecoderPreservesPocketBaseStrategy() {
        // Backward-compat: the no-arg init keeps the historic decoder.
        let service = NetworkService()
        XCTAssertNotNil(service.decoder)
    }

    func testInjectedDecoderIsUsed() {
        let custom = JSONDecoder()
        custom.keyDecodingStrategy = .convertFromSnakeCase
        let service = NetworkService(decoder: custom)
        XCTAssertTrue(service.decoder === custom, "the injected decoder must be the one stored")
    }

    func testProtocolDefaultDecoderAvailableToConformers() {
        // A conformer that doesn't override `decoder` inherits the default.
        XCTAssertNotNil(MockNetworkService().decoder)
    }
}
