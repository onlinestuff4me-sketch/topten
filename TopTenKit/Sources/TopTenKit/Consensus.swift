import Foundation

/// One person's finished Ten on one topic — the unit consensus is computed
/// from, and the unit a badge is minted for.
public struct RankedTen: Hashable, Sendable, Codable, Identifiable {
    public let id: UUID
    public let topicID: String
    /// The picks, best first. Exactly ``Ten/size`` of them, or this is a draft
    /// and `nil` is returned instead.
    public let order: [ItemID]
    /// Who made it. Opaque here: the Kit has no idea what an account is.
    public let authorID: String

    /// - Returns: `nil` unless `order` is exactly ten distinct items. A Ten is
    ///   ten or it is a draft (AGENTS.md, locked): the type refuses to
    ///   represent a partial one rather than leaving every reader to check.
    public init?(id: UUID = UUID(), topicID: String, order: [ItemID], authorID: String) {
        guard order.count == Ten.size, Set(order).count == Ten.size else { return nil }
        self.id = id
        self.topicID = topicID
        self.order = order
        self.authorID = authorID
    }

    /// The rank of an item in this Ten, 1...10, or `nil` if it is not in it.
    public func position(of item: ItemID) -> Int? {
        order.firstIndex(of: item).map { $0 + 1 }
    }
}

/// A line of the Consensus Ten.
public struct ConsensusEntry: Hashable, Sendable, Codable {
    public let item: ItemID
    /// Borda points summed across every Ten counted.
    public let points: Int
    /// How many Tens included it at all.
    public let appearances: Int

    public init(item: ItemID, points: Int, appearances: Int) {
        self.item = item
        self.points = points
        self.appearances = appearances
    }
}

/// The Consensus Ten for a topic: what everybody, together, thinks.
///
/// Borda count, per the PRD object model — an item scores `11 - rank` from
/// each Ten it appears in, so a #1 is worth ten times a #10 and one complete
/// Ten always contributes exactly 55 points whatever its picks are. That fixed
/// contribution is the property the whole scheme rests on: no Ten can buy
/// influence by being unusual.
///
/// Deliberately a tally you feed rather than a function over an array, because
/// the real caller is a paginated query over other people's Tens and holding
/// them all in memory to sum them is a choice nobody needs to make.
public struct ConsensusTally: Sendable {
    private var points: [ItemID: Int] = [:]
    private var appearances: [ItemID: Int] = [:]
    public private(set) var tensCounted = 0

    public init() {}

    /// Add one person's Ten to the tally.
    public mutating func add(_ ten: RankedTen) {
        tensCounted += 1
        for (index, item) in ten.order.enumerated() {
            guard let earned = Ten.consensusPoints(forPosition: index + 1) else { continue }
            points[item, default: 0] += earned
            appearances[item, default: 0] += 1
        }
    }

    public mutating func add(contentsOf tens: some Sequence<RankedTen>) {
        for ten in tens { add(ten) }
    }

    /// The standings, best first.
    ///
    /// Ties break on appearances and then on id — not for fairness but for
    /// **determinism**: the consensus list is rendered on a web page, cached,
    /// and screenshotted, and two servers returning different orders for the
    /// same data is a bug that only shows up in production.
    public func standings() -> [ConsensusEntry] {
        points.map { ConsensusEntry(item: $0.key, points: $0.value,
                                    appearances: appearances[$0.key] ?? 0) }
            .sorted {
                if $0.points != $1.points { return $0.points > $1.points }
                if $0.appearances != $1.appearances { return $0.appearances > $1.appearances }
                return $0.item < $1.item
            }
    }

    /// The top `count` of the standings.
    public func top(_ count: Int = Ten.size) -> [ConsensusEntry] {
        Array(standings().prefix(count))
    }

    /// The consensus as a Ten, or `nil` if fewer than ten distinct items have
    /// been seen. A consensus of six is not a Ten and must not be dressed as
    /// one.
    public func consensusTen(topicID: String) -> RankedTen? {
        let top = top()
        guard top.count == Ten.size else { return nil }
        return RankedTen(topicID: topicID, order: top.map(\.item), authorID: "consensus")
    }

    /// How much one person's Ten agrees with the consensus: the count of
    /// shared picks, ignoring order. The number behind "You share 4 of 10"
    /// (specs/prd.md Req 12, the comparison overlay).
    public func shared(with ten: RankedTen) -> Int {
        let consensus = Set(top().map(\.item))
        return ten.order.filter(consensus.contains).count
    }
}

/// An edge in the remix graph: this Ten was made after seeing that one.
///
/// Kept as its own type rather than a field on `RankedTen` because it is a
/// relationship, and because the reveal gate reads it in the opposite
/// direction from the way it is written (specs/prd.md Req 12).
public struct RemixEdge: Hashable, Sendable, Codable {
    public let from: UUID
    public let to: UUID
    public let topicID: String

    public init(from: UUID, to: UUID, topicID: String) {
        self.from = from
        self.to = to
        self.topicID = topicID
    }
}
