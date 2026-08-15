import Foundation

/// The name a published Ten carries as its byline.
///
/// **Generated, changeable later** (decided 2026-08-15, Mischa). Everyone gets
/// a readable handle at publish time and nobody is asked to invent one. The
/// reasoning is about *where* the cost falls: a chosen handle means a form and
/// a uniqueness check in front of the single action that matters most, at the
/// exact moment somebody has just finished a Ten and wants to send it. A
/// generated one costs nothing then, and renaming is a settings screen
/// somebody can want later.
///
/// **Who mints which handle.** Once an account exists, the *database* mints it
/// — `supabase/migrations/0004_profile_on_signup.sql` creates the profile row
/// inside the same transaction as the signup, because magic-link sign-in
/// creates an `auth.users` row and nothing else, and the first publish after
/// that would otherwise fail on a foreign key. The wordlists there are these
/// wordlists.
///
/// This generator is for the half of the product that has no account: PRD Req
/// 10 makes anonymous local use first-class, and a local Ten still needs a
/// byline. It is deliberately *not* sent to the server at signup — a
/// client-supplied handle in `raw_user_meta_data` would turn "generated" into
/// "chosen by anyone calling the API directly", and the RLS suite has a check
/// that says so.
///
/// Two properties the generator has to have, and both are tested:
///
/// - **Safe by construction.** The words are a curated list, so there is no
///   filter to keep up to date and no chance of an unfortunate pairing —
///   handles are drawn from words that are dull on purpose.
/// - **Reproducible.** Same seed, same handle, on every platform. A handle
///   that differs between the device that minted it and the server that
///   stored it is a bug that only appears in production.
public enum Handle {
    /// Matches the `handle_shape` constraint in `supabase/migrations`. The two
    /// definitions are deliberately identical and the test says so — a client
    /// that can mint a handle the database will refuse is a client that fails
    /// at publish time.
    public static let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789_")
    public static let minimumLength = 3
    public static let maximumLength = 24

    /// Adjectives and nouns chosen to be plain. Nothing here is a body part,
    /// a nationality, a slur in any spelling we could find, or a word that
    /// becomes one beside any word in the other list. Deliberately boring: a
    /// handle is an address, not a joke.
    static let adjectives = [
        "amber", "brisk", "calm", "civic", "clear", "coastal", "copper", "crisp",
        "distant", "early", "even", "gentle", "golden", "grand", "humble", "inland",
        "keen", "level", "lucid", "mellow", "modest", "narrow", "northern", "open",
        "patient", "plain", "polite", "quiet", "rapid", "rested", "rural", "settled",
        "silver", "smooth", "solid", "southern", "steady", "still", "sunlit", "swift",
        "tidal", "upland", "urban", "velvet", "wandering", "warm", "western", "willing",
    ]

    static let nouns = [
        "anchor", "arbour", "atlas", "beacon", "bridge", "canyon", "cedar", "compass",
        "cottage", "current", "delta", "ember", "fathom", "ferry", "garden", "harbour",
        "hollow", "island", "jetty", "junction", "kestrel", "lantern", "ledger", "marsh",
        "meadow", "orchard", "parlour", "pennant", "quarry", "quill", "ridge", "river",
        "sable", "signal", "station", "summit", "thicket", "tide", "trellis", "valley",
        "vessel", "willow", "window", "harvest", "lattice", "prairie", "sextant", "cove",
    ]

    /// A handle for a new account.
    ///
    /// - Parameters:
    ///   - seed: any stable value — a user id works. The same seed always
    ///     produces the same handle.
    ///   - attempt: bump this and try again when the database rejects the
    ///     handle as taken. Each attempt is a different handle rather than a
    ///     counter glued onto the last one, because `quiet_lantern_2` next to
    ///     `quiet_lantern` reads as a copy of somebody.
    public static func generate(seed: UInt64, attempt: Int = 0) -> String {
        var rng = SplitMix64(seed: seed &+ UInt64(bitPattern: Int64(attempt)) &* 0x9E37_79B9)
        let adjective = adjectives[Int(rng.next() % UInt64(adjectives.count))]
        let noun = nouns[Int(rng.next() % UInt64(nouns.count))]
        // Two digits, always: a fixed width keeps handles the same shape, and
        // the number is what makes collisions rare rather than what resolves
        // them — the database still has the last word.
        let number = rng.next() % 100
        return String(format: "%@_%@_%02d", adjective, noun, number)
    }

    /// Convenience for a string seed, such as an account id.
    public static func generate(seed: String, attempt: Int = 0) -> String {
        generate(seed: StableHash.of(seed), attempt: attempt)
    }

    /// Whether a handle is one the database will accept. Mirrors the SQL
    /// constraint exactly.
    public static func isValid(_ handle: String) -> Bool {
        guard handle.count >= minimumLength, handle.count <= maximumLength else { return false }
        return handle.unicodeScalars.allSatisfy(allowed.contains)
    }
}
