import Foundation

/// A color, held as the Kit holds every color: sRGB components 0...1, with no
/// dependency on a graphics framework. `TopTenKit` must build on Linux, so
/// CoreGraphics is not available to it and would not be wanted anyway — this
/// is color *arithmetic*, and the renderer converts at the edge.
public struct RGB: Hashable, Sendable, Codable {
    public var r: Double, g: Double, b: Double

    public init(r: Double, g: Double, b: Double) {
        self.r = r.clamped(to: 0...1)
        self.g = g.clamped(to: 0...1)
        self.b = b.clamped(to: 0...1)
    }

    /// Parse "#1A2B3C" or "1a2b3c". Returns `nil` on anything else — a catalog
    /// with a bad color must not silently become black.
    public init?(hex: String) {
        var s = Substring(hex)
        if s.hasPrefix("#") { s = s.dropFirst() }
        guard s.count == 6, let value = Int(s, radix: 16) else { return nil }
        self.init(
            r: Double((value >> 16) & 0xFF) / 255,
            g: Double((value >> 8) & 0xFF) / 255,
            b: Double(value & 0xFF) / 255
        )
    }

    /// Uppercase "#1A2B3C".
    public var hex: String {
        let channel = { (v: Double) in Int((v * 255).rounded()) }
        return String(format: "#%02X%02X%02X", channel(r), channel(g), channel(b))
    }
}

/// A color in CIE L\*C\*h — lightness, chroma, hue — which is where the badge
/// palette rules are written because they are perceptual rules. "Not too dark,
/// not too saturated" is meaningless in RGB and exact here.
public struct LCH: Hashable, Sendable, Codable {
    /// Lightness, 0 (black) ... 100 (white).
    public var l: Double
    /// Chroma, 0 (grey) upward. SRGB rarely exceeds ~130.
    public var c: Double
    /// Hue angle in degrees, 0..<360.
    public var h: Double

    public init(l: Double, c: Double, h: Double) {
        self.l = l
        self.c = max(0, c)
        self.h = h.truncatingRemainder(dividingBy: 360) + (h < 0 ? 360 : 0)
    }
}

/// The badge's two-color field, derived from the Ten's own artwork.
///
/// The point of deriving rather than choosing: the badge has to *visibly
/// belong to this list* (specs/badges.md, "Field"). A palette picked from a
/// preset wheel produces a badge that could have come from anyone's Ten.
public struct BadgePalette: Hashable, Sendable, Codable {
    public let primary: RGB
    public let secondary: RGB
    /// The colors before clamping, kept so a design pass can see what the
    /// artwork actually offered and what the guard rails cost.
    public let sourceHues: [Double]

    public init(primary: RGB, secondary: RGB, sourceHues: [Double]) {
        self.primary = primary
        self.secondary = secondary
        self.sourceHues = sourceHues
    }
}

public enum Palette {
    /// The Laurel-safe window (specs/badges.md): lightness 25...75, chroma at
    /// most 60. Outside it a badge is either mud or a highlighter, and the
    /// lineup test — twenty badges reading as one family — is the thing that
    /// fails first.
    public static let safeLightness: ClosedRange<Double> = 25...75
    public static let maximumChroma: Double = 60

    /// Pull a badge palette from the artwork of a ranked list.
    ///
    /// Uses the **top three** items only. A palette averaged over ten posters
    /// is a palette averaged into grey; the top three are also the three the
    /// user will defend, so the badge takes its color from the part of the
    /// list they care most about.
    ///
    /// - Returns: a palette, always. Artwork is optional metadata and a badge
    ///   is not, so a list with no colors at all gets the deterministic
    ///   fallback rather than no badge.
    public static func derive(from items: [Item], seed: UInt64 = 0) -> BadgePalette {
        let hexes = items.prefix(3).compactMap(\.artworkHex)
        let colors = hexes.compactMap(RGB.init(hex:)).map(lch(from:))
        guard let first = colors.first else { return fallback(seed: seed) }

        let primary = clampToSafeRange(first)
        // The second color is the next distinct hue if the artwork offers one,
        // and a rotation of the first if it does not. Rotating by 150 degrees
        // rather than 180 keeps the pair related rather than opposed — a
        // complement reads as two badges fighting.
        let distinct = colors.dropFirst().first { angularDistance($0.h, first.h) > 25 }
        let secondaryRaw = distinct ?? LCH(l: first.l < 50 ? first.l + 24 : first.l - 24,
                                           c: first.c * 0.7, h: first.h + 150)
        return BadgePalette(
            primary: rgb(from: primary),
            secondary: rgb(from: clampToSafeRange(secondaryRaw)),
            sourceHues: colors.map(\.h)
        )
    }

    /// The palette for a list whose artwork told us nothing. Seeded so that
    /// two colorless lists do not get the same badge, and so the same list
    /// gets the same badge twice.
    public static func fallback(seed: UInt64) -> BadgePalette {
        var rng = SplitMix64(seed: seed &+ 0x9E37_79B9_7F4A_7C15)
        let hue = Double(rng.next() % 360)
        let primary = LCH(l: 42, c: 38, h: hue)
        let secondary = LCH(l: 66, c: 26, h: hue + 150)
        return BadgePalette(primary: rgb(from: primary), secondary: rgb(from: secondary),
                            sourceHues: [])
    }

    /// Bring a color inside the Laurel-safe window, keeping its hue. Hue is
    /// what carries the list's identity; lightness and chroma are what carry
    /// the family resemblance, so those are the ones that give way.
    public static func clampToSafeRange(_ color: LCH) -> LCH {
        LCH(l: color.l.clamped(to: safeLightness),
            c: min(color.c, maximumChroma),
            h: color.h)
    }

    // MARK: - sRGB <-> CIE L*C*h, through XYZ under D65

    public static func lch(from color: RGB) -> LCH {
        let (x, y, z) = xyz(from: color)
        let (l, a, bb) = lab(fromXYZ: (x, y, z))
        let c = (a * a + bb * bb).squareRoot()
        var h = atan2(bb, a) * 180 / .pi
        if h < 0 { h += 360 }
        return LCH(l: l, c: c, h: h)
    }

    public static func rgb(from color: LCH) -> RGB {
        let rad = color.h * .pi / 180
        let a = color.c * cos(rad), b = color.c * sin(rad)
        return rgb(fromLab: (color.l, a, b))
    }

    /// D65 white point, the reference sRGB is defined against.
    private static let white = (x: 0.95047, y: 1.00000, z: 1.08883)

    private static func linearize(_ v: Double) -> Double {
        v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
    }

    private static func delinearize(_ v: Double) -> Double {
        v <= 0.0031308 ? v * 12.92 : 1.055 * pow(v, 1 / 2.4) - 0.055
    }

    private static func xyz(from color: RGB) -> (Double, Double, Double) {
        let r = linearize(color.r), g = linearize(color.g), b = linearize(color.b)
        return (
            r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
            r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
            r * 0.0193339 + g * 0.1191920 + b * 0.9503041
        )
    }

    private static func lab(fromXYZ xyz: (Double, Double, Double)) -> (Double, Double, Double) {
        func f(_ t: Double) -> Double {
            t > 0.008856 ? cbrt(t) : (7.787 * t) + (16.0 / 116)
        }
        let fx = f(xyz.0 / white.x), fy = f(xyz.1 / white.y), fz = f(xyz.2 / white.z)
        return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
    }

    private static func rgb(fromLab lab: (Double, Double, Double)) -> RGB {
        let fy = (lab.0 + 16) / 116
        let fx = fy + lab.1 / 500
        let fz = fy - lab.2 / 200
        func inv(_ t: Double) -> Double {
            let cube = t * t * t
            return cube > 0.008856 ? cube : (t - 16.0 / 116) / 7.787
        }
        let x = inv(fx) * white.x, y = inv(fy) * white.y, z = inv(fz) * white.z
        let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
        let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560
        let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
        return RGB(r: delinearize(r), g: delinearize(g), b: delinearize(b))
    }

    static func angularDistance(_ a: Double, _ b: Double) -> Double {
        let d = abs(a - b).truncatingRemainder(dividingBy: 360)
        return min(d, 360 - d)
    }
}

extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}

/// A small, fast, **reproducible** generator.
///
/// `SystemRandomNumberGenerator` is seeded from the OS and cannot be replayed,
/// which would make a badge un-regenerable and every badge test a coin flip.
/// SplitMix64 gives the same stream for the same seed on every platform,
/// which is what "the same Ten gets the same badge" requires.
public struct SplitMix64: RandomNumberGenerator, Sendable {
    private var state: UInt64
    public init(seed: UInt64) { state = seed }

    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

/// A stable hash for seeding. Swift's `Hashable` is deliberately randomized
/// per process, so it cannot be used for anything that has to reproduce.
public enum StableHash {
    /// FNV-1a over the string's UTF-8.
    public static func of(_ string: String) -> UInt64 {
        var hash: UInt64 = 0xCBF2_9CE4_8422_2325
        for byte in string.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        return hash
    }
}
