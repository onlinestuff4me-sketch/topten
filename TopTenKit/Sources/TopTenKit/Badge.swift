import Foundation

/// A backplate silhouette. Hand-drawn assets; this enum is their id space.
///
/// Domain affinity is a lean, not a rule: a ticket stub skews movies, but any
/// shape is legal anywhere (specs/badges.md). A badge kit that hard-partitions
/// its shapes by domain produces a books case that looks like a different app.
public enum BadgeShape: String, Sendable, Codable, CaseIterable {
    case circleSeal, shield, laurelOval, ticketStub, starBurst, pennant
    case hexagonPlaque, ribbonRosette, filmReel, marqueeLozenge, keystone, scallopedMedal

    /// Domains this shape leans toward. Empty means it belongs everywhere.
    public var affinity: Set<Domain> {
        switch self {
        case .ticketStub, .filmReel, .marqueeLozenge: [.movie, .tv]
        case .keystone, .scallopedMedal: [.book]
        case .pennant, .starBurst: [.game]
        default: []
        }
    }
}

/// The backplate's finish.
public enum BadgeMaterial: String, Sendable, Codable, CaseIterable {
    case enamelGloss, brushedBrass, velvetMatte, frostedGlass, lacquer
}

/// A central emblem. The visual half of the inside joke.
///
/// In the shipping app this library is content — assets plus tags, delivered
/// with catalog updates, ~120 at launch. What lives in code is the *shape* of
/// a motif and the matching rule; the twelve below are the seed set the pre-
/// pass and its tests run against.
public struct Motif: Hashable, Sendable, Codable, Identifiable {
    public let id: String
    /// Lowercased tags matched against the list's own metadata.
    public let tags: Set<String>
    /// What a designer would call it, for the model's prompt.
    public let description: String

    public init(id: String, tags: Set<String>, description: String) {
        self.id = id
        self.tags = tags
        self.description = description
    }
}

/// The badge, fully described. Data, rendered live — never a flattened image
/// (specs/badges.md).
public struct BadgeComposition: Hashable, Sendable, Codable {
    public let shape: BadgeShape
    public let material: BadgeMaterial
    public let palette: BadgePalette
    public let motifID: String
    /// Whether the founder's laurel sprigs are drawn: reserved for a take
    /// among the first three ever made on its topic.
    public let hasFounderSprigs: Bool
    public let inscription: String
    /// The seed that produced this composition. Present so a badge can be
    /// re-derived rather than stored, and so a bug report can be replayed.
    public let seed: UInt64
    /// Which path produced it. The user must never be able to tell, but the
    /// team must always be able to.
    public let provenance: Provenance

    public enum Provenance: String, Sendable, Codable {
        /// Deterministic pre-pass only — the fallback ladder's bottom rung.
        case deterministic
        /// Foundation Models chose among the pre-pass's candidates.
        case guided
    }

    public init(
        shape: BadgeShape,
        material: BadgeMaterial,
        palette: BadgePalette,
        motifID: String,
        hasFounderSprigs: Bool,
        inscription: String,
        seed: UInt64,
        provenance: Provenance
    ) {
        self.shape = shape
        self.material = material
        self.palette = palette
        self.motifID = motifID
        self.hasFounderSprigs = hasFounderSprigs
        self.inscription = inscription
        self.seed = seed
        self.provenance = provenance
    }
}

/// Everything the pre-pass computed, including the roads not taken.
///
/// The candidate sets are the point: the Foundation Models pass **chooses from
/// these**, an id-constrained choice, so the model cannot name an asset that
/// does not exist. Its failure mode is a duller badge, never a broken one
/// (specs/badges.md, the generation pipeline).
public struct BadgeCandidates: Sendable {
    public let shapes: [BadgeShape]
    public let materials: [BadgeMaterial]
    public let motifs: [Motif]
    public let palette: BadgePalette
    public let inscriptions: [String]
    public let seed: UInt64
    /// Tokens drawn from the list itself. An inscription that contains none of
    /// them was not derived from this list, and is rejected.
    public let referenceTokens: Set<String>

    /// The complete badge this pass produces on its own — the fallback, and
    /// the thing the floor test judges.
    public func deterministicComposition(hasFounderSprigs: Bool = false) -> BadgeComposition {
        BadgeComposition(
            shape: shapes[0], material: materials[0], palette: palette,
            motifID: motifs[0].id, hasFounderSprigs: hasFounderSprigs,
            inscription: inscriptions[0], seed: seed, provenance: .deterministic
        )
    }
}

/// The deterministic pre-pass: everything a badge needs, computed in pure
/// Swift, before any model is asked anything.
///
/// This pass alone must yield a complete, good-looking badge, because it **is**
/// the fallback (specs/badges.md). Treating it as a stub that the model
/// improves is how the fallback ladder's bottom rung ends up shipping to every
/// device without Apple Intelligence.
public enum BadgePrePass {
    /// The seed motif library. Content in the shipping app; code here.
    public static let motifs: [Motif] = [
        Motif(id: "tommy-gun", tags: ["crime", "thriller", "gangster"], description: "a tommy gun, crossed"),
        Motif(id: "katana", tags: ["action", "martial arts", "revenge"], description: "a katana at rest"),
        Motif(id: "rose", tags: ["romance", "drama"], description: "a single rose"),
        Motif(id: "spaceship", tags: ["science fiction", "sci-fi", "space"], description: "a rocket in silhouette"),
        Motif(id: "briefcase-glow", tags: ["crime", "mystery", "heist"], description: "a briefcase, lit from within"),
        Motif(id: "masks", tags: ["comedy", "drama", "theatre"], description: "comedy and tragedy masks"),
        Motif(id: "lantern", tags: ["fantasy", "adventure", "animation"], description: "a paper lantern"),
        Motif(id: "skull", tags: ["horror", "war"], description: "a stylised skull"),
        Motif(id: "compass", tags: ["adventure", "history", "documentary"], description: "a brass compass"),
        Motif(id: "quill", tags: ["book", "history", "biography"], description: "a quill and inkwell"),
        Motif(id: "stag", tags: ["drama", "western", "nature"], description: "a stag's head"),
        Motif(id: "laurel-star", tags: [], description: "a star inside a laurel wreath"),
    ]

    /// Words too common to prove an inscription came from this list. Without
    /// this, "The Godfather" lends the token "the" to every line ever written.
    static let stopWords: Set<String> = [
        "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for",
        "part", "ii", "iii", "iv", "vol", "volume", "one", "two", "three",
    ]

    /// Run the pre-pass over a finished Ten.
    ///
    /// - Parameters:
    ///   - items: the Ten's items, best first.
    ///   - topic: what the list is.
    ///   - recentShapes: shapes already in the user's badge case, most recent
    ///     first. Weighted against, so a case reads as a collection rather
    ///     than as a repeat.
    public static func run(
        items: [Item],
        topic: Topic,
        recentShapes: [BadgeShape] = []
    ) -> BadgeCandidates {
        // The seed is the list plus the topic: the same Ten on the same topic
        // must produce the same badge on every device and every re-render, and
        // a different Ten must not.
        let seed = StableHash.of(topic.id + "|" + items.map(\.id.description).joined(separator: ","))
        var rng = SplitMix64(seed: seed)

        let palette = Palette.derive(from: items, seed: seed)
        let facts = ListFacts(items: items)

        // Shapes: domain affinity first, recently-used last, and a shuffle in
        // between so two lists with the same shape of metadata do not get the
        // same silhouette.
        // `uniquingKeysWith`, not `uniqueKeysWithValues`: a badge case can hold
        // the same shape twice, and the strict initialiser traps on a
        // duplicate key. Keep the most recent appearance.
        let recent = Dictionary(recentShapes.enumerated().map { ($1, $0) },
                                uniquingKeysWith: min)
        let shapes = BadgeShape.allCases
            .map { shape -> (BadgeShape, Double) in
                var weight = shape.affinity.isEmpty ? 1.0 : (shape.affinity.contains(topic.domain) ? 2.0 : 0.35)
                if let index = recent[shape] { weight *= 0.15 + 0.1 * Double(index) }
                return (shape, weight * (0.75 + Double(rng.next() % 500) / 1000))
            }
            .sorted { $0.1 > $1.1 || ($0.1 == $1.1 && $0.0.rawValue < $1.0.rawValue) }
            .map(\.0)

        // Motifs: how many of the list's own tags a motif matches, then a
        // seeded tiebreak. The untagged `laurel-star` is the floor and always
        // survives, so a list whose metadata matches nothing still gets an
        // emblem rather than an empty middle.
        let listTags = facts.tags
        let motifs = Self.motifs
            .map { motif -> (Motif, Double) in
                let hits = Double(motif.tags.intersection(listTags).count)
                let base = motif.tags.isEmpty ? 0.4 : hits
                return (motif, base + Double(rng.next() % 100) / 1000)
            }
            .sorted { $0.1 > $1.1 || ($0.1 == $1.1 && $0.0.id < $1.0.id) }
            .map(\.0)

        let materials = BadgeMaterial.allCases
            .map { ($0, Double(rng.next() % 1000)) }
            .sorted { $0.1 > $1.1 }
            .map(\.0)

        let tokens = facts.referenceTokens
        let inscriptions = Inscription.templates(facts: facts, topic: topic)
            .filter { Inscription.passes($0, rankOneTitle: items.first?.title, referenceTokens: tokens) }

        return BadgeCandidates(
            shapes: shapes,
            materials: materials,
            motifs: motifs,
            palette: palette,
            // A badge always has a line. If every template failed the check —
            // possible with an awkward list — the guaranteed line stands in,
            // and it is built to pass by construction.
            inscriptions: inscriptions.isEmpty ? [Inscription.guaranteed(facts: facts, topic: topic)] : inscriptions,
            seed: seed,
            referenceTokens: tokens
        )
    }
}

/// What a finished Ten is made of, counted once so the badge, the
/// inscriptions and the suggestions all read the same numbers.
public struct ListFacts: Sendable {
    public let items: [Item]
    /// Genre -> how many of the ten carry it, most common first.
    public let genres: [(String, Int)]
    /// Creator -> count, most common first.
    public let creators: [(String, Int)]
    /// Performer -> count, most common first (billed cast only).
    public let performers: [(String, Int)]
    /// Decade -> count, most common first.
    public let decades: [(Int, Int)]
    public let yearSpan: Int

    public init(items: [Item]) {
        self.items = items
        genres = Self.census(items.flatMap(\.genres))
        creators = Self.census(items.compactMap(\.creator))
        // Billed cast only: a face you would recognise on the poster, not the
        // fourteenth name in the credits.
        performers = Self.census(items.flatMap { $0.performers.prefix(3) })
        decades = Self.census(items.map(\.decade))
        let years = items.map(\.year)
        yearSpan = (years.max() ?? 0) - (years.min() ?? 0)
    }

    /// Deterministic: ties break on the value, never on dictionary order.
    static func census<T: Hashable & Comparable>(_ values: [T]) -> [(T, Int)] {
        var counts: [T: Int] = [:]
        for value in values { counts[value, default: 0] += 1 }
        return counts.sorted { $0.value > $1.value || ($0.value == $1.value && $0.key < $1.key) }
            .map { ($0.key, $0.value) }
    }

    public var topGenre: (String, Int)? { genres.first }
    public var topCreator: (String, Int)? { creators.first }
    public var topPerformer: (String, Int)? { performers.first }
    public var topDecade: (Int, Int)? { decades.first }

    /// Lowercased tags for motif matching.
    public var tags: Set<String> {
        Set(genres.map { $0.0.lowercased() })
            .union(items.compactMap { $0.domain == .book ? "book" : nil })
    }

    /// The words an inscription may be judged against — proof it came from
    /// this list and not from a generator's imagination.
    public var referenceTokens: Set<String> {
        var tokens = Set<String>()
        for item in items {
            for word in item.title.split(whereSeparator: { !$0.isLetter && !$0.isNumber }) {
                let lower = word.lowercased()
                if lower.count > 2, !BadgePrePass.stopWords.contains(lower) { tokens.insert(lower) }
            }
        }
        for (genre, _) in genres { tokens.insert(genre.lowercased()) }
        // Split the family name into words. "De Palma" went in whole once, as a
        // token with a space in it, which no tokenized line could ever match —
        // a reference token that cannot be matched is a clause that silently
        // does nothing.
        for (person, _) in creators + performers {
            guard let family = SurnameIndex.familyName(of: person) else { continue }
            for word in family.split(separator: " ") where word.count > 2 {
                tokens.insert(word.lowercased())
            }
        }
        for (decade, _) in decades { tokens.insert(TopicNaming.decadeName(decade)) }
        return tokens
    }
}
