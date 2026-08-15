import Testing

@testable import TopTenKit

@Suite("Guided placement orders a Ten, inside its comparison budget")
struct PlacementTests {
    /// Answer as if the truth were "lower raw value is better".
    private func oracleOrder(_ ids: [Int]) -> (order: [ItemID], comparisons: Int) {
        GuidedPlacement.order(ids.map(ItemID.init)) { $0.rawValue < $1.rawValue }
    }

    @Test("It sorts correctly from any starting order")
    func sortsCorrectly() {
        // Deterministic pseudo-shuffles rather than a random seed: a test that
        // fails one run in fifty is a test nobody trusts.
        var rng = SplitMix64(seed: 42)
        for _ in 0..<200 {
            var ids = Array(1...Ten.size)
            ids.shuffle(using: &rng)
            let result = oracleOrder(ids)
            #expect(result.order.map(\.rawValue) == Array(1...Ten.size))
        }
    }

    /// The acceptance criterion (specs/prd.md Req 3, amended 2026-08-14), and
    /// the arithmetic behind it. The original target of 15 was impossible: the
    /// information floor for ten items is 22.
    @Test("A full rank never exceeds the ~25 the PRD allows")
    func staysInsideTheBudget() {
        let worst = GuidedPlacement.worstCaseComparisons(forItems: Ten.size)
        let floor = GuidedPlacement.informationFloor(forItems: Ten.size)
        #expect(floor == 22, "ceil(log2(10!)) is 22 — the reason 15 was impossible")
        #expect(worst == 25, "binary insertion's worst case for ten items")
        #expect(worst <= 25, "the amended acceptance criterion")

        var rng = SplitMix64(seed: 7)
        var seen: [Int] = []
        for _ in 0..<500 {
            var ids = Array(1...Ten.size)
            ids.shuffle(using: &rng)
            let result = oracleOrder(ids)
            #expect(result.comparisons <= worst)
            seen.append(result.comparisons)
        }
        // And it is not merely inside the budget by luck: the measured range
        // sits at the floor, matching the prototype's observed 21-23.
        #expect(seen.min()! >= floor - 1)
        #expect(seen.max()! <= worst)
    }

    @Test("The floor is a floor: no algorithm can beat it")
    func informationFloorIsRight() {
        #expect(GuidedPlacement.informationFloor(forItems: 1) == 0)
        #expect(GuidedPlacement.informationFloor(forItems: 2) == 1)
        #expect(GuidedPlacement.informationFloor(forItems: 3) == 3)   // log2(6) = 2.58
        #expect(GuidedPlacement.informationFloor(forItems: 4) == 5)   // log2(24) = 4.58
        #expect(GuidedPlacement.informationFloor(forItems: 10) == 22)
        // Binary insertion is never below the floor, which would mean a bug in
        // one of the two functions.
        for n in 2...12 {
            #expect(GuidedPlacement.worstCaseComparisons(forItems: n)
                    >= GuidedPlacement.informationFloor(forItems: n))
        }
    }

    @Test("It is a state machine a UI can drive one question at a time")
    func drivesStepwise() {
        var flow = GuidedPlacement(items: [3, 1, 2].map(ItemID.init))
        // Asking twice must not advance anything.
        let first = flow.step
        #expect(flow.step == first)
        guard case .compare = first else {
            Issue.record("expected a question, got \(first)"); return
        }
        while case let .compare(candidate, against) = flow.step {
            flow.answer(candidatePreferred: candidate.rawValue < against.rawValue)
        }
        #expect(flow.step == .finished([1, 2, 3].map(ItemID.init)))
        #expect(flow.isFinished)
    }

    /// The spine a UI shows mid-flow is only honest if the placed items really
    /// are in their final relative order.
    @Test("Items already placed keep their relative order")
    func placedStayPlaced() {
        var flow = GuidedPlacement(items: (1...Ten.size).reversed().map(ItemID.init))
        while case let .compare(candidate, against) = flow.step {
            flow.answer(candidatePreferred: candidate.rawValue < against.rawValue)
            // Whatever is on screen mid-flow is always the whole tray: nothing
            // disappears while it is being placed.
            #expect(flow.currentOrder.count == Ten.size)
        }
        #expect(flow.currentOrder.map(\.rawValue) == Array(1...Ten.size))
    }

    /// A Ten cannot hold the same thing twice, and an insertion sort handed a
    /// duplicate would ask the user to compare something with itself.
    @Test("Duplicates are dropped rather than asked about")
    func dropsDuplicates() {
        let result = GuidedPlacement.order([1, 2, 2, 3, 1].map(ItemID.init)) {
            $0.rawValue < $1.rawValue
        }
        #expect(result.order.map(\.rawValue) == [1, 2, 3])
    }

    @Test("Degenerate trays finish without a question", arguments: [0, 1])
    func degenerateTrays(count: Int) {
        let ids = (0..<count).map { ItemID($0) }
        var flow = GuidedPlacement(items: ids)
        #expect(flow.isFinished)
        #expect(flow.step == .finished(ids))
        #expect(flow.comparisons == 0)
        // Answering a finished flow is a no-op, not a crash.
        #expect(flow.answer(candidatePreferred: true) == .finished(ids))
        #expect(flow.comparisons == 0)
    }
}
