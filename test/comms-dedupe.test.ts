// DEC-238 wave-3 amendment: pure-domain tests for src/domain/comms-dedupe.ts
// (DEC-002: no node:/cloudflare imports in this module).

import { describe, expect, it } from "vitest";
import {
  CLAIM_LINK_DEDUPE_PLACEHOLDER,
  COMPOSE_DEDUPE_WINDOW_MS,
  dedupeCutoff,
  dedupeKey,
  intraBatchKey,
  normalizeMintedClaimLinks,
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
    expect(dedupeKey("  Ada@Example.com ", "Hello", "Body")).toBe(dedupeKey("ada@example.com", "Hello", "Body"));
    expect(dedupeKey("ada@example.com", "Hello", "Body")).not.toBe(dedupeKey("ada@example.com", "hello", "Body"));
  });

  it("dedupeKey never collides an email+subject split across the separator", () => {
    // Without a JSON-encoded key, "a b"+"c" and "a"+"b c" could collide on a
    // naive string-join key.
    const k1 = dedupeKey("a b", "c", "body");
    const k2 = dedupeKey("a", "b c", "body");
    expect(k1).not.toBe(k2);
  });

  // DEC-936 (wave-17 amendment): dedupeKey now carries a body term so a
  // static subject that spends its per-submission merge vars only in the
  // body is not mistaken for the same message twice.
  it("dedupeKey distinguishes two messages with the same subject but different bodies", () => {
    expect(dedupeKey("ada@example.com", "Hi", "Body A")).not.toBe(dedupeKey("ada@example.com", "Hi", "Body B"));
  });
});

// wave-60 amendment (DEC-238, P1 cluster 4): planComposeSends is the pure
// planner extracted from src/routes/comms/send.ts so /compose/preview can
// run the identical decision — same key function, same stage order, same
// reason literals.
type Row = { email: string; name: string; subject: string; text: string; submissionId: string };

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

  it("stage 1 (intra-batch): the second identical (email, subject, body) row is skipped, keyed on both", () => {
    const first = row("a@example.com", "Hi", "sub-1");
    const second = row("a@example.com", "Hi", "sub-2"); // same email+subject+body, different submission
    const differentSubject = row("a@example.com", "Bye", "sub-3"); // same email, different subject: not a dup
    const { toSend, skipped } = planComposeSends([first, second, differentSubject], new Map());
    expect(toSend).toEqual([first, differentSubject]);
    expect(skipped).toEqual([
      { email: "a@example.com", name: "Ada", submissionId: "sub-2", reason: "duplicate_in_batch" },
    ]);
  });

  // DEC-936 (wave-17): the widened stage-1 key is exactly what stops it from
  // undoing expandRecipients' non-collapse decision -- a static subject that
  // spends its per-submission merge vars in the BODY must not collapse.
  it("stage 1: two rows for one contact sharing an address AND subject but with DIFFERENT bodies both send", () => {
    const first = row("a@example.com", "Hi", "sub-1", "Ada", "About talk: Engines");
    const second = row("a@example.com", "Hi", "sub-2", "Ada", "About talk: Difference Engines");
    const { toSend, skipped } = planComposeSends([first, second], new Map());
    expect(toSend).toEqual([first, second]);
    expect(skipped).toEqual([]);
  });

  it("stage 1: two byte-identical rows (same email, subject, AND body) still collapse to one", () => {
    const first = row("a@example.com", "Hi", "sub-1", "Ada", "Same body for everyone.");
    const second = row("a@example.com", "Hi", "sub-2", "Ada", "Same body for everyone.");
    const { toSend, skipped } = planComposeSends([first, second], new Map());
    expect(toSend).toEqual([first]);
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
});

// DEC-397 (wave-20 amendment): a minted claim URL is downstream of message
// identity, so it must never split a dedupe key. See src/domain/
// comms-dedupe.ts's normalizeMintedClaimLinks for the full rationale.
describe("normalizeMintedClaimLinks (DEC-397 wave-20 amendment)", () => {
  it("collapses a real minted token to the same placeholder as PREVIEW_CLAIM_TOKEN", () => {
    const minted = "See you at DevCon: https://events.example.com/claim/AbC-1_2xyz";
    const preview = "See you at DevCon: https://events.example.com/claim/example-one-time-link";
    expect(normalizeMintedClaimLinks(minted)).toBe(normalizeMintedClaimLinks(preview));
    expect(normalizeMintedClaimLinks(minted)).toBe(`See you at DevCon: https://events.example.com${CLAIM_LINK_DEDUPE_PLACEHOLDER}`);
  });

  it("normalizes every occurrence when a body links the claim URL more than once", () => {
    const body = "Link: https://a.example.com/claim/tok1 or https://a.example.com/claim/tok2";
    const out = normalizeMintedClaimLinks(body);
    expect(out).toBe(`Link: https://a.example.com${CLAIM_LINK_DEDUPE_PLACEHOLDER} or https://a.example.com${CLAIM_LINK_DEDUPE_PLACEHOLDER}`);
  });

  it("leaves a body with no claim link untouched", () => {
    expect(normalizeMintedClaimLinks("Hi, see you at DevCon.")).toBe("Hi, see you at DevCon.");
  });

  it("fails loudly on a '/claim/' not followed by a token-shaped segment", () => {
    expect(() => normalizeMintedClaimLinks("Go to https://events.example.com/claim/")).toThrow(/token-shaped segment/);
  });

  it("dedupeKey treats two bodies differing only in their minted claim token as the SAME key", () => {
    const bodyA = "See you at DevCon: https://events.example.com/claim/mintedTokenOne";
    const bodyB = "See you at DevCon: https://events.example.com/claim/mintedTokenTwo";
    expect(dedupeKey("a@example.com", "Hi all", bodyA)).toBe(dedupeKey("a@example.com", "Hi all", bodyB));
    // A genuinely different message (not just a different mint) still splits.
    expect(dedupeKey("a@example.com", "Hi all", bodyA)).not.toBe(dedupeKey("a@example.com", "Hi all", "Something else entirely"));
  });

  it("intraBatchKey normalizes its body term the same way dedupeKey does", () => {
    const bodyA = "See you at DevCon: https://events.example.com/claim/mintedTokenOne";
    const bodyB = "See you at DevCon: https://events.example.com/claim/mintedTokenTwo";
    expect(intraBatchKey("a@example.com", "Hi all", bodyA, "")).toBe(intraBatchKey("a@example.com", "Hi all", bodyB, ""));
  });
});
