import Testing

@testable import TopTenKit

@Suite("Editing a published Ten: offer a new badge, never force one")
struct BadgeEligibilityTests {
    private let original = (1...Ten.size).map(ItemID.init)

    @Test("An untouched Ten keeps its badge")
    func unchangedKeeps() {
        #expect(BadgeEligibility.outcome(published: original, edited: original) == .keep)
    }

    /// A #4 becoming a #5 is not a new opinion.
    @Test("A tidy-up keeps the badge")
    func smallMovesKeep() {
        var edited = original
        edited.swapAt(3, 4)                       // one item moves one slot
        #expect(BadgeEligibility.outcome(published: original, edited: edited) == .keep)

        // Two items moving a long way is still under the bar of three.
        var two = original
        two.removeAll { $0 == ItemID(9) || $0 == ItemID(10) }
        two.insert(ItemID(10), at: 0)
        two.insert(ItemID(9), at: 1)
        #expect(BadgeEligibility.outcome(published: original, edited: two) == .keep)
    }

    /// The badge was composed from items that are no longer in the list, so it
    /// now describes something that does not exist.
    @Test("Swapping a pick offers a new badge")
    func membershipOffers() {
        var edited = original
        edited[9] = ItemID(99)
        #expect(BadgeEligibility.outcome(published: original, edited: edited)
                == .offerRegeneration(.membershipChanged))
    }

    /// Membership is decided on sets, not order: a badge is stale because the
    /// items left, wherever the survivors ended up.
    @Test("Membership is judged before order")
    func membershipBeatsOrder() {
        var edited = Array(original.reversed())
        edited[0] = ItemID(99)
        #expect(BadgeEligibility.outcome(published: original, edited: edited)
                == .offerRegeneration(.membershipChanged))
    }

    @Test("The same ten, substantially re-thought, offers a new badge")
    func bigReorderOffers() {
        let edited = Array(original.reversed())
        #expect(BadgeEligibility.outcome(published: original, edited: edited)
                == .offerRegeneration(.orderChanged))
    }

    /// The bar is exactly three items moving exactly three slots. Stated as a
    /// test because "significant change" is the kind of phrase two people read
    /// two different ways.
    @Test("The bar is three items moving three slots")
    func theBarIsExact() {
        // Three items moved by three: a rotation of the first six.
        let three: [ItemID] = [4, 5, 6, 1, 2, 3, 7, 8, 9, 10].map(ItemID.init)
        let movedByThree = three.enumerated().filter { index, item in
            abs(original.firstIndex(of: item)! - index) >= 3
        }.count
        #expect(movedByThree == 6)
        #expect(BadgeEligibility.outcome(published: original, edited: three)
                == .offerRegeneration(.orderChanged))

        // Two items moved by three: under the count, so it keeps.
        let two: [ItemID] = [4, 2, 3, 1, 5, 6, 7, 8, 9, 10].map(ItemID.init)
        #expect(BadgeEligibility.outcome(published: original, edited: two) == .keep)

        // Three items moved by two: over the count, under the distance.
        let shallow: [ItemID] = [3, 4, 1, 2, 5, 6, 7, 8, 9, 10].map(ItemID.init)
        let movedByTwo = shallow.enumerated().filter { index, item in
            abs(original.firstIndex(of: item)! - index) >= 2
        }.count
        #expect(movedByTwo >= 3)
        #expect(BadgeEligibility.outcome(published: original, edited: shallow) == .keep)
    }

    /// An imperative here would read as the app having already decided.
    @Test("The offer is a question, in the user-facing voice")
    func offerCopy() {
        #expect(BadgeEligibility.offerPrompt.hasSuffix("?"))
        #expect(BadgeEligibility.offerPrompt.contains("Top 10"),
                "product copy says Top 10 in digits (AGENTS.md, 2026-08-15)")
    }
}
