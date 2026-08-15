// DEC-238 wave-3 amendment: pure-domain tests for src/domain/comms-dedupe.ts
// (DEC-002: no node:/cloudflare imports in this module).

import { describe, expect, it } from "vitest";
import { COMPOSE_DEDUPE_WINDOW_MS, dedupeCutoff, dedupeKey, retryAtMs } from "../src/domain/comms-dedupe";

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
});
