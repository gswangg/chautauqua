// DEC-238 wave-3 amendment: pure-domain tests for src/domain/comms-dedupe.ts
// (DEC-002: no node:/cloudflare imports in this module).

import { describe, expect, it } from "vitest";
import {
  COMPOSE_DEDUPE_WINDOW_MS,
  dedupeCutoff,
  dedupeKey,
  planComposeSends,
  retryAtMs,
} from "../src/domain/comms-dedupe";

describe("comms-dedupe (DEC-238 wave-3 amendment)", () => {
  it("COMPOSE_DEDUPE_WINDOW_MS is one hour", () => {
    expect(COMPOSE_DEDUPE_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  it("dedupeCutoff subtracts the window from now", () => {
    const now = 1_700_000_000_000;
    expect(dedupeCutoff(now)).toBe(now - COMPOSE_DEDUPE_WINDOW_MS);
  });

  it("retryAtMs adds the window to the prior send", () => {
    const lastSentAt = 1_700_000_000_000;
    expect(retryAtMs(lastSentAt)).toBe(lastSentAt + COMPOSE_DEDUPE_WINDOW_MS);
  });

  it("dedupeKey lower-cases and trims the email but leaves the subject exact", () => {
    expect(dedupeKey("  Ada@Example.com ", "Hello")).toBe(dedupeKey("ada@example.com", "Hello"));
    expect(dedupeKey("ada@example.com", "Hello")).not.toBe(dedupeKey("ada@example.com", "hello"));
  });

  it("dedupeKey never collides an email+subject split across the separator", () => {
    // Without a JSON-encoded key, "a b"+"c" and "a"+"b c" could collide on a
    // naive string-join key.
    const k1 = dedupeKey("a b", "c");
    const k2 = dedupeKey("a", "b c");
    expect(k1).not.toBe(k2);
  });

  // DEC-936 (wave-17 amendment): the body term.
  it("dedupeKey distinguishes two messages with the same email+subject but different bodies", () => {
    expect(dedupeKey("a@example.com", "Hi", "Body A")).not.toBe(dedupeKey("a@example.com", "Hi", "Body B"));
  });

  it("dedupeKey defaults body to \"\" for a caller that omits it, unchanged from pre-wave-17 behaviour", () => {
    expect(dedupeKey("a@example.com", "Hi")).toBe(dedupeKey("a@example.com", "Hi", ""));
  });
});

// wave-60 amendment (DEC-238, P1 cluster 4): planComposeSends is the pure
// planner extracted from src/routes/comms/send.ts so /compose/preview can
// run the identical decision — same key function, same stage order, same
// reason literals.
type Row = { email: string; name: string; subject: string; text: string; submissionId: string };

// DEC-936 (wave-17 amendment): `text` defaults to a shared constant body so
// existing cases (which mean "the exact same rendered message twice")
// continue to collide exactly as before the body term was added; tests that
// need two DIFFERENT rendered bodies for the same (email, subject) pass
// `text` explicitly.
function row(email: string, subject: string, submissionId: string, name = "Ada", text = "Body"): Row {
  return { email, name, subject, text, submissionId };
}

describe("planComposeSends (wave-60, DEC-238)", () => {
  it("sends everyone when nothing collides and recentlySent is empty", () => {
    const rendered = [row("a@example.com", "Hi", "sub-1"), row("b@example.com", "Hi", "sub-2")];
    const { toSend, skipped } = planComposeSends(rendered, new Map());
    expect(toSend).toEqual(rendered);
    expect(skipped).toEqual([]);
  });

  it("stage 1 (intra-batch): the second identical (email, subject) row is skipped, keyed on both", () => {
    const first = row("a@example.com", "Hi", "sub-1");
    const second = row("a@example.com", "Hi", "sub-2"); // same email+subject, different submission
    const differentSubject = row("a@example.com", "Bye", "sub-3"); // same email, different subject: not a dup
    const { toSend, skipped } = planComposeSends([first, second, differentSubject], new Map());
    expect(toSend).toEqual([first, differentSubject]);
    expect(skipped).toEqual([
      { email: "a@example.com", name: "Ada", submissionId: "sub-2", reason: "duplicate_in_batch" },
    ]);
  });

  it("stage 2 (recentlySent window): a stage-1 survivor still checked against recentlySent is skipped with retryAtIso", () => {
    const rendered = [row("a@example.com", "Hi", "sub-1")];
    const lastSentAt = 1_700_000_000_000;
    const recentlySent = new Map([[dedupeKey("a@example.com", "Hi", "Body"), lastSentAt]]);
    const { toSend, skipped } = planComposeSends(rendered, recentlySent);
    expect(toSend).toEqual([]);
    expect(skipped).toEqual([
      {
        email: "a@example.com",
        name: "Ada",
        submissionId: "sub-1",
        reason: "already_sent_recently",
        retryAtIso: new Date(retryAtMs(lastSentAt)).toISOString(),
      },
    ]);
  });

  it("a stage-1 duplicate is never also checked against recentlySent (stage 1 runs first)", () => {
    const first = row("a@example.com", "Hi", "sub-1");
    const second = row("a@example.com", "Hi", "sub-2");
    // recentlySent has an entry for this key too -- if stage 2 ran on the
    // stage-1 loser, it would report "already_sent_recently" instead.
    const recentlySent = new Map([[dedupeKey("a@example.com", "Hi", "Body"), 1_700_000_000_000]]);
    const { toSend, skipped } = planComposeSends([first, second], recentlySent);
    // `first` collides with recentlySent (stage 2), `second` collides with
    // `first` intra-batch (stage 1) and is never re-checked against the map.
    expect(toSend).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual(["duplicate_in_batch", "already_sent_recently"]);
  });

  it("preserves ordering: duplicate_in_batch skips (stage 1, in encounter order) precede already_sent_recently skips (stage 2)", () => {
    const a = row("a@example.com", "Hi", "sub-1");
    const aDup = row("a@example.com", "Hi", "sub-2");
    const b = row("b@example.com", "Hi", "sub-3");
    const recentlySent = new Map([[dedupeKey("b@example.com", "Hi", "Body"), 1_700_000_000_000]]);
    const { toSend, skipped } = planComposeSends([a, aDup, b], recentlySent);
    expect(toSend).toEqual([a]);
    expect(skipped.map((s) => s.submissionId)).toEqual(["sub-2", "sub-3"]);
    expect(skipped.map((s) => s.reason)).toEqual(["duplicate_in_batch", "already_sent_recently"]);
  });

  // DEC-936 (wave-17 amendment): the regression case the ruling names by
  // hand — a static subject with a per-submission token spent only in the
  // BODY (e.g. {talk_title}) and no attachment must not collapse. Before
  // this amendment, stage 1's key had no body term, so the second row
  // reported `duplicate_in_batch` even though it is a genuinely different
  // letter for the speaker's second submission.
  it("one contact, two submissions, static subject, per-submission body content, no attachment: both send, none skipped", () => {
    const first = row("speaker@example.com", "Your submission update", "sub-1", "Ada", "Your talk 'Alpha' was accepted.");
    const second = row("speaker@example.com", "Your submission update", "sub-2", "Ada", "Your talk 'Beta' was accepted.");
    const { toSend, skipped } = planComposeSends([first, second], new Map());
    expect(toSend).toEqual([first, second]);
    expect(skipped).toEqual([]);
  });
});
