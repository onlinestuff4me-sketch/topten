import Foundation

/// The things a Ten can be about, and the words each one goes by.
///
/// A domain owns its vocabulary because the screen is the same screen and the
/// words are not (specs/design.md, round 5): a books shelf that counts its
/// items in "films" is the film app wearing a hat. Every noun the app says
/// about a collection comes from here, so there is exactly one place to be
/// wrong.
public enum Domain: String, Hashable, Sendable, Codable, CaseIterable {
    case movie, tv, book, game, restaurant, place

    /// What many of them are called: "movies", "shows", "books".
    public var plural: String {
        switch self {
        case .movie: "movies"
        case .tv: "shows"
        case .book: "books"
        case .game: "games"
        case .restaurant, .place: "places"
        }
    }

    /// What one of them is called.
    public var singular: String {
        switch self {
        case .movie: "movie"
        case .tv: "show"
        case .book: "book"
        case .game: "game"
        case .restaurant, .place: "place"
        }
    }

    /// The domain's name in a picker.
    public var label: String {
        switch self {
        case .movie: "Movies"
        case .tv: "TV shows"
        case .book: "Books"
        case .game: "Video games"
        case .restaurant: "Restaurants"
        case .place: "Travel destinations"
        }
    }

    /// What the domain calls the person a work is credited to. A book has an
    /// author, a film has a director, and a restaurant has neither — an axis
    /// with nothing behind it is a dead control, so it is absent rather than
    /// empty (specs/design.md, the books pass).
    public var creatorNoun: String? {
        switch self {
        case .movie: "Director"
        case .tv: "Creator"
        case .book: "Author"
        case .game: "Studio"
        case .restaurant, .place: nil
        }
    }

    /// What the domain calls the people who appear in a work, if any.
    public var performerNoun: String? {
        switch self {
        case .movie, .tv: "Actor"
        case .book, .game, .restaurant, .place: nil
        }
    }

    /// Whether things in this domain can be included with a subscription.
    /// Books and restaurants are not on Netflix.
    public var hasStreamingServices: Bool {
        switch self {
        case .movie, .tv: true
        case .book, .game, .restaurant, .place: false
        }
    }
}

/// A catalog item's identity. One id space across every domain, because the
/// app holds one collection: TMDB numbers films and shows separately and 1399
/// is both Game of Thrones and a film, so the offsets are applied when the
/// catalog is built rather than reasoned about at every read site
/// (specs/tech-stack.md, `build_tv.py`).
public struct ItemID: Hashable, Sendable, Codable, Comparable, CustomStringConvertible {
    public let rawValue: Int
    public init(_ rawValue: Int) { self.rawValue = rawValue }
    public static func < (lhs: ItemID, rhs: ItemID) -> Bool { lhs.rawValue < rhs.rawValue }
    public var description: String { String(rawValue) }
}

/// One thing that can go in a Ten, with exactly the metadata the app's rules
/// read. Deliberately not a TMDB shape: the catalog is one source today and
/// three next year, so the DTOs convert into this and nothing downstream
/// learns where a title came from (see `Catalog.swift`).
public struct Item: Hashable, Sendable, Codable, Identifiable {
    public let id: ItemID
    public let domain: Domain
    public let title: String
    /// Release/publication year.
    public let year: Int
    /// Genres or subjects, in the catalog's own vocabulary.
    public let genres: [String]
    /// Director, creator, author — whoever the work is credited to.
    public let creator: String?
    /// Billed cast, most prominent first. Empty where the domain has none.
    public let performers: [String]
    /// The series or collection this belongs to, if any ("Toy Story").
    public let series: String?
    /// The studio, imprint or network behind it, if it is one worth naming.
    public let brand: String?
    /// Dominant artwork color as a 6-digit hex string, used to derive the
    /// badge palette. `nil` where artwork has not been analysed.
    public let artworkHex: String?
    /// Audience score, 0...10, and how many votes produced it. Together these
    /// are the only measure of standing the Kit has.
    public let score: Double
    public let voteCount: Int

    public init(
        id: ItemID,
        domain: Domain,
        title: String,
        year: Int,
        genres: [String] = [],
        creator: String? = nil,
        performers: [String] = [],
        series: String? = nil,
        brand: String? = nil,
        artworkHex: String? = nil,
        score: Double = 0,
        voteCount: Int = 0
    ) {
        self.id = id
        self.domain = domain
        self.title = title
        self.year = year
        self.genres = genres
        self.creator = creator
        self.performers = performers
        self.series = series
        self.brand = brand
        self.artworkHex = artworkHex
        self.score = score
        self.voteCount = voteCount
    }

    /// The decade an item belongs to, as its first year: 1994 -> 1990.
    public var decade: Int { (year / 10) * 10 }

    /// How much the collection has to say about this item. A 9.1 with sixty
    /// votes is not the equal of an 8.4 with four hundred thousand, and a
    /// browse row sorted on score alone is a row of obscurities.
    public var standing: Double {
        score * log10(Double(voteCount) + 10)
    }
}
