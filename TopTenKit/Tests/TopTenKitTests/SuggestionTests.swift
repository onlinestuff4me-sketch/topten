import Testing

@testable import TopTenKit

@Suite("Suggestions: the fraction is the reason, never the name")
struct SuggestionTests {
    private var suggestions: [Suggestion] {
        RabbitHole.suggestions(after: Fixture.crimeNineties,
                               topic: TopicNaming.topic(for: .allTime(.movie)),
                               catalog: Fixture.shelf)
    }

    /// The acceptance criterion (specs/prd.md Req 5).
    @Test("At least five, spanning three specificity levels")
    func meetsTheBar() {
        let s = suggestions
        #expect(s.count >= RabbitHole.minimumSuggestions)
        #expect(Set(s.map(\.specificity)).count >= 3, "levels: \(s.map(\.specificity.rawValue))")
    }

    /// The correction of 2026-08-15, stated once as a test. A name is a rule
    /// true of ten out of ten; a reason is a fraction true of four out of ten.
    @Test("Every name is criteria; every reason is a count off your own ten")
    func nameIsRuleReasonIsFraction() {
        for s in suggestions {
            #expect(s.topic.title.hasPrefix("Top \(Ten.size) "),
                    "not a criteria name: \(s.topic.title)")
            #expect(!s.reason.contains(s.topic.title),
                    "the reason repeated the name: \(s.reason)")
        }
        // And at least one reason really is a fraction of the user's ten.
        #expect(suggestions.contains { $0.reason.contains("of your \(Ten.size)") })
    }

    /// A criteria name promises ten. Offering one the collection cannot fill
    /// breaks that promise on the very next screen.
    @Test("Nothing is offered that the collection cannot fill")
    func everyOfferIsFillable() {
        for s in suggestions {
            let available = Fixture.shelf.count(matching: s.topic.criteria)
            #expect(available >= Ten.size,
                    "offered \"\(s.topic.title)\" with only \(available) candidates")
        }
    }

    /// The gate has to bite, or the test above is vacuous.
    @Test("The gate really refuses things — it is not a formality")
    func gateIsLive() {
        // Horror is present in the collection (4 items) and can never fill a
        // Ten, so it must never be suggested even though the absent-genre rule
        // would otherwise reach for it.
        let horror = Criteria(domain: .movie, genre: "Horror")
        #expect(Fixture.shelf.count(matching: horror) > 0)
        #expect(Fixture.shelf.count(matching: horror) < Ten.size)
        #expect(!suggestions.contains { $0.topic.criteria == horror })
    }

    @Test("The list you just made is not suggested back to you")
    func doesNotSuggestTheCurrentTopic() {
        let current = Fixture.crimeNinetiesTopic
        let s = RabbitHole.suggestions(after: Fixture.crimeNineties, topic: current,
                                       catalog: Fixture.shelf)
        #expect(!s.contains { $0.topic.id == current.id })
    }

    @Test("No topic is offered twice")
    func noDuplicates() {
        let ids = suggestions.map(\.topic.id)
        #expect(Set(ids).count == ids.count, "duplicates in \(ids)")
    }

    /// A reason has to be true of the criteria being offered, not of either
    /// half of them: "4 of your 10 were crime movies from the 90s" is a count
    /// of items satisfying BOTH clauses.
    @Test("A two-clause reason counts items satisfying both clauses")
    func reasonCountsTheIntersection() {
        // Six crime films from the 2010s and four crime films from the 90s.
        // The top genre is Crime (10 of 10) and the top decade is the 2010s
        // (6 of 10), so the two-clause offer is Crime-of-the-2010s and its
        // reason must count the SIX that satisfy both — not the ten that
        // satisfy the genre, and not the six-plus-four of either half.
        var mixed: [Item] = []
        for i in 0..<6 {
            mixed.append(Fixture.movie(500 + i, "Modern Crime \(i)", 2015,
                                       genres: ["Crime"], director: "Someone \(i)"))
        }
        mixed += Array(Fixture.crimeNineties.prefix(4))
        // A shelf that can fill it, so the gate does not make this vacuous.
        var shelfItems = Fixture.shelf.items
        for i in 0..<12 {
            shelfItems.append(Fixture.movie(600 + i, "Crime 2010s \(i)", 2011 + i % 8,
                                            genres: ["Crime"], director: "Director \(i)"))
        }
        let catalog = InMemoryCatalog(items: shelfItems)

        let facts = ListFacts(items: mixed)
        #expect(facts.topDecade?.0 == 2010)
        let expected = mixed.filter { $0.genres.contains("Crime") && $0.decade == 2010 }.count
        #expect(expected == 6)

        let s = RabbitHole.suggestions(after: mixed,
                                       topic: TopicNaming.topic(for: .allTime(.movie)),
                                       catalog: catalog)
        let both = s.first { $0.topic.criteria.genre != nil && $0.topic.criteria.decade != nil }
        #expect(both != nil, "the two-clause offer was gated out; the shelf should fill it")
        #expect(both?.reason.hasPrefix("\(expected) of your \(Ten.size)") == true,
                "expected the intersection (\(expected)), got: \(both?.reason ?? "nothing")")
    }

    @Test("Suggestions stay in the domain you were working in")
    func staysInDomain() {
        let books = (0..<10).map {
            Item(id: ItemID(TMDB.bookIDOffset + $0), domain: .book, title: "Book \($0)",
                 year: 1950 + $0, genres: ["Romance"], creator: "Author \($0)",
                 score: 8, voteCount: 3000)
        }
        let s = RabbitHole.suggestions(after: books,
                                       topic: TopicNaming.topic(for: .allTime(.book)),
                                       catalog: Fixture.shelf)
        #expect(!s.isEmpty)
        #expect(s.allSatisfy { $0.topic.domain == .book })
        #expect(s.allSatisfy { $0.topic.title.contains("Books") })
    }

    @Test("A reason never claims a fraction bigger than the list")
    func fractionsAreHonest() {
        for s in suggestions where s.reason.contains("of your \(Ten.size)") {
            let leading = s.reason.split(separator: " ").first.map(String.init) ?? ""
            if let n = Int(leading) { #expect(n <= Ten.size, "claimed \(n) of \(Ten.size)") }
        }
    }
}

@Suite("Browsing the collection")
struct BrowseTests {
    @Test("Recent releases first, then popular, then genres")
    func rowOrder() {
        let rows = Browse.rows(for: .movie, catalog: Fixture.shelf)
        #expect(rows.count >= 3)
        #expect(rows[0].title == "Recent releases")
        #expect(rows[1].title == "Popular")
        #expect(rows.dropFirst(2).allSatisfy { $0.title.hasPrefix("Popular ") })
    }

    /// Rows come from the collection's own shape rather than a typed list, so
    /// a books or TV shelf gets its own rows with no second implementation.
    @Test("Genre rows follow the shelf, not a hand-kept list")
    func genreRowsComeFromTheData() {
        let movieRows = Browse.rows(for: .movie, catalog: Fixture.shelf).map(\.title)
        #expect(movieRows.contains("Popular crime movies"))
        let bookRows = Browse.rows(for: .book, catalog: Fixture.shelf).map(\.title)
        #expect(bookRows.contains { $0.contains("romance books") })
    }

    /// A popular drama belongs in Popular and in Popular dramas both.
    /// Suppressing the second is how a browse screen ends up with rows that
    /// are technically distinct and practically empty.
    @Test("Rows may share items, but no row duplicates another")
    func rowsOverlapButAreNotCopies() {
        let rows = Browse.rows(for: .movie, catalog: Fixture.shelf)
        let signatures = rows.map { $0.items.map(\.id.rawValue) }
        #expect(Set(signatures.map { $0.map(String.init).joined(separator: ",") }).count == rows.count)
        #expect(rows.allSatisfy { $0.items.count >= Browse.minimumRow })
    }

    @Test("Your own picks are held back — they have a home already")
    func excludesHeldItems() {
        let held: Set<ItemID> = [ItemID(1), ItemID(2)]
        let rows = Browse.rows(for: .movie, catalog: Fixture.shelf, excluding: held)
        #expect(rows.allSatisfy { row in row.items.allSatisfy { !held.contains($0.id) } })
    }

    @Test("A row never mixes domains")
    func rowsAreDomainScoped() {
        for domain in [Domain.movie, .tv, .book] {
            let rows = Browse.rows(for: domain, catalog: Fixture.shelf)
            #expect(rows.allSatisfy { $0.items.allSatisfy { $0.domain == domain } })
        }
    }

    @Test("An empty shelf produces no rows rather than empty ones")
    func emptyShelf() {
        #expect(Browse.rows(for: .game, catalog: Fixture.shelf).isEmpty)
    }
}

@Suite("The catalog boundary")
struct CatalogTests {
    /// A record with no usable year sorts into "recent releases" as if it came
    /// out in the year zero, and no decade criteria can ever match it. Better
    /// to drop it at the boundary than carry a broken one.
    @Test("A TMDB record with no usable year is dropped, not defaulted")
    func refusesYearlessRecords() {
        #expect(TMDB.MovieDTO(id: 1, title: "No date").item() == nil)
        #expect(TMDB.MovieDTO(id: 1, title: "Empty", releaseDate: "").item() == nil)
        #expect(TMDB.MovieDTO(id: 1, title: "Junk", releaseDate: "soon").item() == nil)
        #expect(TMDB.MovieDTO(id: 1, title: "Ancient", releaseDate: "0000-01-01").item() == nil)
        #expect(TMDB.MovieDTO(id: 1, title: "Fine", releaseDate: "1994-10-14").item()?.year == 1994)
    }

    /// TMDB numbers films and shows separately, and 1399 is both Game of
    /// Thrones and a film. One id space, offset in one place.
    @Test("TV ids are offset so one id space holds every domain")
    func idSpacesDoNotCollide() {
        let film = TMDB.MovieDTO(id: 1399, title: "A film", releaseDate: "2000-01-01").item()!
        let show = TMDB.MovieDTO(id: 1399, title: "A show", releaseDate: "2011-04-17").item(domain: .tv)!
        #expect(film.id != show.id)
        #expect(show.id.rawValue == 1399 + TMDB.tvIDOffset)
        #expect(film.domain == .movie && show.domain == .tv)
    }

    @Test("A DTO converts into the shape the rules read")
    func conversion() {
        let dto = TMDB.MovieDTO(
            id: 680, title: "Pulp Fiction", releaseDate: "1994-09-10",
            genres: ["Crime", "Thriller"], director: "Quentin Tarantino",
            cast: ["John Travolta"], collection: nil, brand: "Miramax",
            posterColorHex: "#8C2B1F", voteAverage: 8.5, voteCount: 27000
        )
        let item = dto.item()!
        #expect(item.title == "Pulp Fiction")
        #expect(item.year == 1994)
        #expect(item.decade == 1990)
        #expect(item.creator == "Quentin Tarantino")
        #expect(item.artworkHex == "#8C2B1F")
        #expect(Criteria(domain: .movie, genre: "Crime", decade: 1990).matches(item))
    }

    /// A 9.1 with sixty votes is not the equal of an 8.4 with four hundred
    /// thousand, and a browse row sorted on score alone is a row of
    /// obscurities.
    @Test("Standing weighs the score by how much the shelf can say")
    func standingWeighsVotes() {
        let obscure = Fixture.movie(1, "Obscure", 2000, score: 9.1, votes: 60)
        let known = Fixture.movie(2, "Known", 2000, score: 8.4, votes: 400_000)
        #expect(known.standing > obscure.standing)
    }

    @Test("The surname index can be built straight from a collection")
    func surnamesFromCollection() {
        let index = Fixture.shelf.surnames
        // One Tarantino on this shelf, so he shortens.
        #expect(index.display("Quentin Tarantino") == "Tarantino")
        // Two De Palmas would not, but one does — and the particle holds.
        #expect(index.display("Brian De Palma") == "De Palma")
    }
}
