// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "NetKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "NetKit",
            targets: ["NetKit"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/FJ-Studios/CoreKit.git", from: "0.1.0"),
    ],
    targets: [
        .target(
            name: "NetKit",
            dependencies: ["CoreKit"],
            path: "Sources/NetworkKit"
        ),
        .testTarget(
            name: "NetKitTests",
            dependencies: ["NetKit"],
            path: "Tests/NetworkKitTests"
        ),
    ]
)
