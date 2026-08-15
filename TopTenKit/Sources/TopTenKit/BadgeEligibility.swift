import Foundation

/// What happens to a badge when a published Ten is edited.
///
/// **Decided 2026-08-15 (Mischa): offer, never force.** A badge is an earned
/// object and the user may be attached to it, so a small edit must not
/// silently replace one — but a badge that no longer describes its list is a
/// lie the app is telling on the user's behalf. The line between those is the
/// rule below, and it is code because "significant change" is exactly the kind
/// of phrase two people read two different ways.
///
/// This supersedes the provisional note in specs/badges.md.
public enum BadgeEligibility {
    /// Items have to move this far to count as having moved at all. Below it,
    /// a change is an adjustment; a #4 becoming a #5 is not a new opinion.
    public static let significantMove = 3
    /// How many items must move significantly before the Ten counts as
    /// re-thought rather than tidied.
    public static let significantMoveCount = 3

    /// What the app should do about an existing badge.
    public enum Outcome: Sendable, Equatable {
        /// Nothing changed enough. The badge stands, silently.
        case keep
        /// Offer a new badge — "Your Ten changed. New badge?" — and take no
        /// for an answer. Never regenerate without asking.
        case offerRegeneration(Reason)

        public enum Reason: String, Sendable, Equatable {
            /// At least one pick was swapped out. The badge was composed from
            /// items that are no longer in the list, so it now describes
            /// something that does not exist.
            case membershipChanged
            /// The same ten, substantially re-thought.
            case orderChanged
        }
    }

    /// Compare a published Ten with its edited version.
    ///
    /// - Parameters:
    ///   - published: the order the badge was minted from.
    ///   - edited: the order now.
    public static func outcome(published: [ItemID], edited: [ItemID]) -> Outcome {
        // Membership first, and it is decided on sets rather than on order:
        // a badge composed from films that have left the list is stale no
        // matter where the survivors ended up.
        guard Set(published) == Set(edited) else {
            return .offerRegeneration(.membershipChanged)
        }
        var positions: [ItemID: Int] = [:]
        for (index, item) in published.enumerated() { positions[item] = index }
        var moved = 0
        for (index, item) in edited.enumerated() {
            guard let was = positions[item] else { continue }
            if abs(was - index) >= significantMove { moved += 1 }
        }
        return moved >= significantMoveCount
            ? .offerRegeneration(.orderChanged)
            : .keep
    }

    /// The copy the offer is made with. One line, and it is a question —
    /// an imperative here would read as the app having already decided.
    public static let offerPrompt = "Your Top 10 changed. New badge?"
}
