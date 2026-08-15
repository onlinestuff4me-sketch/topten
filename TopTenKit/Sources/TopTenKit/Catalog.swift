import Foundation

/// What the rules need to ask a collection, and nothing more.
///
/// Kept this narrow on purpose. Everything above it — suggestions, the supply
/// gate, browse rows — depends only on these three questions, so the same
/// logic runs against TMDB, against a baked local shelf, and against a test
/// double built in four lines. Nothing downstream learns where a title came
/// from.
public protocol CatalogSupply: Sendable {
    /// How many items satisfy the criteria. The number the supply gate reads.
    func count(matching criteria: Criteria) -> Int
    /// Genres present in a domain, most of the shelf first. The order is the
    /// collection's own shape, which is what makes browse rows come from the
    /// data rather than from a list somebody typed.
    func genres(in domain: Domain) -> [String]
    /// Items satisfying the criteria, best first, capped.
    func items(matching criteria: Criteria, limit: Int) -> [Item]
}

/// A collection held in memory. The shipping app's baked shelf, and every
/// test's fixture, are both this.
public struct InMemoryCatalog: CatalogSupply, Sendable {
    public let items: [Item]
    private let byDomain: [Domain: [Item]]

    public init(items: [Item]) {
        self.items = items
        byDomain = Dictionary(grouping: items, by: \.domain)
    }

    public func count(matching criteria: Criteria) -> Int {
        (byDomain[criteria.domain] ?? []).reduce(0) { criteria.matches($1) ? $0 + 1 : $0 }
    }

    public func genres(in domain: Domain) -> [String] {
        ListFacts.census((byDomain[domain] ?? []).flatMap(\.genres)).map(\.0)
    }

    public func items(matching criteria: Criteria, limit: Int) -> [Item] {
        (byDomain[criteria.domain] ?? [])
            .filter(criteria.matches)
            .sorted { $0.standing > $1.standing || ($0.standing == $1.standing && $0.id < $1.id) }
            .prefix(limit)
            .map { $0 }
    }

    /// Every person the collection knows, for surname shortening.
    public var surnames: SurnameIndex { SurnameIndex(items: items) }
}

// MARK: - Browse rows

/// A shelf of items under one heading.
public struct BrowseRow: Sendable, Identifiable {
    public let id: String
    public let title: String
    public let items: [Item]

    public init(id: String, title: String, items: [Item]) {
        self.id = id
        self.title = title
        self.items = items
    }
}

public enum Browse {
    public static let rowSize = 20
    public static let minimumRow = 6
    public static let maximumGenreRows = 9

    /// Recent releases, then popularity, then a row per genre in the order
    /// that genre actually occupies the shelf.
    ///
    /// Rows deliberately **do** overlap: a popular drama belongs in Popular
    /// and in Popular dramas both, and pruning the second because the first
    /// got there first is how a browse screen ends up with rows that are
    /// technically distinct and practically empty (specs/design.md, round 7).
    /// Only the user's own picks are held back, because those have a home.
    public static func rows(
        for domain: Domain,
        catalog: InMemoryCatalog,
        excluding held: Set<ItemID> = []
    ) -> [BrowseRow] {
        let shelf = catalog.items.filter { $0.domain == domain && !held.contains($0.id) }
        guard !shelf.isEmpty else { return [] }
        var rows: [BrowseRow] = []

        // Rows share items freely, but a row that is a *copy* of an earlier
        // one is not a second row — two genres can hold exactly the same items
        // in exactly the same order on a small shelf, and shipping both is how
        // a browse screen pads itself.
        var signatures = Set<[Int]>()
        func add(_ id: String, _ title: String, _ list: [Item]) {
            let taken = Array(list.prefix(rowSize))
            guard taken.count >= minimumRow else { return }
            guard signatures.insert(taken.map(\.id.rawValue)).inserted else { return }
            rows.append(BrowseRow(id: id, title: title, items: taken))
        }

        // Newest first, but a release with nine votes is not one anybody is
        // looking for — within a year, order by how much the shelf can say.
        add("recent", "Recent releases",
            shelf.sorted { $0.year > $1.year || ($0.year == $1.year && $0.standing > $1.standing) })
        add("popular", "Popular", shelf.sorted { $0.standing > $1.standing })

        for genre in catalog.genres(in: domain).prefix(maximumGenreRows) {
            add("genre:\(genre)", "Popular \(genrePhrase(genre, domain: domain))",
                shelf.filter { $0.genres.contains(genre) }.sorted { $0.standing > $1.standing })
        }
        return rows
    }

    /// "dramas", "action movies", "sci-fi movies" — built from the same
    /// decomposition that names a list, so a genre cannot go by two different
    /// words in two parts of one app.
    static func genrePhrase(_ genre: String, domain: Domain) -> String {
        let parts = TopicNaming.parts(
            for: Criteria(domain: domain, genre: genre),
            shortener: .neverShortens
        )
        return [parts.adjective?.lowercased(), parts.head.lowercased()]
            .compactMap { $0 }.joined(separator: " ")
    }
}

// MARK: - TMDB

/// The shapes TMDB actually returns, and the only place in the Kit that knows
/// them. They convert into `Item` at the boundary; nothing else imports these.
public enum TMDB {
    /// TV ids are offset because TMDB numbers films and shows separately and
    /// 1399 is both Game of Thrones and a film. One id space in the app,
    /// arranged in one place (specs/tech-stack.md).
    public static let tvIDOffset = 10_000_000
    /// Books are not TMDB at all, and get their own block above TV.
    public static let bookIDOffset = 20_000_000

    public struct MovieDTO: Sendable, Codable {
        public let id: Int
        public let title: String
        public let releaseDate: String?
        public let genres: [String]?
        public let director: String?
        public let cast: [String]?
        public let collection: String?
        public let brand: String?
        public let posterColorHex: String?
        public let voteAverage: Double?
        public let voteCount: Int?

        public init(
            id: Int, title: String, releaseDate: String? = nil, genres: [String]? = nil,
            director: String? = nil, cast: [String]? = nil, collection: String? = nil,
            brand: String? = nil, posterColorHex: String? = nil,
            voteAverage: Double? = nil, voteCount: Int? = nil
        ) {
            self.id = id; self.title = title; self.releaseDate = releaseDate
            self.genres = genres; self.director = director; self.cast = cast
            self.collection = collection; self.brand = brand
            self.posterColorHex = posterColorHex
            self.voteAverage = voteAverage; self.voteCount = voteCount
        }

        /// - Returns: `nil` when the record has no usable year. A catalog item
        ///   with year 0 sorts into "recent releases" as if it came out in the
        ///   year zero, and a decade criteria can never match it — better to
        ///   drop the record at the boundary than to carry a broken one.
        public func item(domain: Domain = .movie) -> Item? {
            guard let year = Self.year(from: releaseDate) else { return nil }
            let offset = domain == .tv ? tvIDOffset : 0
            return Item(
                id: ItemID(id + offset), domain: domain, title: title, year: year,
                genres: genres ?? [], creator: director, performers: cast ?? [],
                series: collection, brand: brand, artworkHex: posterColorHex,
                score: voteAverage ?? 0, voteCount: voteCount ?? 0
            )
        }

        /// TMDB dates are "YYYY-MM-DD", and are sometimes "" or absent.
        static func year(from date: String?) -> Int? {
            guard let date, date.count >= 4,
                  let year = Int(date.prefix(4)), year > 1800 else { return nil }
            return year
        }
    }
}
