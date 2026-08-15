import Foundation

/// A list the app thinks you should make next, and why.
///
/// The **why** is the whole point of this type existing separately from
/// `Topic`. A topic's name is a rule true of ten out of ten; a suggestion's
/// reason is a fraction true of four out of ten, counted off the list you just
/// finished (specs/prd.md Req 12, corrected 2026-08-15 by Mischa):
///
///     Top 10 Crime Movies of the 90s
///     4 of your 10 were crime movies from the 90s.
///
/// The name is the rule; the fraction is why we are suggesting it. Keeping
/// those apart is the correction, and `reason` may never contain `topic.title`.
public struct Suggestion: Hashable, Sendable, Identifiable {
    public enum Specificity: String, Sendable, CaseIterable, Comparable {
        case verySpecific, specific, broad

        public var label: String {
            switch self {
            case .verySpecific: "Very specific"
            case .specific: "Specific"
            case .broad: "Broad"
            }
        }

        private var order: Int {
            switch self {
            case .verySpecific: 0
            case .specific: 1
            case .broad: 2
            }
        }

        public static func < (lhs: Self, rhs: Self) -> Bool { lhs.order < rhs.order }
    }

    public let topic: Topic
    public let specificity: Specificity
    public let reason: String

    public var id: String { topic.id }

    public init(topic: Topic, specificity: Specificity, reason: String) {
        self.topic = topic
        self.specificity = specificity
        self.reason = reason
    }
}

/// What to offer someone who has just finished a Ten.
///
/// The engine Foundation Models will eventually front (specs/prd.md Req 5).
/// Its job there is to choose **which** of these criteria are worth offering
/// and to write a better provocation; the candidate set, the counting and the
/// supply gate stay here, because those are the parts that can be wrong.
public enum RabbitHole {
    /// The acceptance bar: at least five suggestions spanning three
    /// specificity levels (Req 5).
    public static let minimumSuggestions = 5

    /// Build suggestions from a finished list.
    ///
    /// - Parameters:
    ///   - items: the Ten just finished, best first.
    ///   - topic: what it was.
    ///   - catalog: what the collection can supply. Every candidate is gated
    ///     on ten matching items, because a criteria name promises ten and the
    ///     next screen has to keep that promise.
    ///   - limit: how many to return.
    public static func suggestions(
        after items: [Item],
        topic: Topic,
        catalog: some CatalogSupply,
        shortener: SurnameIndex = .neverShortens,
        limit: Int = 6
    ) -> [Suggestion] {
        let facts = ListFacts(items: items)
        let domain = topic.domain
        let noun = domain.plural
        let one = domain.singular
        var candidates: [(Criteria, Suggestion.Specificity, String)] = []

        let genre = facts.topGenre
        let decade = facts.topDecade

        // Very specific: two clauses at once, and the count is of items that
        // satisfy BOTH — the reason has to be true of the criteria being
        // offered, not of either half of them.
        if let (g, _) = genre, let (d, _) = decade {
            let both = items.filter { $0.genres.contains(g) && $0.decade == d }.count
            candidates.append((
                Criteria(domain: domain, genre: g, decade: d), .verySpecific,
                "\(both) of your \(Ten.size) were \(genreWord(g)) \(noun) from the \(TopicNaming.decadeName(d))."
            ))
        }
        // "By" covers a director and an author both — a domain-specific verb
        // would not, and books have no directors.
        if let (creator, n) = facts.topCreator, n >= 2 {
            candidates.append((
                Criteria(domain: domain, creator: creator), .verySpecific,
                "\(n) of your \(Ten.size) were by \(creator)."
            ))
        }
        if let (performer, n) = facts.topPerformer, n >= 2 {
            candidates.append((
                Criteria(domain: domain, performer: performer), .verySpecific,
                "\(n) of your \(Ten.size) starred \(performer)."
            ))
        }
        if let (g, n) = genre {
            let reason = n >= Ten.size
                ? "All \(Ten.size) of your \(Ten.size) were \(genreWord(g)) \(noun). Make it official."
                : "\(n) of your \(Ten.size) were \(genreWord(g)) \(noun). Commit."
            candidates.append((Criteria(domain: domain, genre: g), .specific, reason))
        }
        // The absence is as good a reason as the presence, and it is the one
        // that gets someone out of their own rut.
        if let missing = absentGenre(from: facts, domain: domain, catalog: catalog) {
            candidates.append((
                Criteria(domain: domain, genre: missing), .specific,
                "Not one \(genreWord(missing)) \(one) made your \(Ten.size). Suspicious."
            ))
        }
        if let (d, n) = decade {
            candidates.append((
                Criteria(domain: domain, decade: d), .broad,
                "\(n) of your \(Ten.size) came from the \(TopicNaming.decadeName(d))."
            ))
        }
        candidates.append((
            Criteria.allTime(domain), .broad,
            "Taste moves. Re-rank from scratch and see."
        ))

        var seen: Set<String> = [topic.id]
        var out: [Suggestion] = []
        for (criteria, specificity, reason) in candidates {
            guard !seen.contains(criteria.id) else { continue }
            guard criteria.isOfferable(candidates: catalog.count(matching: criteria)) else { continue }
            seen.insert(criteria.id)
            out.append(Suggestion(
                topic: TopicNaming.topic(for: criteria, shortener: shortener),
                specificity: specificity, reason: reason
            ))
            if out.count == limit { break }
        }
        return out
    }

    /// The genre most conspicuously missing from a list — present in the
    /// collection in real numbers, absent from the ten entirely.
    static func absentGenre(
        from facts: ListFacts,
        domain: Domain,
        catalog: some CatalogSupply
    ) -> String? {
        let present = Set(facts.genres.map(\.0))
        return catalog.genres(in: domain)
            .first { !present.contains($0) }
    }

    /// The word a genre goes by in a sentence, so a suggestion's reason and
    /// the name above it call the same thing the same thing.
    static func genreWord(_ genre: String) -> String {
        (TopicNaming.genreAsAdjective[genre] ?? genre).lowercased()
    }
}
