import Testing

@testable import TopTenKit

@Suite("Palette: the badge takes its colour from this list")
struct PaletteTests {
    @Test("Hex parses, and refuses what is not a colour", arguments: [
        "#FFFFFF", "000000", "#1a2b3c",
    ])
    func parsesHex(hex: String) {
        #expect(RGB(hex: hex) != nil)
    }

    /// A catalog with a bad colour must not silently become black.
    @Test("Bad hex is nil, not black", arguments: [
        "", "#FFF", "#GGGGGG", "12345", "#1234567", "not a colour",
    ])
    func rejectsBadHex(hex: String) {
        #expect(RGB(hex: hex) == nil)
    }

    @Test("Hex round-trips")
    func hexRoundTrip() {
        for hex in ["#000000", "#FFFFFF", "#8C2B1F", "#3B2A1A"] {
            #expect(RGB(hex: hex)?.hex == hex)
        }
    }

    @Test("Lab agrees with the reference points it is defined by")
    func labReferencePoints() {
        let white = Palette.lch(from: RGB(hex: "#FFFFFF")!)
        #expect(abs(white.l - 100) < 0.5)
        #expect(white.c < 0.5)
        let black = Palette.lch(from: RGB(hex: "#000000")!)
        #expect(abs(black.l) < 0.5)
        let mid = Palette.lch(from: RGB(hex: "#808080")!)
        #expect(mid.c < 0.5, "grey has no chroma")
        #expect(mid.l > 40 && mid.l < 60)
    }

    @Test("RGB survives a trip through LCH")
    func lchRoundTrip() {
        for hex in ["#8C2B1F", "#3B2A1A", "#1E2224", "#4477AA", "#AA7744"] {
            let original = RGB(hex: hex)!
            let back = Palette.rgb(from: Palette.lch(from: original))
            #expect(abs(back.r - original.r) < 0.01)
            #expect(abs(back.g - original.g) < 0.01)
            #expect(abs(back.b - original.b) < 0.01)
        }
    }

    /// Outside the Laurel-safe window a badge is either mud or a highlighter,
    /// and the lineup test — twenty badges reading as one family — is the
    /// thing that fails first (specs/badges.md).
    @Test("Every derived colour lands inside the safe window")
    func clampsIntoTheSafeWindow() {
        let extremes = [
            Fixture.movie(1, "Black", 2000, hex: "#000000"),
            Fixture.movie(2, "White", 2000, hex: "#FFFFFF"),
            Fixture.movie(3, "Neon", 2000, hex: "#00FF00"),
        ]
        let palette = Palette.derive(from: extremes)
        for colour in [palette.primary, palette.secondary] {
            let lch = Palette.lch(from: colour)
            // The clamp is exact in LCH; this measures it after a round trip
            // back through sRGB, where a very saturated hue can fall outside
            // the gamut and get clipped, shifting L and C by a few points. The
            // product requirement is what is asserted — never near-black,
            // never near-white, never a highlighter — and the exact clamp is
            // tested on its own in `clampKeepsHue`.
            #expect(lch.l >= 18, "too dark: L \(lch.l)")
            #expect(lch.l <= 82, "too light: L \(lch.l)")
            #expect(lch.c <= 70, "too saturated: C \(lch.c)")
        }
    }

    @Test("Clamping keeps the hue and gives up lightness and chroma")
    func clampKeepsHue() {
        let garish = LCH(l: 4, c: 120, h: 210)
        let safe = Palette.clampToSafeRange(garish)
        #expect(safe.h == garish.h)
        #expect(safe.l == Palette.safeLightness.lowerBound)
        #expect(safe.c == Palette.maximumChroma)
    }

    /// Artwork is optional metadata and a badge is not.
    @Test("A list with no artwork still gets a palette")
    func fallbackPalette() {
        let colourless = (1...3).map { Fixture.movie($0, "No art \($0)", 2000) }
        let palette = Palette.derive(from: colourless, seed: 99)
        #expect(palette.sourceHues.isEmpty)
        #expect(palette.primary != palette.secondary)
        // Seeded, so two colourless lists differ and one list repeats.
        #expect(Palette.fallback(seed: 1).primary != Palette.fallback(seed: 2).primary)
        #expect(Palette.fallback(seed: 1).primary == Palette.fallback(seed: 1).primary)
    }

    /// A palette averaged over ten posters is a palette averaged into grey.
    @Test("Only the top three items colour the badge")
    func usesTopThreeOnly() {
        var items = Fixture.crimeNineties
        let fromTen = Palette.derive(from: items)
        items[9] = Fixture.movie(10, "Repainted", 1995, hex: "#00AAFF")
        #expect(Palette.derive(from: items) == fromTen, "a change at rank 10 must not repaint the badge")
        items[0] = Fixture.movie(1, "Repainted", 1994, hex: "#00AAFF")
        #expect(Palette.derive(from: items) != fromTen, "a change at rank 1 must")
    }
}

@Suite("The deterministic pre-pass is the fallback, so it has to be complete")
struct BadgePrePassTests {
    private var candidates: BadgeCandidates {
        BadgePrePass.run(items: Fixture.crimeNineties, topic: Fixture.crimeNinetiesTopic)
    }

    /// The floor test (specs/badges.md): force the bottom rung and the result
    /// must still be a badge you would screenshot. Rendered here as
    /// composition data, which is the only form the Kit can judge.
    @Test("The bottom rung of the ladder is a complete badge")
    func floorTest() {
        let badge = candidates.deterministicComposition()
        #expect(badge.provenance == .deterministic)
        #expect(BadgeShape.allCases.contains(badge.shape))
        #expect(BadgeMaterial.allCases.contains(badge.material))
        #expect(BadgePrePass.motifs.contains { $0.id == badge.motifID })
        #expect(!badge.inscription.isEmpty)
        #expect(badge.palette.primary != badge.palette.secondary)
        #expect(badge.seed != 0)
    }

    /// The model chooses among these, an id-constrained choice, so it cannot
    /// name an asset that does not exist. Empty candidate sets would turn that
    /// guarantee into a crash.
    @Test("Every candidate set is non-empty and drawn from the real kit")
    func candidateSetsAreReal() {
        let c = candidates
        #expect(c.shapes.count == BadgeShape.allCases.count)
        #expect(c.materials.count == BadgeMaterial.allCases.count)
        #expect(c.motifs.count == BadgePrePass.motifs.count)
        #expect(!c.inscriptions.isEmpty)
        #expect(Set(c.shapes).count == c.shapes.count, "no shape offered twice")
        #expect(Set(c.motifs.map(\.id)).count == c.motifs.count)
    }

    /// The same Ten must produce the same badge on every device and every
    /// re-render — that is what lets a badge be re-derived rather than stored.
    @Test("The same list gets the same badge, and a different list does not")
    func deterministic() {
        let a = BadgePrePass.run(items: Fixture.crimeNineties, topic: Fixture.crimeNinetiesTopic)
        let b = BadgePrePass.run(items: Fixture.crimeNineties, topic: Fixture.crimeNinetiesTopic)
        #expect(a.deterministicComposition() == b.deterministicComposition())

        let reordered = Array(Fixture.crimeNineties.reversed())
        let c = BadgePrePass.run(items: reordered, topic: Fixture.crimeNinetiesTopic)
        #expect(c.seed != a.seed, "a different order is a different Ten")

        let otherTopic = TopicNaming.topic(for: Criteria(domain: .movie, genre: "Crime"))
        let d = BadgePrePass.run(items: Fixture.crimeNineties, topic: otherTopic)
        #expect(d.seed != a.seed, "the same ten on a different topic is a different badge")
    }

    /// A list whose metadata matches nothing still needs an emblem rather than
    /// an empty middle — which is what the untagged floor motif is for.
    @Test("A list matching no motif tag still gets a motif")
    func motifFloor() {
        let odd = (1...10).map {
            Fixture.movie($0, "Untagged \($0)", 1970 + $0, genres: ["Nonexistent Genre"])
        }
        let c = BadgePrePass.run(items: odd, topic: TopicNaming.topic(for: .allTime(.movie)))
        #expect(!c.motifs.isEmpty)
        #expect(!c.deterministicComposition().motifID.isEmpty)
    }

    /// A case that repeats its silhouette reads as a repeat, not a collection.
    @Test("A shape already in your case is weighted away from")
    func avoidsRecentShapes() {
        let plain = BadgePrePass.run(items: Fixture.crimeNineties, topic: Fixture.crimeNinetiesTopic)
        let first = plain.shapes[0]
        let avoiding = BadgePrePass.run(items: Fixture.crimeNineties,
                                        topic: Fixture.crimeNinetiesTopic,
                                        recentShapes: [first])
        #expect(avoiding.shapes[0] != first)
    }

    @Test("Domain affinity leans, and never partitions")
    func affinityLeansOnly() {
        let books = (1...10).map {
            Item(id: ItemID(TMDB.bookIDOffset + $0), domain: .book, title: "Book \($0)",
                 year: 1900 + $0, genres: ["Romance"], creator: "Author \($0)", score: 8, voteCount: 100)
        }
        let c = BadgePrePass.run(items: books, topic: TopicNaming.topic(for: .allTime(.book)))
        // Every shape stays legal on every domain (specs/badges.md) — a kit
        // that hard-partitions produces a books case that looks like a
        // different app.
        #expect(Set(c.shapes) == Set(BadgeShape.allCases))
    }

    @Test("Facts are counted deterministically, ties and all")
    func factsAreStable() {
        let facts = ListFacts(items: Fixture.crimeNineties)
        #expect(facts.topGenre?.0 == "Crime")
        #expect(facts.topGenre?.1 == 10)
        #expect(facts.topCreator?.0 == "Quentin Tarantino")
        #expect(facts.topCreator?.1 == 3)
        #expect(facts.topDecade?.0 == 1990)
        #expect(facts.topDecade?.1 == 10)
        // Repeated construction gives the same answer: no dictionary order.
        for _ in 0..<20 {
            #expect(ListFacts(items: Fixture.crimeNineties).topCreator?.0 == "Quentin Tarantino")
        }
    }
}

@Suite("The inscription post-check rejects, and polices templates too")
struct InscriptionTests {
    private let tokens: Set<String> = ["pulp", "fiction", "crime", "tarantino", "90s", "goodfellas"]

    @Test("Six words is the limit, and seven is discarded not trimmed")
    func wordLimit() {
        #expect(Inscription.check("Crime, and nothing else at all",
                                  rankOneTitle: nil, referenceTokens: tokens) == nil)
        #expect(Inscription.check("Crime and nothing else at all here",
                                  rankOneTitle: nil, referenceTokens: tokens) == .tooLong)
        #expect(Inscription.maximumWords == 6)
    }

    /// The exact defect the M1.5 prototype shipped: a template that was six
    /// words with a short title and eight with a long one, and nothing in the
    /// pipeline caught it because templates were assumed safe.
    @Test("A template that quotes rank one is rejected like any other line")
    func policesTemplatesToo() {
        let title = "The Shawshank Redemption"
        let fromTemplate = "Ten kept, \(title) last"
        #expect(Inscription.check(fromTemplate, rankOneTitle: title, referenceTokens: [])
                == .quotesRankOne)
        // And on length alone, with a longer title, even without the rank-one
        // clause to catch it.
        #expect(Inscription.check("Ten kept, Once Upon a Time in America last",
                                  rankOneTitle: nil, referenceTokens: []) == .tooLong)
    }

    @Test("Quotation marks and emoji are out", arguments: [
        "She said \"run\"", "Ten heists 🎬", "Crime, \u{201C}solved\u{201D}",
    ])
    func rejectsPunctuationAndEmoji(line: String) {
        let rejection = Inscription.check(line, rankOneTitle: nil, referenceTokens: [])
        #expect(rejection == .containsQuotationMarks || rejection == .containsEmoji)
    }

    /// A generic compliment is the quality floor the spec rejects. The test
    /// for it is mechanical: a line sharing no word with the list was not
    /// derived from the list, whatever it claims.
    @Test("A line derived from nothing is rejected")
    func requiresDerivation() {
        #expect(Inscription.check("Great taste, truly", rankOneTitle: nil, referenceTokens: tokens)
                == .notDerivedFromList)
        #expect(Inscription.check("Tarantino, three times", rankOneTitle: nil, referenceTokens: tokens) == nil)
        // With nothing to check against, the clause is skipped rather than
        // failing everything.
        #expect(Inscription.check("Great taste, truly", rankOneTitle: nil, referenceTokens: []) == nil)
    }

    @Test("Empty is empty")
    func rejectsEmpty() {
        #expect(Inscription.check("   ", rankOneTitle: nil, referenceTokens: []) == .empty)
    }

    /// Every template goes through the same gate as model output, and only
    /// survivors are offered.
    @Test("Every offered inscription has passed the check")
    func onlySurvivorsAreOffered() {
        let facts = ListFacts(items: Fixture.crimeNineties)
        let candidates = BadgePrePass.run(items: Fixture.crimeNineties, topic: Fixture.crimeNinetiesTopic)
        for line in candidates.inscriptions {
            #expect(Inscription.passes(line, rankOneTitle: Fixture.crimeNineties[0].title,
                                       referenceTokens: facts.referenceTokens),
                    "offered a line that fails its own check: \"\(line)\"")
        }
        #expect(candidates.inscriptions.count >= 1)
    }

    /// The very bottom rung: built from a reference token by construction, so
    /// it satisfies the derived-from-the-list clause rather than hoping to.
    @Test("The guaranteed line passes by construction, on any list")
    func guaranteedLineAlwaysPasses() {
        let lists: [[Item]] = [
            Fixture.crimeNineties,
            (1...10).map { Fixture.movie($0, "Untitled \($0)", 1980 + $0, genres: ["Horror"]) },
            (1...10).map { Fixture.movie($0, "Zed", 2000, genres: []) },
        ]
        for items in lists {
            let facts = ListFacts(items: items)
            let topic = TopicNaming.topic(for: .allTime(.movie))
            let line = Inscription.guaranteed(facts: facts, topic: topic)
            #expect(Inscription.passes(line, rankOneTitle: items[0].title,
                                       referenceTokens: facts.referenceTokens),
                    "the guaranteed line failed on \(items[0].title): \"\(line)\"")
        }
    }

    @Test("Reference tokens skip words too common to prove anything")
    func stopWordsExcluded() {
        let facts = ListFacts(items: Fixture.crimeNineties)
        #expect(facts.referenceTokens.contains("goodfellas"))
        #expect(facts.referenceTokens.contains("tarantino"))
        #expect(facts.referenceTokens.contains("90s"))
        // "The Usual Suspects" lends "usual" and "suspects", never "the".
        #expect(!facts.referenceTokens.contains("the"))
    }
}
