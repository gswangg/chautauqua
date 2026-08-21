// w7-df / DEC-663 ("a mock that matches nothing is a contract with
// itself"): routeManifest.ts's admin speaker-detail row visits a literal
// contact id, and its own comment history has claimed that id is a real,
// accepted, session- and task-bearing speaker. Nothing previously checked
// that claim against scripts/seed.ts's OWN id-derivation logic -- so a
// refactor of either file could silently point the render sweep at a
// contact whose page draws no Sessions row and no task row (exactly where
// the participation-status control lives), and no test would notice.
//
// This derives the pool of contact ids scripts/seed.ts actually seeds as
// "accepted, session- and task-bearing" FROM THE SCRIPT'S OWN SOURCE TEXT --
// never by re-typing ids as literals here, so the check tracks the script
// even as its numbering/index set changes:
//
//  - the demo speaker persona (`speakerContactId = seedId("contact", N)`)
//    is always in the pool: her first fixture submission is hardcoded
//    `status: i === 0 ? "accepted" : "pending"`, so she always has a real
//    accepted submission -- a real Sessions participant row
//    (rosterParticipantConditions: submission.status === 'accepted') and a
//    real set of task_assignment rows (every acceptedSubmissions entry gets
//    one row per default onboarding task, unconditionally).
//  - every index in `bumpToAccepted` promotes ADDITIONAL synthetic
//    submission #i (1-based contact id seedId("synth_contact", i+1)) to
//    'accepted' -- same Sessions/Tasks guarantee, regardless of any
//    contentStatusOverride (that only touches content_status, never
//    submission.status or the accepted-roster membership Sessions/Tasks
//    read).
//
// Same family as test/render-sweep-manifest-parity.test.ts and
// test/route-manifest-authz-parity.scan.test.ts: a SOURCE-DERIVED check, not
// a hand-listed one, so it cannot rot silently.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { seedId } from "../scripts/seed-lib";
import { ROUTE_MANIFEST } from "../app/src/routeManifest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SEED_SOURCE = readFileSync(join(HERE, "..", "scripts", "seed.ts"), "utf-8");

/** Regex-extract `const <varName> = seedId("<kind>", <N>);` from seed.ts's
 * own source text -- fail loudly (never fall back to a guessed number) if
 * the script's shape has moved out from under this extraction, so a
 * silent divergence can't hide as a green test. */
function extractSeedIdNumber(varName: string, kind: string): number {
  const re = new RegExp(`const ${varName} = seedId\\("${kind}", (\\d+)\\)`);
  const m = SEED_SOURCE.match(re);
  if (!m) {
    throw new Error(
      `route-manifest-fixture-coverage: could not find "const ${varName} = seedId(\"${kind}\", N)" in ` +
        `scripts/seed.ts -- the derivation this test relies on has moved; update the extraction, don't ` +
        `hardcode the id.`,
    );
  }
  return Number(m[1]);
}

/** Regex-extract a `const <varName> = new Set([...numbers]);` literal from
 * seed.ts's own source text. */
function extractNumberSet(varName: string): number[] {
  const re = new RegExp(`const ${varName} = new Set\\(\\[([^\\]]*)\\]\\)`);
  const m = SEED_SOURCE.match(re);
  if (!m) {
    throw new Error(
      `route-manifest-fixture-coverage: could not find "const ${varName} = new Set([...])" in scripts/seed.ts ` +
        `-- the derivation this test relies on has moved; update the extraction, don't hardcode the ids.`,
    );
  }
  const captured = m[1];
  if (captured === undefined) {
    throw new Error(`route-manifest-fixture-coverage: regex for ${varName} matched with no capture group`);
  }
  const nums = captured
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
  if (nums.length === 0 || nums.some((n) => !Number.isFinite(n))) {
    throw new Error(
      `route-manifest-fixture-coverage: ${varName}'s extracted contents "${captured}" did not parse as a ` +
        `non-empty list of numbers.`,
    );
  }
  return nums;
}

describe("route manifest fixture coverage (DEC-663)", () => {
  it("derives a non-empty pool of accepted, session- and task-bearing speaker contact ids from scripts/seed.ts's own source", () => {
    const speakerContactNumber = extractSeedIdNumber("speakerContactId", "contact");
    const bumpToAccepted = extractNumberSet("bumpToAccepted");

    const sessionAndTaskBearingContactIds = new Set<string>([
      seedId("contact", speakerContactNumber),
      ...bumpToAccepted.map((i) => seedId("synth_contact", i + 1)),
    ]);

    // Non-vacuity guard: a refactor that empties bumpToAccepted, or breaks
    // the extraction into returning a degenerate pool, must not leave this
    // test green over a pool too small to mean anything.
    expect(sessionAndTaskBearingContactIds.size).toBeGreaterThanOrEqual(2);

    const speakerDetailRows = ROUTE_MANIFEST.filter(
      (entry) => /^\/admin\/speakers\/[^/]+$/.test(entry.path) && entry.role === "organizer",
    );
    // Non-vacuity guard on the manifest side: the check must actually cover
    // at least one row, or a manifest refactor that renamed/removed the
    // speaker-detail row could leave this test vacuously green.
    expect(speakerDetailRows.length).toBeGreaterThan(0);

    for (const entry of speakerDetailRows) {
      const contactId = entry.params?.contactId;
      expect(contactId, `manifest row ${entry.path} has no params.contactId`).toBeTruthy();
      expect(
        sessionAndTaskBearingContactIds.has(contactId!),
        `routeManifest.ts's speaker-detail row visits contact id "${contactId}", which scripts/seed.ts's own ` +
          `derivation does not seed as accepted/session- and task-bearing (pool: ` +
          `${[...sessionAndTaskBearingContactIds].join(", ")}). DEC-663: a fixture id that resolves to nothing ` +
          `is a mock that matches nothing.`,
      ).toBe(true);
    }
  });

  it("the same pool is used to derive scripts/render-sweep.ts's mobile speaker-detail param (parity, not a re-typed literal)", () => {
    // scripts/render-sweep.ts owns MOBILE_SPEAKER_ID itself (out of scope
    // for this task, sibling lanes v12m-w7-dd/-de). This test only asserts
    // that whatever ROUTE_MANIFEST names for the public speaker drill-in
    // (same MOBILE_SPEAKER_ID literal per routeManifest.ts's own header
    // comment) is drawn from the same real seed.ts contact pool as a
    // sanity cross-check -- not a claim about render-sweep.ts's file
    // contents, which this task must not touch.
    const speakerContactNumber = extractSeedIdNumber("speakerContactId", "contact");
    const demoSpeakerContactId = seedId("contact", speakerContactNumber);

    const publicSpeakerDrillInRows = ROUTE_MANIFEST.filter((entry) =>
      /^\/e\/[^/]+\/speakers\/[^/]+$/.test(entry.path),
    );
    expect(publicSpeakerDrillInRows.length).toBeGreaterThan(0);
    for (const entry of publicSpeakerDrillInRows) {
      expect(entry.params?.speakerId).toBe(demoSpeakerContactId);
    }
  });
});
