/// The invariants a Ten is built on, stated once so every later rule —
/// placement, consensus, badge eligibility — can lean on them instead of
/// re-deriving the number ten.
public enum Ten {
    /// A Ten is exactly ten items. Locked decision (AGENTS.md, 2026-08-14):
    /// no five-item mode, no partial publishing — an unfinished Ten is a draft.
    public static let size = 10

    /// The legal rank positions in a Ten, 1...10. Position 1 is sacred
    /// (specs/design.md, "Numerals are typography's job").
    public static let positions: ClosedRange<Int> = 1...size

    /// Whether `position` is a legal rank in a Ten.
    public static func isValidPosition(_ position: Int) -> Bool {
        positions.contains(position)
    }

    /// Borda points a pick earns from its position in one person's Ten:
    /// #1 scores 10, #10 scores 1. Summed across every published Ten on a
    /// topic, these produce the Consensus Ten (specs/prd.md, object model).
    ///
    /// - Returns: the points, or `nil` if `position` is not a rank in a Ten.
    public static func consensusPoints(forPosition position: Int) -> Int? {
        guard isValidPosition(position) else { return nil }
        return size - position + 1
    }
}
