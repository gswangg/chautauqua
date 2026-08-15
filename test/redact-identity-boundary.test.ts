// DEC-018 (wave-62 amendment): redactIdentity must not mask letters inside
// ordinary words. A short identity (e.g. a two-letter company name like
// "AI") is excluded entirely (MIN_REDACTABLE_IDENTITY_LENGTH), and every
// surviving identity is matched with word-boundary anchoring so it can never
// begin or end mid-word.

import { describe, expect, it } from "vitest";
import { anonymizeForReviewer, MIN_REDACTABLE_IDENTITY_LENGTH, redactIdentity } from "../src/domain/evaluation";

describe("MIN_REDACTABLE_IDENTITY_LENGTH", () => {
  it("is 3", () => {
    expect(MIN_REDACTABLE_IDENTITY_LENGTH).toBe(3);
  });
});

describe("redactIdentity word-boundary anchoring", () => {
  it("leaves ordinary words byte-identical when the only identity is a short company name", () => {
    const identities = ["AI"];
    expect(redactIdentity("Please review the detail before the deadline.", identities)).toBe(
      "Please review the detail before the deadline.",
    );
    expect(redactIdentity("She said the training was available.", identities)).toBe(
      "She said the training was available.",
    );
  });

  it("masks a standalone 3-char identity but not when it's a substring of a larger token", () => {
    const identities = ["IBM"];
    expect(redactIdentity("Works at IBM today.", identities)).toBe("Works at [hidden] today.");
    expect(redactIdentity("Works at IBMX today.", identities)).toBe("Works at IBMX today.");
    expect(redactIdentity("Works at xIBM today.", identities)).toBe("Works at xIBM today.");
  });

  it("masks an accented full name at string start, middle, and end", () => {
    const identities = ["Frankie Ekström"];
    expect(redactIdentity("Frankie Ekström is speaking.", identities)).toBe("[hidden] is speaking.");
    expect(redactIdentity("Please welcome Frankie Ekström.", identities)).toBe("Please welcome [hidden].");
    expect(redactIdentity("Frankie Ekström", identities)).toBe("[hidden]");
  });

  it("masks an email address", () => {
    const identities = ["frankie@example.com"];
    expect(redactIdentity("Contact frankie@example.com for details.", identities)).toBe(
      "Contact [hidden] for details.",
    );
  });

  it("masks identities containing regex metacharacters and special chars literally, without throwing under the u flag", () => {
    expect(redactIdentity("Sponsored by C++ Corp this year.", ["C++ Corp"])).toBe(
      "Sponsored by [hidden] this year.",
    );
    expect(() => redactIdentity("weird [x] {y} z|w text", ["[x]"])).not.toThrow();
    expect(redactIdentity("weird [x] {y} z|w text", ["[x]"])).toBe("weird [hidden] {y} z|w text");
    expect(() => redactIdentity("weird [x] {y} z|w text", ["{y}"])).not.toThrow();
    expect(redactIdentity("weird [x] {y} z|w text", ["{y}"])).toBe("weird [x] [hidden] z|w text");
    expect(() => redactIdentity("weird [x] {y} z|w text", ["z|w"])).not.toThrow();
    expect(redactIdentity("weird [x] {y} z|w text", ["z|w"])).toBe("weird [x] {y} [hidden] text");
  });

  it("applies longest-first so a full name is masked before a company that is a substring of it", () => {
    const identities = ["Ekström", "Frankie Ekström"];
    expect(redactIdentity("Frankie Ekström spoke today.", identities)).toBe("[hidden] spoke today.");
  });

  it("masks an array of strings per entry", () => {
    const identities = ["IBM"];
    expect(redactIdentity(["Works at IBM", "no match here"], identities)).toEqual([
      "Works at [hidden]",
      "no match here",
    ]);
  });

  it("passes through non-string/non-string-array values untouched", () => {
    const identities = ["IBM"];
    expect(redactIdentity(42, identities)).toBe(42);
    expect(redactIdentity(null, identities)).toBe(null);
    expect(redactIdentity({ a: "IBM" }, identities)).toEqual({ a: "IBM" });
  });

  it("drops blank/whitespace-only identities and identities under the floor", () => {
    expect(redactIdentity("AI said hi", ["", "  ", "AI"])).toBe("AI said hi");
  });
});

describe("escapeRegExp remains compatible with the u flag", () => {
  it("escapes ] and } which the u flag makes mandatory to escape", () => {
    // If escapeRegExp's class ever stopped escaping ] or }, constructing the
    // pattern with the "u" flag would throw a SyntaxError (Invalid regular
    // expression: lone unescaped bracket) instead of silently misbehaving --
    // this test documents that dependency without editing escapeRegExp.
    expect(() => redactIdentity("a ] b", ["]"])).not.toThrow();
    expect(() => redactIdentity("a } b", ["}"])).not.toThrow();
  });
});

describe("anonymizeForReviewer end-to-end word-boundary coverage", () => {
  it("covers title, description, and every sessionAnswers[].value with the new anchoring", () => {
    const sub = {
      title: "A Detailed Guide to AI Training",
      description: "This session is said to be available for all levels.",
      sessionAnswers: [
        { value: "Frankie Ekström will detail the training." },
        { value: 12345 },
      ],
      speakers: ["Frankie Ekström"],
      speakerAnswers: ["something"],
    };
    const identities = ["AI", "Frankie Ekström"];
    const result = anonymizeForReviewer(sub, identities);

    expect(result.title).toBe("A Detailed Guide to AI Training");
    expect(result.description).toBe("This session is said to be available for all levels.");
    expect(result.sessionAnswers?.[0]?.value).toBe("[hidden] will detail the training.");
    expect(result.sessionAnswers?.[1]?.value).toBe(12345);
    expect(result.speakers).toBeUndefined();
    expect(result.speakerAnswers).toBeUndefined();
    expect(result.anonymized).toBe(true);
  });
});
