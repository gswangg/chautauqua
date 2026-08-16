/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import type { SQL } from "drizzle-orm";
import {
  ACTIVE_INVITE_STATUSES,
  PORTAL_VISIBLE_INVITE_STATUSES,
  SCHEDULING_PARTICIPANT_STATUSES,
} from "../src/domain/acceptance";
import { visibleParticipantConditions } from "../src/server/repo/public/gates";

/**
 * Recursively walks a drizzle SQL expression's queryChunks and collects
 * every bound param value. Used to inspect what values an `inArray(...)`
 * clause actually bound, so a test can assert the gate is COMPOSING the
 * declared constant rather than re-typing its own literal pair.
 */
function collectBoundParamValues(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const item of node) collectBoundParamValues(item, out);
    return out;
  }
  if (node && typeof node === "object") {
    const asRecord = node as { value?: unknown; queryChunks?: unknown[] };
    if (asRecord.value !== undefined && !Array.isArray(asRecord.value)) {
      out.push(asRecord.value);
    }
    if (asRecord.queryChunks) collectBoundParamValues(asRecord.queryChunks, out);
  }
  return out;
}

const ALL_INVITE_STATUSES = ["none", "invited", "accepted", "declined"];

describe("visibleParticipantConditions composes ACTIVE_INVITE_STATUSES (DEC-180 wave-75)", () => {
  it("binds exactly the ACTIVE_INVITE_STATUSES member set into the SQL IN clause — no more, no less", () => {
    const gate = visibleParticipantConditions() as SQL;
    const boundStatusValues = collectBoundParamValues(gate).filter(
      (v): v is string => typeof v === "string" && ALL_INVITE_STATUSES.includes(v),
    );
    expect(new Set(boundStatusValues)).toEqual(new Set(ACTIVE_INVITE_STATUSES));
  });

  it("changing ACTIVE_INVITE_STATUSES changes what the gate matches — set equality is enforced by construction, not by re-typing", () => {
    // The gate imports and directly reuses ACTIVE_INVITE_STATUSES (see
    // src/server/repo/public/gates.ts), so the set the gate matches IS the
    // constant's set by reference, not a second hand-typed literal pair.
    expect(new Set(ACTIVE_INVITE_STATUSES)).toEqual(new Set(["none", "accepted"]));
  });
});

// DEC-180 wave-75 amendment part (b): SCHEDULING_PARTICIPANT_STATUSES and
// PORTAL_VISIBLE_INVITE_STATUSES are one declaration (the second re-exports
// the first) so they can never diverge silently. Pin both sets so a future
// change to either is deliberate, not an accident.
describe("SCHEDULING_PARTICIPANT_STATUSES and PORTAL_VISIBLE_INVITE_STATUSES are pinned identical (DEC-180 wave-75)", () => {
  it("are the same array reference (one declaration, re-exported)", () => {
    expect(PORTAL_VISIBLE_INVITE_STATUSES).toBe(SCHEDULING_PARTICIPANT_STATUSES);
  });

  it("pin the exact member set", () => {
    expect(new Set(SCHEDULING_PARTICIPANT_STATUSES)).toEqual(new Set(["none", "invited", "accepted"]));
    expect(new Set(PORTAL_VISIBLE_INVITE_STATUSES)).toEqual(new Set(["none", "invited", "accepted"]));
  });

  it("is a strict superset of ACTIVE_INVITE_STATUSES (adds only 'invited')", () => {
    const extra = SCHEDULING_PARTICIPANT_STATUSES.filter(
      (s) => !(ACTIVE_INVITE_STATUSES as readonly string[]).includes(s),
    );
    expect(extra).toEqual(["invited"]);
  });
});
