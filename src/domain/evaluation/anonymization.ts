// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Split out of the former monolithic src/domain/evaluation.ts (contention
// decomposition, no behavior change) -- see src/domain/evaluation.ts for
// the re-export barrel.

/**
 * Escapes every regex metacharacter in `s` so it can be embedded literally
 * inside a RegExp source string (a company name like "C++ Corp" must match
 * itself, not be read as regex syntax).
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * DEC-018 (wave-62 amendment): identities shorter than
 * `MIN_REDACTABLE_IDENTITY_LENGTH` are never masked. A one- or two-character
 * company name (e.g. "AI") cannot by itself identify a speaker, but as a
 * regex alternative it matches inside ordinary words ("det[AI]l",
 * "s[AI]d") and shreds the surrounding text -- so it is excluded rather
 * than masked with weaker anchoring.
 */
export const MIN_REDACTABLE_IDENTITY_LENGTH = 3;

/**
 * DEC-018 (wave-62 amendment): masks every occurrence of any of `identities`
 * inside `value` with the literal string `[hidden]`, case-insensitively.
 * Identities are matched as literal text (regex metacharacters escaped, so a
 * company like "C++ Corp" matches itself rather than being read as regex
 * syntax), anchored on both sides by a negative lookaround so a match must
 * sit on a word boundary -- a masked identity can never begin or end
 * mid-word, which is what let a short identity like "AI" rewrite "detail"
 * as "det[hidden]l" before this amendment -- and applied longest-first, so
 * a full name is masked before a shorter identity that happens to be a
 * substring of it gets a chance to leave a fragment behind. Identities
 * shorter than `MIN_REDACTABLE_IDENTITY_LENGTH` are dropped entirely (see
 * that constant's doc-comment); blank/whitespace-only identities are also
 * ignored (they would otherwise match everything). `value` may be a string
 * (masked directly) or an array of strings (each entry masked); any other
 * value (number, boolean, null, object, ...) passes through untouched --
 * this is a text-redaction primitive, not a deep-object walker.
 */
export function redactIdentity(value: unknown, identities: string[]): unknown {
  const cleaned = identities
    .map((id) => id.trim())
    .filter((id) => id.length >= MIN_REDACTABLE_IDENTITY_LENGTH)
    .sort((a, b) => b.length - a.length);

  if (cleaned.length === 0) {
    return value;
  }

  const pattern = new RegExp(
    cleaned.map((id) => `(?<![\\p{L}\\p{N}])${escapeRegExp(id)}(?![\\p{L}\\p{N}])`).join("|"),
    "giu",
  );

  const maskString = (s: string): string => s.replace(pattern, "[hidden]");

  if (typeof value === "string") {
    return maskString(value);
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return (value as string[]).map(maskString);
  }
  return value;
}

/**
 * Strips speaker identity/answer fields from a submission for an anonymized
 * reviewer queue, and masks every occurrence of a speaker's identity
 * (name/email/company, DEC-018 wave-54 amendment) out of the free text that
 * survives -- title, description, and every sessionAnswers[].value -- so an
 * anonymized plan carries no speaker identity STRING anywhere in the
 * payload, not just in the dedicated speaker fields. This must run
 * server-side -- anonymization is never implemented as CSS-hiding on the
 * client.
 */
export function anonymizeForReviewer<
  T extends {
    speakers?: unknown;
    speakerAnswers?: unknown;
    title?: unknown;
    description?: unknown;
    sessionAnswers?: { value: unknown }[];
  },
>(sub: T, identities: string[]): T & { anonymized: true } {
  const redactedSessionAnswers = sub.sessionAnswers?.map((a) => ({
    ...a,
    value: redactIdentity(a.value, identities),
  }));
  return {
    ...sub,
    speakers: undefined,
    speakerAnswers: undefined,
    title: typeof sub.title === "string" ? redactIdentity(sub.title, identities) : sub.title,
    description:
      typeof sub.description === "string" ? redactIdentity(sub.description, identities) : sub.description,
    ...(redactedSessionAnswers ? { sessionAnswers: redactedSessionAnswers } : {}),
    anonymized: true,
  };
}
