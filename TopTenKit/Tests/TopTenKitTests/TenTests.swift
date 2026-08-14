import Testing

import TopTenKit

@Suite("Ten invariants")
struct TenTests {
    @Test("A Ten is exactly ten positions, 1 through 10")
    func shape() {
        #expect(Ten.size == 10)
        #expect(Ten.positions == 1...10)
        #expect(Ten.positions.count == Ten.size)
    }

    @Test("Positions outside 1...10 are not ranks", arguments: [0, -1, 11, 100])
    func rejectsPositionsOutsideTheTen(position: Int) {
        #expect(Ten.isValidPosition(position) == false)
        #expect(Ten.consensusPoints(forPosition: position) == nil)
    }

    @Test("Every position 1...10 is a rank")
    func acceptsEveryPositionInTheTen() {
        for position in Ten.positions {
            #expect(Ten.isValidPosition(position))
        }
    }

    @Test("Borda points run 10 at rank 1 down to 1 at rank 10")
    func consensusPointsDescendFromTen() {
        #expect(Ten.consensusPoints(forPosition: 1) == 10)
        #expect(Ten.consensusPoints(forPosition: 10) == 1)

        let points = Ten.positions.compactMap(Ten.consensusPoints(forPosition:))
        #expect(points == [10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
        // One complete Ten contributes a fixed 55 points to a topic, whatever
        // its picks are — the property consensus scoring depends on.
        #expect(points.reduce(0, +) == 55)
    }
}
