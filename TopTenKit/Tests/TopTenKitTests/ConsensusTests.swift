import Foundation
import Testing

@testable import TopTenKit

@Suite("Consensus: what everybody, together, thinks")
struct ConsensusTests {
    private func ten(_ ids: [Int], author: String) -> RankedTen {
        RankedTen(topicID: "movie:genre:Crime", order: ids.map(ItemID.init), authorID: author)!
    }

    /// A Ten is ten or it is a draft. The type refuses to hold a partial one,
    /// so no reader downstream has to check.
    @Test("A partial or repeating list is not a Ten")
    func refusesNonTens() {
        #expect(RankedTen(topicID: "t", order: (1...9).map(ItemID.init), authorID: "a") == nil)
        #expect(RankedTen(topicID: "t", order: (1...11).map(ItemID.init), authorID: "a") == nil)
        // Ten entries, nine distinct.
        let repeating = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(ItemID.init)
        #expect(RankedTen(topicID: "t", order: repeating, authorID: "a") == nil)
        #expect(RankedTen(topicID: "t", order: (1...10).map(ItemID.init), authorID: "a") != nil)
    }

    /// The property the whole scheme rests on: no Ten can buy influence by
    /// being unusual, because every Ten contributes exactly the same total.
    @Test("Every Ten contributes exactly 55 points, whatever its picks")
    func everyTenIsWorthTheSame() {
        var a = ConsensusTally(); a.add(ten(Array(1...10), author: "a"))
        var b = ConsensusTally(); b.add(ten(Array(90...99), author: "b"))
        #expect(a.standings().reduce(0) { $0 + $1.points } == 55)
        #expect(b.standings().reduce(0) { $0 + $1.points } == 55)
    }

    @Test("A #1 outscores a #10 ten to one")
    func bordaWeights() {
        var tally = ConsensusTally()
        tally.add(ten(Array(1...10), author: "a"))
        let standings = tally.standings()
        #expect(standings.first?.item == ItemID(1))
        #expect(standings.first?.points == 10)
        #expect(standings.last?.item == ItemID(10))
        #expect(standings.last?.points == 1)
    }

    @Test("Agreement accumulates across people")
    func accumulates() {
        var tally = ConsensusTally()
        tally.add(contentsOf: [
            ten(Array(1...10), author: "a"),
            ten([1] + Array(11...19), author: "b"),
            ten([2, 1] + Array(20...27), author: "c"),
        ])
        #expect(tally.tensCounted == 3)
        let top = tally.standings().first!
        #expect(top.item == ItemID(1))          // 10 + 10 + 9
        #expect(top.points == 29)
        #expect(top.appearances == 3)
    }

    /// Not for fairness but for determinism: the consensus list is rendered on
    /// a web page, cached and screenshotted, and two servers disagreeing about
    /// the order for identical data is a bug that only shows in production.
    @Test("Ties break the same way every time")
    func tiesAreDeterministic() {
        var forward = ConsensusTally()
        forward.add(contentsOf: [ten(Array(1...10), author: "a"), ten(Array(1...10).reversed(), author: "b")])
        var backward = ConsensusTally()
        backward.add(contentsOf: [ten(Array(1...10).reversed(), author: "b"), ten(Array(1...10), author: "a")])
        // Every item now has 11 points and 2 appearances: a total tie.
        #expect(forward.standings().allSatisfy { $0.points == 11 })
        #expect(forward.standings().map(\.item) == backward.standings().map(\.item))
        #expect(forward.standings().map(\.item) == (1...10).map(ItemID.init))
    }

    /// A consensus of six is not a Ten and must not be dressed as one.
    @Test("A consensus is only a Ten when ten things have been seen")
    func refusesShortConsensus() {
        var tally = ConsensusTally()
        #expect(tally.consensusTen(topicID: "t") == nil)
        tally.add(ten(Array(1...10), author: "a"))
        let consensus = tally.consensusTen(topicID: "t")
        #expect(consensus != nil)
        #expect(consensus?.order == (1...10).map(ItemID.init))
    }

    @Test("Shared picks are counted regardless of order")
    func sharedIgnoresOrder() {
        var tally = ConsensusTally()
        tally.add(ten(Array(1...10), author: "a"))
        let mine = ten([10, 9, 8, 7, 100, 101, 102, 103, 104, 105], author: "me")
        #expect(tally.shared(with: mine) == 4)
    }

    @Test("A rank is found by position, one-based")
    func positions() {
        let t = ten(Array(1...10), author: "a")
        #expect(t.position(of: ItemID(1)) == 1)
        #expect(t.position(of: ItemID(10)) == 10)
        #expect(t.position(of: ItemID(99)) == nil)
    }
}
