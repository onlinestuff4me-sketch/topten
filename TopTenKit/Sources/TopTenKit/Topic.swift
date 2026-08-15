import Foundation

/// The rule a Ten is built under, and therefore the rule its name states.
///
/// **A list's name is its criteria** (specs/prd.md Req 12, amended 2026-08-15
/// by Mischa). "Top 10 Crime Movies of the 90s" holds ten crime movies from
/// the 1990s — not four — and it does so not because anything re-checks the
/// finished list, but because these criteria are exactly what filtered the
/// shelf it was built from. Naming and scoping are one act, which is why they
/// are one type.
///
/// The distinction this replaces is worth keeping in view:
///
/// - a **name** is a rule, true of 10 out of 10
/// - a **reason** is a fraction, true of 4 out of 10, and it is why the app
///   offers you a list you have not made yet (see `Suggestion`)
public struct Criteria: Hashable, Sendable, Codable {
    public var domain: Domain
    /// A genre or subject every item must carry.
    public var genre: String?
    /// A director, creator or author every item must be credited to.
    public var creator: String?
    /// A performer every item must feature.
    public var performer: String?
    /// A decade, as its first year, every item must fall in.
    public var decade: Int?

    public init(
        domain: Domain,
        genre: String? = nil,
        creator: String? = nil,
        performer: String? = nil,
        decade: Int? = nil
    ) {
        self.domain = domain
        self.genre = genre
        self.creator = creator
        self.performer = performer
        self.decade = decade
    }

    /// The all-time list for a domain: no rule but the domain itself.
    public static func allTime(_ domain: Domain) -> Criteria { Criteria(domain: domain) }

    /// Whether this is the domain's unrestricted list.
    public var isAllTime: Bool {
        genre == nil && creator == nil && performer == nil && decade == nil
    }

    /// Whether an item satisfies every clause. This is the whole guarantee
    /// behind a criteria name: it filters the shelf, so the finished Ten
    /// cannot fail to match what it is called.
    public func matches(_ item: Item) -> Bool {
        guard item.domain == domain else { return false }
        if let creator, item.creator != creator { return false }
        if let performer, !item.performers.contains(performer) { return false }
        if let genre, !item.genres.contains(genre) { return false }
        if let decade, item.decade != decade { return false }
        return true
    }

    /// A stable identity for the criteria, so the badge gate can ask "have you
    /// taken on THIS topic" twice and get the same answer both times. Derived
    /// from the clauses, never from the rendered name — two locales must not
    /// produce two topics.
    public var id: String {
        var parts = [domain.rawValue]
        if let creator { parts.append("creator:\(creator)") }
        if let performer { parts.append("performer:\(performer)") }
        if let genre { parts.append("genre:\(genre)") }
        if let decade { parts.append("decade:\(decade)") }
        return parts.joined(separator: ":")
    }
}

/// A named list-to-be: criteria, plus the words the app says about them.
///
/// Built through ``TopicNaming`` rather than by hand, so a topic cannot exist
/// with a name that disagrees with its rule.
public struct Topic: Hashable, Sendable, Codable, Identifiable {
    public let criteria: Criteria
    /// "Top 10 Crime Movies of the 90s"
    public let title: String
    /// "Your 10 favorite crime movies of the 90s."
    public let prompt: String

    public var id: String { criteria.id }
    public var domain: Domain { criteria.domain }

    public init(criteria: Criteria, title: String, prompt: String) {
        self.criteria = criteria
        self.title = title
        self.prompt = prompt
    }
}

// MARK: - Naming

/// Turning criteria into the words a person would use for them.
///
/// Foundation Models has a job here (specs/prd.md Req 5) and it is not this
/// one: the model chooses **which** criteria are worth offering, and may
/// shorten a name the way a person would. It never writes one, because a
/// written name can be false while a rule cannot. What follows is the floor
/// that runs when the model is unavailable, and it is what ships first.
public enum TopicNaming {
    /// Genres that are already the plural noun for the thing itself — a person
    /// says "Eddie Murphy comedies", not "Eddie Murphy comedy movies".
    ///
    /// Only movies get the shorthand. "Top 10 Romances" on a books shelf, or
    /// "Top 10 Comedies" on a TV shelf, both read as films.
    static let genreAsNoun: [String: String] = [
        "Comedy": "Comedies",
        "Thriller": "Thrillers",
        "Drama": "Dramas",
        "Documentary": "Documentaries",
        "Western": "Westerns",
        "Mystery": "Mysteries",
        "Romance": "Romances",
    ]

    /// Genres whose catalog label is not the word anyone uses.
    static let genreAsAdjective: [String: String] = [
        "Science Fiction": "Sci-Fi",
        "Sci-Fi & Fantasy": "Sci-Fi",
        "Action & Adventure": "Action",
        "Animation": "Animated",
        "History": "Historical",
        "War & Politics": "War",
    ]

    /// The parts of a name, decomposed once. The title and the prompt are the
    /// same sentence in two registers and are built from this, so they cannot
    /// drift into describing different lists — which is precisely how a list
    /// ends up misnamed.
    struct Parts: Equatable {
        var person: String?
        var adjective: String?
        var head: String
        var tail: String
        var tailLowercased: String
    }

    static func parts(for c: Criteria, shortener: SurnameIndex) -> Parts {
        let head = c.domain == .movie ? c.genre.flatMap { genreAsNoun[$0] } : nil
        let adjective: String? = head == nil
            ? c.genre.map { genreAsAdjective[$0] ?? $0 }
            : nil
        let tail: String
        let tailLower: String
        if let decade = c.decade {
            tail = " of the \(decadeName(decade))"
            tailLower = tail
        } else if c.isAllTime {
            tail = " of All Time"
            tailLower = " of all time"
        } else {
            tail = ""
            tailLower = ""
        }
        return Parts(
            person: (c.creator ?? c.performer).map(shortener.display),
            adjective: adjective,
            head: head ?? c.domain.plural.capitalizedFirst,
            tail: tail,
            tailLowercased: tailLower
        )
    }

    /// "Top 10 Crime Movies of the 90s"
    public static func title(for c: Criteria, shortener: SurnameIndex = .neverShortens) -> String {
        let p = parts(for: c, shortener: shortener)
        let stem = [p.person, p.adjective, p.head].compactMap { $0 }.joined(separator: " ")
        return "Top \(Ten.size) \(stem)\(p.tail)"
    }

    /// "Your 10 favorite crime movies of the 90s."
    public static func prompt(for c: Criteria, shortener: SurnameIndex = .neverShortens) -> String {
        let p = parts(for: c, shortener: shortener)
        let stem = [p.person, p.adjective?.lowercased(), p.head.lowercased()]
            .compactMap { $0 }.joined(separator: " ")
        return "Your \(Ten.size) favorite \(stem)\(p.tailLowercased)."
    }

    /// Criteria in, a whole topic out: named, phrased and identified in one
    /// place. The only supported way to make a `Topic`.
    public static func topic(for c: Criteria, shortener: SurnameIndex = .neverShortens) -> Topic {
        Topic(criteria: c, title: title(for: c, shortener: shortener),
              prompt: prompt(for: c, shortener: shortener))
    }

    /// 1990 -> "90s", 2000 -> "2000s". Two-digit only below the millennium,
    /// because "the 00s" is not what anybody says.
    public static func decadeName(_ decade: Int) -> String {
        decade >= 2000 ? "\(decade)s" : "\(String(decade).suffix(2))s"
    }
}

// MARK: - Offering a list

public extension Criteria {
    /// The number of candidates a criteria list needs before it may be
    /// offered. A criteria name promises ten entries that all satisfy it, so
    /// the criteria have to have ten to give.
    static let minimumCandidates = Ten.size

    /// Whether a collection can actually fill this list.
    ///
    /// "Top 10 Hitchcock Thrillers" is a fine name and an unofferable list on
    /// a collection holding eight of them. Offering it would break the name's
    /// promise on the very next screen, so it is refused here instead
    /// (specs/prd.md Req 12, 2026-08-15).
    func isOfferable(candidates: Int) -> Bool {
        candidates >= Self.minimumCandidates
    }

    /// Whether a specific collection can fill this list.
    func isOfferable(from items: some Sequence<Item>) -> Bool {
        var found = 0
        for item in items where matches(item) {
            found += 1
            if found >= Self.minimumCandidates { return true }
        }
        return false
    }
}

// MARK: - Shortening a person's name

/// "Alfred Hitchcock" -> Hitchcock, because that is the list people ask for.
///
/// Only when the collection holds exactly one person with that family name:
/// "Murphy" is Eddie, Cillian and Ryan, and "Miyazaki" is Hayao and Goro, so
/// both of those stay whole. Built from the collection rather than from a
/// hand-kept list of famous people, which would be wrong the day the catalog
/// grows.
public struct SurnameIndex: Sendable {
    /// Family name -> the full names that end in it.
    private let owners: [String: Set<String>]

    /// An index that never shortens anything. The honest default: a full name
    /// is never wrong, only longer.
    public static let neverShortens = SurnameIndex(owners: [:])

    private init(owners: [String: Set<String>]) { self.owners = owners }

    /// Build the index from every person the collection knows about.
    public init(names: some Sequence<String>) {
        var owners: [String: Set<String>] = [:]
        for name in names {
            guard let family = Self.familyName(of: name), family.count > 3 else { continue }
            owners[family, default: []].insert(name)
        }
        self.owners = owners
    }

    /// Build the index from a collection's creators and performers.
    public init(items: some Sequence<Item>) {
        self.init(names: items.flatMap { item in
            ([item.creator].compactMap { $0 }) + item.performers
        })
    }

    /// The name to print for this person.
    public func display(_ fullName: String) -> String {
        guard let family = Self.familyName(of: fullName),
              let holders = owners[family], holders.count == 1 else { return fullName }
        return family
    }

    /// Particles belong to the name they precede: "Robert De Niro" is a De
    /// Niro, not a Niro, and "Vincent van Gogh" is a van Gogh.
    static let particles: Set<String> = [
        "de", "del", "della", "der", "di", "du", "da", "das", "do", "dos",
        "la", "le", "van", "von", "ter", "ten", "bin", "al", "st.",
    ]

    /// The part of a name that could stand alone, or `nil` if none can.
    ///
    /// A short tail is the second half of a given name — "Bong Joon Ho" is not
    /// a Ho — so anything of three characters or fewer disqualifies the name
    /// from shortening at all.
    public static func familyName(of fullName: String) -> String? {
        let parts = fullName.split(whereSeparator: { $0 == " " }).map(String.init)
        guard parts.count > 1 else { return nil }
        guard let last = parts.last, last.count > 3 else { return nil }
        var start = parts.count - 1
        while start > 1, particles.contains(parts[start - 1].lowercased()) { start -= 1 }
        return parts[start...].joined(separator: " ")
    }
}

extension String {
    var capitalizedFirst: String {
        guard let first else { return self }
        return String(first).uppercased() + dropFirst()
    }
}
