// DEC-238 wave-3 amendment: pure-domain tests for src/domain/comms-dedupe.ts
// (DEC-002: no node:/cloudflare imports in this module).

import { describe, expect, it } from "vitest";
import {
  COMPOSE_DEDUPE_WINDOW_MS,
  DEDUPE_CLAIM_TOKEN_PLACEHOLDER,
  dedupeCutoff,
  dedupeKey,
  normalizeClaimLinks,
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

  // DEC-397 (this wave's amendment): A MINT IS THE LAST THING A SEND DOES,
  // so a mint is downstream of message identity and identity must not read
  // it. A send mints a fresh per-recipient /claim/<token> AFTER the render
  // the key is computed on, so email_log stores a MINTED link while the
  // next call keys on the UNMINTED PREVIEW_CLAIM_TOKEN render. Without
  // normalization the cross-call window is dead for every {portal_link}
  // template.
  it("dedupeKey collapses a minted claim URL to the unminted one it was rendered from", () => {
    const minted = "See you at DevCon: https://events.example.com/claim/hK3q_lZ8vN-Ta1BxQe7Ry0dGmS4pC2wJ";
    const unminted = "See you at DevCon: https://events.example.com/claim/example-one-time-link";
    expect(dedupeKey("ada@example.com", "Hi", minted)).toBe(dedupeKey("ada@example.com", "Hi", unminted));
  });

  it("normalizeClaimLinks replaces EVERY claim path in a body, and touches nothing else", () => {
    expect(normalizeClaimLinks("a https://x.test/claim/AAA b https://y.test/claim/B-b_9 c")).toBe(
      `a https://x.test/claim/${DEDUPE_CLAIM_TOKEN_PLACEHOLDER} b https://y.test/claim/${DEDUPE_CLAIM_TOKEN_PLACEHOLDER} c`,
    );
    // Not a claim path: /portal and a bare word "claim" are left alone, so
    // the normalizer cannot silently erase real body differences.
    const untouched = "Your portal: https://x.test/portal — reclaim your seat";
    expect(normalizeClaimLinks(untouched)).toBe(untouched);
  });

  // The normalizer must not become a blanket body-eraser: two genuinely
  // different messages that merely both carry a claim link stay distinct.
  it("dedupeKey still separates two different bodies that each carry a claim link", () => {
    const a = "Talk A is confirmed: https://x.test/claim/AAA";
    const b = "Talk B is confirmed: https://x.test/claim/BBB";
    expect(dedupeKey("ada@example.com", "Hi", a)).not.toBe(dedupeKey("ada@example.com", "Hi", b));
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
