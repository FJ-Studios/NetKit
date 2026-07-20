// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "NetKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // v2.0.0 (2026-07-20): the generic module name `NetKit` is RESTORED.
        // The v1.0.0 `ShiNetKit` rename was an aberration to dodge a collision
        // with fuzzy-swift's forked NetKit; fuzzy now consumes NetKit directly
        // (name-restoration epic), so no collision remains and the branded
        // name is undone.
        .library(name: "NetKit", targets: ["NetKit"]),
        // Deprecated compatibility: `import ShiNetKit` re-exports NetKit for
        // one cycle so unknown external consumers don't hard-break at v2.0.0.
        .library(name: "ShiNetKit", targets: ["ShiNetKitShim"]),
    ],
    dependencies: [
        .package(url: "https://github.com/FJ-Studios/CoreKit.git", from: "0.1.0"),
    ],
    targets: [
        .target(
            name: "NetKit",
            dependencies: ["CoreKit"],
            path: "Sources/NetworkKit",
            exclude: ["Bonjour/README.md"]
        ),
        .target(
            name: "ShiNetKitShim",
            dependencies: ["NetKit"],
            path: "Sources/ShiNetKitShim"
        ),
        .testTarget(
            name: "NetKitTests",
            dependencies: ["NetKit"],
            path: "Tests/NetworkKitTests"
        ),
    ]
)
