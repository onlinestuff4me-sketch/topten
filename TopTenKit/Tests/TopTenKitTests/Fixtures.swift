import Foundation

@testable import TopTenKit

/// A small, explicit shelf. Hand-built rather than sampled from the real
/// catalog: a fixture that changes when TMDB changes is a fixture that makes
/// tests fail for reasons the test is not about.
enum Fixture {
    static func movie(
        _ id: Int, _ title: String, _ year: Int,
        genres: [String] = ["Drama"],
        director: String? = nil,
        cast: [String] = [],
        series: String? = nil,
        brand: String? = nil,
        hex: String? = nil,
        score: Double = 8.0,
        votes: Int = 1000
    ) -> Item {
        Item(id: ItemID(id), domain: .movie, title: title, year: year, genres: genres,
             creator: director, performers: cast, series: series, brand: brand,
             artworkHex: hex, score: score, voteCount: votes)
    }

    /// Ten crime films from the nineties, all satisfying one set of criteria —
    /// the shape a criteria-named list always has.
    static let crimeNineties: [Item] = [
        movie(1, "Pulp Fiction", 1994, genres: ["Crime", "Thriller"], director: "Quentin Tarantino",
              cast: ["John Travolta", "Samuel L. Jackson"], hex: "#8C2B1F", score: 8.5, votes: 27000),
        movie(2, "GoodFellas", 1990, genres: ["Crime", "Drama"], director: "Martin Scorsese",
              cast: ["Robert De Niro", "Ray Liotta"], hex: "#3B2A1A", score: 8.5, votes: 12000),
        movie(3, "Se7en", 1995, genres: ["Crime", "Thriller"], director: "David Fincher",
              cast: ["Brad Pitt", "Morgan Freeman"], hex: "#1E2224", score: 8.4, votes: 20000),
        movie(4, "Casino", 1995, genres: ["Crime", "Drama"], director: "Martin Scorsese",
              cast: ["Robert De Niro", "Sharon Stone"], score: 8.0, votes: 5000),
        movie(5, "Heat", 1995, genres: ["Crime", "Thriller"], director: "Michael Mann",
              cast: ["Al Pacino", "Robert De Niro"], score: 8.1, votes: 7000),
        movie(6, "Reservoir Dogs", 1992, genres: ["Crime", "Thriller"], director: "Quentin Tarantino",
              cast: ["Harvey Keitel", "Tim Roth"], score: 8.2, votes: 14000),
        movie(7, "Jackie Brown", 1997, genres: ["Crime", "Drama"], director: "Quentin Tarantino",
              cast: ["Pam Grier", "Samuel L. Jackson"], score: 7.5, votes: 4000),
        movie(8, "Carlito's Way", 1993, genres: ["Crime", "Drama"], director: "Brian De Palma",
              cast: ["Al Pacino", "Sean Penn"], score: 7.9, votes: 3000),
        movie(9, "Donnie Brasco", 1997, genres: ["Crime", "Drama"], director: "Mike Newell",
              cast: ["Al Pacino", "Johnny Depp"], score: 7.7, votes: 3500),
        movie(10, "The Usual Suspects", 1995, genres: ["Crime", "Mystery"], director: "Bryan Singer",
              cast: ["Kevin Spacey", "Gabriel Byrne"], score: 8.2, votes: 11000),
    ]

    /// A shelf wide enough to exercise the supply gate in both directions:
    /// some criteria it can fill, some it cannot.
    static let shelf: InMemoryCatalog = {
        var items = crimeNineties
        // Twelve science-fiction films — enough to offer. Their second genre
        // alternates, because two genres holding exactly the same items in the
        // same order is a real shape a small shelf can take, and the browse
        // rows have to be tested against a shelf where it does not happen by
        // accident.
        for i in 0..<12 {
            items.append(movie(100 + i, "Sci-Fi \(i)", 2001 + i,
                               genres: ["Science Fiction", i.isMultiple(of: 2) ? "Action" : "Adventure"],
                               director: "Director \(i)", cast: ["Star \(i)"],
                               score: 7.0 + Double(i) / 20, votes: 900 + i * 10))
        }
        // Deep enough benches that a person-scoped list can actually be
        // filled: without these the suggestion engine has nothing to offer at
        // the "very specific" level and the acceptance bar of five is untested.
        for i in 0..<9 {
            items.append(movie(300 + i, "Tarantino Extra \(i)", 2003 + i,
                               genres: ["Crime", "Drama"], director: "Quentin Tarantino",
                               cast: ["Regular \(i)"], score: 7.8, votes: 6000))
            items.append(movie(400 + i, "Pacino Extra \(i)", 1975 + i,
                               genres: ["Drama"], director: "Someone \(i)",
                               cast: ["Al Pacino", "Other \(i)"], score: 7.6, votes: 4000))
        }
        // Four horror films — a genre present in the collection but never
        // fillable, so "Top 10 Horror Movies" must be refused.
        for i in 0..<4 {
            items.append(movie(200 + i, "Horror \(i)", 1985 + i, genres: ["Horror"],
                               director: "Fright \(i)", score: 6.5, votes: 500))
        }
        // A handful of TV and books, so domain scoping is testable.
        for i in 0..<11 {
            items.append(Item(id: ItemID(TMDB.tvIDOffset + i), domain: .tv,
                              title: "Show \(i)", year: 2015 + i % 5, genres: ["Drama"],
                              creator: "Showrunner \(i)", performers: ["Lead \(i)"],
                              score: 8.0, voteCount: 2000))
        }
        // Two subjects, not one. A shelf where every book is Romance makes the
        // "Popular romance books" row an exact copy of the "Popular" row, and
        // a fixture that cannot tell those apart cannot test either.
        for i in 0..<22 {
            items.append(Item(id: ItemID(TMDB.bookIDOffset + i), domain: .book,
                              title: "Book \(i)", year: 1950 + i % 11,
                              genres: [i < 11 ? "Romance" : "Mystery"],
                              creator: "Author \(i)", score: 7.5 + Double(i % 7) / 10,
                              voteCount: 3000 + i * 50))
        }
        return InMemoryCatalog(items: items)
    }()

    static var crimeNinetiesTopic: Topic {
        TopicNaming.topic(for: Criteria(domain: .movie, genre: "Crime", decade: 1990))
    }
}
