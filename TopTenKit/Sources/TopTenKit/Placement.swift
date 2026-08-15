import Foundation

/// Guided placement: ordering ten things by asking about two at a time.
///
/// The mechanic the PRD asks for (Req 3) is that the user is never made to
/// cold-sort ten items. Each item is instead slotted against the ones already
/// placed, which is binary insertion — and binary insertion is not a
/// convenience here, it is the whole comparison budget.
///
/// **The arithmetic, because the PRD's first target was impossible.** Ordering
/// ten items means distinguishing 10! arrangements; a yes/no answer yields one
/// bit; so no algorithm can finish in fewer than ceil(log2(10!)) = 22
/// questions. The original acceptance criterion asked for 15. Binary insertion
/// costs at most sum(ceil(log2(k+1))) for k in 1..<10, which is exactly **25**,
/// and typically lands at 21-23 — at the floor, not wasteful. The criterion was
/// amended to <= ~25 (specs/prd.md, 2026-08-14).
///
/// That leaves the honest problem stated rather than hidden: 22 taps is a lot
/// of taps, and the fix is not a cleverer algorithm but changing what one
/// interaction carries. That is a device-feel question for M2. This type is
/// the accessible path either way (Req 13), and it is deliberately a state
/// machine rather than a callback-taking sort so a UI can drive it one
/// question per frame, persist it mid-flow, and replay it in a test.
public struct GuidedPlacement: Sendable {
    /// What the flow wants next.
    public enum Step: Sendable, Equatable {
        /// Ask the user to choose between two items. Answer with
        /// ``GuidedPlacement/answer(candidatePreferred:)``.
        case compare(candidate: ItemID, against: ItemID)
        /// Every item is placed. The payload is the finished order, best first.
        case finished([ItemID])
    }

    /// Items already in order, best first.
    private var placed: [ItemID]
    /// Items still to be slotted, in the order they will be offered.
    private var remaining: [ItemID]
    /// The window of `placed` the current item could still belong in.
    private var low = 0
    private var high = 0

    /// How many questions have been answered. The number the acceptance
    /// criterion is about.
    public private(set) var comparisons = 0

    /// - Parameter items: the tray, in any order. Duplicates are dropped,
    ///   because a Ten cannot hold the same thing twice and an insertion sort
    ///   given a duplicate would ask the user to compare something with itself.
    public init(items: [ItemID]) {
        var seen = Set<ItemID>()
        let unique = items.filter { seen.insert($0).inserted }
        placed = unique.isEmpty ? [] : [unique[0]]
        remaining = unique.isEmpty ? [] : Array(unique.dropFirst())
        resetWindow()
    }

    private mutating func resetWindow() {
        low = 0
        high = placed.count
    }

    /// The current state of the flow. Pure: calling it twice changes nothing.
    public var step: Step {
        guard let candidate = remaining.first else { return .finished(placed) }
        // The window has closed: the candidate's slot is known, but the caller
        // has to `answer` its way here, so a non-empty window always has a
        // midpoint to ask about.
        let mid = (low + high) / 2
        return .compare(candidate: candidate, against: placed[mid])
    }

    /// Whether the flow has any questions left.
    public var isFinished: Bool { remaining.isEmpty }

    /// The order so far. Meaningful mid-flow: the items already placed are
    /// already in their final relative order, which is what lets the UI show a
    /// spine that fills in rather than a progress bar.
    public var currentOrder: [ItemID] { placed + remaining }

    /// Record the user's answer to the current question.
    ///
    /// - Parameter candidatePreferred: `true` if the user picked the
    ///   *candidate* over the item it was shown against.
    /// - Returns: the next step.
    @discardableResult
    public mutating func answer(candidatePreferred: Bool) -> Step {
        guard !remaining.isEmpty else { return .finished(placed) }
        comparisons += 1
        let mid = (low + high) / 2
        if candidatePreferred {
            high = mid          // it belongs above what it beat
        } else {
            low = mid + 1       // it belongs below what beat it
        }
        if low >= high {
            placed.insert(remaining.removeFirst(), at: low)
            resetWindow()
        }
        return step
    }

    /// Drive the whole flow with a comparator, for tests and for the "rank
    /// them for me" path where a heuristic answers instead of a person.
    ///
    /// - Parameter prefersCandidate: given (candidate, incumbent), `true` if
    ///   the candidate should rank higher.
    public static func order(
        _ items: [ItemID],
        prefersCandidate: (ItemID, ItemID) -> Bool
    ) -> (order: [ItemID], comparisons: Int) {
        var flow = GuidedPlacement(items: items)
        while case let .compare(candidate, against) = flow.step {
            flow.answer(candidatePreferred: prefersCandidate(candidate, against))
        }
        guard case let .finished(order) = flow.step else { return ([], flow.comparisons) }
        return (order, flow.comparisons)
    }

    /// The most questions guided placement can ask to order `count` items.
    ///
    /// Stated as code rather than as a comment so the acceptance criterion is
    /// something a test can check against the algorithm instead of against a
    /// number somebody typed.
    public static func worstCaseComparisons(forItems count: Int) -> Int {
        guard count > 1 else { return 0 }
        return (1..<count).reduce(0) { total, placed in
            total + Int(ceil(log2(Double(placed + 1))))
        }
    }

    /// The fewest questions ANY algorithm could ask to order `count` items:
    /// ceil(log2(count!)). The information-theoretic floor that made the PRD's
    /// original target impossible.
    public static func informationFloor(forItems count: Int) -> Int {
        guard count > 1 else { return 0 }
        // Summed in log space; count! overflows Int64 at 21 and loses
        // precision in Double well before that.
        let bits = (2...count).reduce(0.0) { $0 + log2(Double($1)) }
        return Int(ceil(bits - 1e-9))
    }
}
