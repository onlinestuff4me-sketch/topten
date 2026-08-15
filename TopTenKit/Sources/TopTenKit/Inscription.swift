import Foundation

/// The badge's line, and the gate every candidate line has to pass.
///
/// **The post-check is code that rejects, not a rule the generator is asked to
/// follow** — and it polices the templates too, not only the model
/// (specs/badges.md, amended 2026-08-14 after the M1.5 prototype). The
/// prototype's own template `Ten kept, <title> last` produced "Ten kept, The
/// Shawshank Redemption last": exactly six words by luck, and eight with a
/// longer title. Nothing in the pipeline caught it, because the templates were
/// assumed safe.
///
/// A failing candidate is **discarded, never trimmed**. Trimming produces
/// half-jokes; discarding produces a different joke.
public enum Inscription {
    public static let maximumWords = 6

    /// Why a line was rejected. Returned rather than logged, because the
    /// reason is what a test asserts on and what a bug report needs.
    public enum Rejection: String, Sendable, Equatable {
        case empty
        case tooLong
        case quotesRankOne
        case containsQuotationMarks
        case containsEmoji
        case notDerivedFromList
    }

    /// Check a candidate line.
    ///
    /// - Parameters:
    ///   - line: model-written or template-filled. Both go through here.
    ///   - rankOneTitle: the #1 pick's title. Naming it is too obvious — the
    ///     badge should reference ranks 2-10 or a cross-list theme.
    ///   - referenceTokens: words drawn from the list. A line containing none
    ///     of them was not derived from the list, whatever it claims. Pass an
    ///     empty set to skip this clause (there is nothing to check against).
    public static func check(
        _ line: String,
        rankOneTitle: String?,
        referenceTokens: Set<String>
    ) -> Rejection? {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .empty }

        let words = trimmed.split(whereSeparator: \.isWhitespace)
        if words.count > maximumWords { return .tooLong }

        if trimmed.contains("\"") || trimmed.contains("\u{201C}") || trimmed.contains("\u{201D}") {
            return .containsQuotationMarks
        }
        if trimmed.unicodeScalars.contains(where: isEmoji) { return .containsEmoji }

        if let rankOneTitle, !rankOneTitle.isEmpty,
           trimmed.lowercased().contains(rankOneTitle.lowercased()) {
            return .quotesRankOne
        }

        if !referenceTokens.isEmpty {
            let lineTokens = Set(trimmed.lowercased()
                .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
                .map(String.init))
            if lineTokens.isDisjoint(with: referenceTokens) { return .notDerivedFromList }
        }
        return nil
    }

    public static func passes(
        _ line: String,
        rankOneTitle: String?,
        referenceTokens: Set<String>
    ) -> Bool {
        check(line, rankOneTitle: rankOneTitle, referenceTokens: referenceTokens) == nil
    }

    /// Template inscriptions, built from the list's own metadata.
    ///
    /// Every one of these is a candidate, not an answer: they go through
    /// ``check(_:rankOneTitle:referenceTokens:)`` exactly like model output,
    /// and the caller keeps only the survivors.
    public static func templates(facts: ListFacts, topic: Topic) -> [String] {
        var lines: [String] = []
        let noun = topic.domain.plural

        if let (creator, n) = facts.topCreator, n >= 3 {
            let family = SurnameIndex.familyName(of: creator) ?? creator
            lines.append("\(n) \(family) \(noun), no apologies")
        }
        if let (genre, n) = facts.topGenre, n >= 4 {
            lines.append("\(n) \(genre.lowercased()) \(noun), zero regrets")
        }
        if let (performer, n) = facts.topPerformer, n >= 3 {
            let family = SurnameIndex.familyName(of: performer) ?? performer
            lines.append("Wherever \(family) went")
        }
        if let (decade, n) = facts.topDecade, n >= 5 {
            lines.append("The \(TopicNaming.decadeName(decade)) settled it")
        }
        if facts.yearSpan >= 30 {
            lines.append("\(facts.yearSpan) years, one taste")
        }
        if let (genre, n) = facts.topGenre, n == facts.items.count {
            lines.append("\(genre), and nothing else")
        }
        // Second pick rather than first: the #1 is the obvious one, and the
        // check would reject it anyway.
        if facts.items.count > 1 {
            let second = facts.items[1].title
            let head = second.split(separator: ":").first.map(String.init) ?? second
            lines.append("Everything after \(head)")
        }
        return lines
    }

    /// A line that is guaranteed to pass, for the case where every template
    /// failed. Built from a single reference token, so it satisfies the
    /// derived-from-the-list clause by construction rather than by luck.
    ///
    /// This is the fallback ladder's very bottom rung, and the floor test
    /// (specs/badges.md) is about exactly this line: it must still be a badge
    /// you would screenshot.
    public static func guaranteed(facts: ListFacts, topic: Topic) -> String {
        if let (genre, _) = facts.topGenre {
            return "\(genre), all ten"
        }
        if let (decade, _) = facts.topDecade {
            return "All ten, the \(TopicNaming.decadeName(decade))"
        }
        return "Ten, and only ten"
    }

    /// Emoji and pictographs. Deliberately explicit rather than
    /// `isEmoji`-by-property: on Linux Foundation the character-property
    /// coverage is not the same as Darwin's, and a check that quietly does
    /// nothing on one platform is worse than no check.
    static func isEmoji(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x1F300...0x1FAFF,   // pictographs, emoticons, symbols, extensions
             0x2600...0x27BF,     // misc symbols and dingbats
             0x1F000...0x1F2FF,   // mahjong, dominoes, playing cards, enclosed
             0xFE00...0xFE0F,     // variation selectors
             0x1F1E6...0x1F1FF:   // regional indicators (flags)
            return true
        default:
            return false
        }
    }
}
