import Testing

@testable import TopTenKit

@Suite("A list's name is its criteria")
struct TopicNamingTests {
    /// The shapes Mischa asked for by name, 2026-08-15. These are the
    /// acceptance criteria for the namer, written as the strings themselves —
    /// a naming rule described in prose is a naming rule nobody can check.
    @Test("Criteria render as the names a person would use", arguments: [
        (Criteria(domain: .movie), "Top 10 Movies of All Time"),
        (Criteria(domain: .movie, genre: "Crime", decade: 1990), "Top 10 Crime Movies of the 90s"),
        (Criteria(domain: .movie, genre: "Science Fiction"), "Top 10 Sci-Fi Movies"),
        (Criteria(domain: .movie, genre: "Animation", decade: 2000), "Top 10 Animated Movies of the 2000s"),
        (Criteria(domain: .movie, creator: "Hayao Miyazaki"), "Top 10 Hayao Miyazaki Movies"),
        (Criteria(domain: .movie, genre: "Thriller", creator: "Alfred Hitchcock"), "Top 10 Alfred Hitchcock Thrillers"),
        (Criteria(domain: .movie, performer: "Al Pacino"), "Top 10 Al Pacino Movies"),
        (Criteria(domain: .movie, genre: "Comedy", performer: "Eddie Murphy"), "Top 10 Eddie Murphy Comedies"),
        (Criteria(domain: .tv, genre: "Comedy"), "Top 10 Comedy Shows"),
        (Criteria(domain: .tv, decade: 1990), "Top 10 Shows of the 90s"),
        (Criteria(domain: .tv), "Top 10 Shows of All Time"),
        (Criteria(domain: .book, genre: "Romance"), "Top 10 Romance Books"),
        (Criteria(domain: .book, creator: "Jane Austen"), "Top 10 Jane Austen Books"),
        (Criteria(domain: .book), "Top 10 Books of All Time"),
    ])
    func names(criteria: Criteria, expected: String) {
        #expect(TopicNaming.title(for: criteria) == expected)
    }

    /// A genre that is its own plural noun says "movie" without saying it, so
    /// only movies get the shorthand: "Top 10 Romances" on a books shelf reads
    /// as films.
    @Test("Only movies use a genre as the noun")
    func genreShorthandIsMoviesOnly() {
        #expect(TopicNaming.title(for: Criteria(domain: .movie, genre: "Comedy")) == "Top 10 Comedies")
        #expect(TopicNaming.title(for: Criteria(domain: .tv, genre: "Comedy")) == "Top 10 Comedy Shows")
        #expect(TopicNaming.title(for: Criteria(domain: .book, genre: "Romance")) == "Top 10 Romance Books")
    }

    /// The title and the prompt are one sentence in two registers. If they can
    /// drift, a list can be introduced as one thing and named another.
    @Test("Title and prompt describe the same list", arguments: [
        (Criteria(domain: .movie, genre: "Crime", decade: 1990), "Your 10 favorite crime movies of the 90s."),
        (Criteria(domain: .movie), "Your 10 favorite movies of all time."),
        (Criteria(domain: .movie, genre: "Science Fiction"), "Your 10 favorite sci-fi movies."),
        (Criteria(domain: .tv, genre: "Comedy"), "Your 10 favorite comedy shows."),
        (Criteria(domain: .movie, genre: "Comedy", performer: "Eddie Murphy"), "Your 10 favorite Eddie Murphy comedies."),
    ])
    func prompts(criteria: Criteria, expected: String) {
        #expect(TopicNaming.prompt(for: criteria) == expected)
    }

    @Test("Every name begins with the number that limits it")
    func everyNameLeadsWithTen() {
        let all: [Criteria] = [
            .allTime(.movie), .allTime(.tv), .allTime(.book),
            Criteria(domain: .movie, genre: "Crime", decade: 1990),
            Criteria(domain: .book, creator: "Jane Austen"),
        ]
        for criteria in all {
            #expect(TopicNaming.title(for: criteria).hasPrefix("Top \(Ten.size) "))
        }
    }

    @Test("Decades read the way people say them")
    func decadeNames() {
        #expect(TopicNaming.decadeName(1990) == "90s")
        #expect(TopicNaming.decadeName(1970) == "70s")
        #expect(TopicNaming.decadeName(2000) == "2000s")
        #expect(TopicNaming.decadeName(2010) == "2010s")
    }

    /// Ids come from the clauses, never from the rendered name. Two locales
    /// must not produce two topics, and the badge gate has to ask "have you
    /// taken on THIS topic" twice and get the same answer.
    @Test("Identity comes from the criteria, not the words")
    func idIsStructural() {
        let a = Criteria(domain: .movie, genre: "Crime", decade: 1990)
        let b = Criteria(domain: .movie, genre: "Crime", decade: 1990)
        #expect(a.id == b.id)
        #expect(a.id == "movie:genre:Crime:decade:1990")
        // Same genre, different domain: different lists.
        #expect(Criteria(domain: .movie, genre: "Drama").id != Criteria(domain: .tv, genre: "Drama").id)
        // Shortening a person's name must not change what list it is.
        let long = TopicNaming.topic(for: Criteria(domain: .movie, creator: "Alfred Hitchcock"))
        let short = TopicNaming.topic(for: Criteria(domain: .movie, creator: "Alfred Hitchcock"),
                                      shortener: SurnameIndex(names: ["Alfred Hitchcock"]))
        #expect(long.id == short.id)
        #expect(long.title != short.title)
    }

    @Test("No two different topics render to the same name")
    func namesAreDistinct() {
        let criteria: [Criteria] = [
            .allTime(.movie), .allTime(.tv), .allTime(.book),
            Criteria(domain: .movie, genre: "Crime"),
            Criteria(domain: .movie, genre: "Crime", decade: 1990),
            Criteria(domain: .tv, genre: "Crime"),
            Criteria(domain: .book, genre: "Romance"),
            Criteria(domain: .movie, genre: "Romance"),
            Criteria(domain: .movie, creator: "Alfred Hitchcock"),
            Criteria(domain: .movie, performer: "Al Pacino"),
        ]
        let names = criteria.map { TopicNaming.title(for: $0) }
        #expect(Set(names).count == names.count, "collisions in: \(names)")
    }
}

@Suite("Shortening a name the way a person would")
struct SurnameTests {
    @Test("A surname alone only when the collection holds one of them")
    func shortensOnlyWhenUnambiguous() {
        let index = SurnameIndex(names: [
            "Alfred Hitchcock", "Hayao Miyazaki", "Goro Miyazaki",
            "Eddie Murphy", "Cillian Murphy", "Al Pacino", "Robert De Niro",
        ])
        #expect(index.display("Alfred Hitchcock") == "Hitchcock")
        #expect(index.display("Al Pacino") == "Pacino")
        // Two Miyazakis and three Murphys: both stay whole.
        #expect(index.display("Hayao Miyazaki") == "Hayao Miyazaki")
        #expect(index.display("Eddie Murphy") == "Eddie Murphy")
    }

    /// "Robert De Niro" is a De Niro, not a Niro. The prototype shipped this
    /// wrong for one round and produced "Top 10 Niro Movies".
    @Test("A particle stays with the name it precedes")
    func particlesStayAttached() {
        #expect(SurnameIndex.familyName(of: "Robert De Niro") == "De Niro")
        #expect(SurnameIndex.familyName(of: "Vincent van Gogh") == "van Gogh")
        #expect(SurnameIndex.familyName(of: "Brian De Palma") == "De Palma")
        #expect(SurnameIndex.familyName(of: "Paul Thomas Anderson") == "Anderson")
        let index = SurnameIndex(names: ["Robert De Niro"])
        #expect(index.display("Robert De Niro") == "De Niro")
    }

    /// A short tail is the second half of a given name, not a surname.
    @Test("Names that cannot be shortened are left alone", arguments: [
        "Bong Joon Ho", "Prince", "Wong Kar Wai",
    ])
    func refusesToShortenWhatItCannot(name: String) {
        #expect(SurnameIndex.familyName(of: name) == nil)
        #expect(SurnameIndex(names: [name]).display(name) == name)
    }

    @Test("The default index never shortens anything")
    func defaultIsWhole() {
        #expect(SurnameIndex.neverShortens.display("Alfred Hitchcock") == "Alfred Hitchcock")
    }
}

@Suite("A criteria name promises ten, so ten have to exist")
struct SupplyGateTests {
    /// The whole guarantee: the criteria filter the shelf, so a list cannot
    /// fail to match what it is called.
    @Test("Criteria matching is what makes a name true of all ten")
    func criteriaFilterTheShelf() {
        let criteria = Criteria(domain: .movie, genre: "Crime", decade: 1990)
        #expect(Fixture.crimeNineties.allSatisfy(criteria.matches))
        #expect(Fixture.crimeNineties.count == Ten.size)
    }

    @Test("A domain never leaks into another domain's list")
    func domainsDoNotMix() {
        let tv = Criteria(domain: .tv, genre: "Drama")
        #expect(Fixture.shelf.items(matching: tv, limit: 50).allSatisfy { $0.domain == .tv })
        #expect(Fixture.shelf.count(matching: Criteria(domain: .movie, genre: "Romance")) == 0)
    }

    /// "Top 10 Hitchcock Thrillers" is a fine name and an unofferable list on
    /// a shelf holding eight. The gate is what keeps the name's promise from
    /// breaking on the next screen.
    @Test("A list the collection cannot fill is refused")
    func gateRefusesWhatCannotBeFilled() {
        let fillable = Criteria(domain: .movie, genre: "Science Fiction")
        let unfillable = Criteria(domain: .movie, genre: "Horror")
        #expect(Fixture.shelf.count(matching: fillable) >= Ten.size)
        #expect(Fixture.shelf.count(matching: unfillable) < Ten.size)
        #expect(fillable.isOfferable(from: Fixture.shelf.items))
        #expect(unfillable.isOfferable(from: Fixture.shelf.items) == false)
    }

    @Test("The bar is exactly ten — not nine, not eleven")
    func gateBoundary() {
        let c = Criteria(domain: .movie)
        #expect(c.isOfferable(candidates: Ten.size))
        #expect(c.isOfferable(candidates: Ten.size - 1) == false)
        #expect(Criteria.minimumCandidates == Ten.size)
    }
}
