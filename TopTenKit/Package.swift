// swift-tools-version: 6.0
//
// TopTenKit — every rule of Top Ten that can be expressed without a UI
// framework. See specs/tech-stack.md ("Shared logic").
//
// Hard constraint: nothing in this package may import SwiftUI, UIKit, or
// CoreGraphics. The package has to build and test on Linux so cloud sessions
// can do verified work on the app's brain while the Mac handles its body.

import PackageDescription

let package = Package(
    name: "TopTenKit",
    // Version strings rather than enum cases so the manifest parses on any
    // Swift 6 toolchain. iOS 26 is the product floor (Liquid Glass +
    // FoundationModels); macOS is declared only so tests can run on a Mac,
    // and is deliberately kept low — the Kit is pure Swift and needs nothing
    // from a current macOS SDK.
    platforms: [
        .iOS("26.0"),
        .macOS("14.0"),
    ],
    products: [
        .library(name: "TopTenKit", targets: ["TopTenKit"]),
    ],
    targets: [
        .target(name: "TopTenKit"),
        .testTarget(name: "TopTenKitTests", dependencies: ["TopTenKit"]),
    ]
)
