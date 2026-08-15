import Testing

@testable import TopTenKit

@Suite("Handles are generated, and the database will accept every one")
struct HandleTests {
    /// The one that matters: a client that can mint a handle the database
    /// refuses is a client that fails at publish time, on the single action
    /// the whole product is for.
    @Test("Every generated handle satisfies the SQL constraint")
    func alwaysValid() {
        for seed in 0..<5000 {
            let h = Handle.generate(seed: UInt64(seed))
            #expect(Handle.isValid(h), "database would refuse \"\(h)\"")
            // The constraint in supabase/migrations is ^[a-z0-9_]{3,24}$.
            #expect(h.count >= 3 && h.count <= 24, "\"\(h)\" is \(h.count) characters")
            #expect(h.allSatisfy { $0.isLowercase || $0.isNumber || $0 == "_" }, h)
        }
    }

    /// A handle that differs between the device that minted it and the server
    /// that stored it is a bug that only appears in production.
    @Test("The same seed always gives the same handle")
    func reproducible() {
        #expect(Handle.generate(seed: 12345) == Handle.generate(seed: 12345))
        #expect(Handle.generate(seed: "user-abc") == Handle.generate(seed: "user-abc"))
        #expect(Handle.generate(seed: 1) != Handle.generate(seed: 2))
    }

    /// `quiet_lantern_2` beside `quiet_lantern` reads as a copy of somebody.
    /// A retry is a different handle, not a counter glued on.
    @Test("A retry produces a different handle, not a numbered variant")
    func retriesDiffer() {
        let first = Handle.generate(seed: 99, attempt: 0)
        let second = Handle.generate(seed: 99, attempt: 1)
        let third = Handle.generate(seed: 99, attempt: 2)
        #expect(first != second && second != third && first != third)
        // And not merely the same stem with a new number.
        let stem = { (h: String) in h.split(separator: "_").dropLast().joined(separator: "_") }
        #expect(stem(first) != stem(second) || stem(second) != stem(third),
                "retries only changed the digits: \(first), \(second), \(third)")
    }

    /// Collisions are what the retry exists for, so the space has to be big
    /// enough that retrying is rare rather than routine.
    @Test("The space is wide enough that collisions are the exception")
    func collisionRate() {
        var seen = Set<String>()
        for seed in 0..<2000 { seen.insert(Handle.generate(seed: UInt64(seed))) }
        // 48 x 48 x 100 = 230,400 handles. Two thousand draws should collide
        // only a handful of times.
        #expect(seen.count >= 1980, "only \(seen.count) distinct handles in 2000 draws")
    }

    /// Safe by construction rather than by filter: there is no list to keep up
    /// to date because the words are curated and dull on purpose.
    @Test("The wordlists are clean, lowercase and free of separators")
    func wordlistsAreWellFormed() {
        for word in Handle.adjectives + Handle.nouns {
            #expect(word.allSatisfy { $0.isLowercase && $0.isLetter },
                    "\"\(word)\" is not plain lowercase letters")
            #expect(word.count >= 3, "\"\(word)\" is too short to read")
        }
        #expect(Set(Handle.adjectives).count == Handle.adjectives.count, "duplicate adjective")
        #expect(Set(Handle.nouns).count == Handle.nouns.count, "duplicate noun")
    }

    @Test("Invalid handles are recognised as such", arguments: [
        "", "ab", "Ada", "has space", "has-dash", "emoji🎬",
        "thisiswaytoolongforahandlebyalongway",
    ])
    func rejectsBadHandles(handle: String) {
        #expect(Handle.isValid(handle) == false, "accepted \"\(handle)\"")
    }

    @Test("And valid ones are accepted", arguments: [
        "ada", "quiet_lantern_04", "a_1", "abc123",
    ])
    func acceptsGoodHandles(handle: String) {
        #expect(Handle.isValid(handle), "refused \"\(handle)\"")
    }
}
