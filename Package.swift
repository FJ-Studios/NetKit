// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "NetKit",  // repo name unchanged; MODULE renamed ShiNetKit (v1.0.0)
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // v1.0.0 BREAKING (2026-07-18): module renamed NetKit → ShiNetKit.
        // 'NetKit' collides with fuzzy-swift's internal NetKit target; SPM
        // moduleAliases proved NONDETERMINISTIC (silent inert-alias builds
        // that crash-loop at runtime vs hard manifest errors — shikki
        // incident a623764f). Unique names at the source, no aliases, ever.
        .library(
            name: "ShiNetKit",
            targets: ["ShiNetKit"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/FJ-Studios/CoreKit.git", from: "0.1.0"),
    ],
    targets: [
        .target(
            name: "ShiNetKit",
            dependencies: ["CoreKit"],
            path: "Sources/NetworkKit",
            exclude: ["Bonjour/README.md"]
        ),
        .testTarget(
            name: "ShiNetKitTests",
            dependencies: ["ShiNetKit"],
            path: "Tests/NetworkKitTests"
        ),
    ]
)
