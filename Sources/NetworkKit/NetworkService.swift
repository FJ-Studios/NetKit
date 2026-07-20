//
//  NetworkService.swift
//  NetworkKit
//
//  Extracted from WabiSabi — Created by Jeoffrey Thirot on 12/02/2024.
//

import Combine
import Foundation

public final class NetworkService: NetworkProtocol {
    public let decoder: JSONDecoder

    /// - Parameter decoder: response JSON decoder. Defaults to NetKit's
    ///   PocketBase-aware decoder; inject a custom one for other backends
    ///   (e.g. the ACC format fuzzy-swift consumes).
    public init(decoder: JSONDecoder = NetworkService.defaultDecoder()) {
        self.decoder = decoder
    }

    /// The historic default decoder (PocketBase date strategy).
    public static func defaultDecoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom(d.pocketbaseDateDecodingStrategy())
        return d
    }
}
