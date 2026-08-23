// DEC-069 wave-56 (task w56-a): the exit predicate's real-tree self-test.
//
// Four consecutive waves (w50, w53, w54, w56) found the exit predicate DEAD
// -- each time by a planner typing
// `npx tsx scripts/exit-predicate.ts --product-sha <sha>` by hand, because
// nothing in the automated suite ever ran the REAL registries
// (CAMPAIGN_CONSTANT_NAMES / TIER2_CEILING_NAMES / OUT_OF_CAMPAIGN_SCOPE /
// PARKED_FIDELITY_PROMISES) against the REAL corpus.
// `scripts/exit-predicate/campaign.ts`'s own `loadCampaignFiles` header says
// plainly: "anything (including tests) that needs the real corpus must call
// this function rather than re-deriving the git-ls-files/path-filter/read
// shape itself." This file is that caller.
//
// This is deliberately NOT `test/exit-predicate-campaign.test.ts` -- that
// file grades the pure FUNCTIONS against synthetic fixtures and stays
// exactly as it is (per task instructions, not edited here). This file
// grades the live REGISTRIES: it loads the real corpus once with
// `loadCampaignFiles(REPO_ROOT)` and asserts that the same four functions,
// run over the real files and the real registries, do not throw -- i.e.
// that the predicate `main()` would actually print its table instead of
// dying.
//
// DEC-967 non-vacuity control: each assertion is also proven capable of
// FAILING, by calling it on a fabricated in-memory CampaignFile[] /
// fabricated registry object that violates it -- never by mutating the real
// registries (mutating a shared module-level const would leak across
// tests and is exactly the kind of instrument self-contamination DEC-976
// warns about).

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCampaignPopulationTotal,
  assertEveryGradedCeilingIsGated,
  assertParkedPromisesAreHonestlyParked,
  buildCampaignReport,
  findCampaignCeilingCandidates,
  loadCampaignFiles,
  type CampaignFile,
  type SuiteEvidence,
} from "../scripts/exit-predicate/campaign";
import {
  CAMPAIGN_CONSTANT_NAMES,
  OUT_OF_CAMPAIGN_SCOPE,
  PARKED_FIDELITY_PROMISES,
  TIER2_CEILING_NAMES,
} from "../scripts/exit-predicate/campaign-scope";

const REPO_ROOT = join(__dirname, "..");

const RERUN_HINT =
  "Run `npx tsx scripts/exit-predicate.ts --product-sha <sha>` (substituting the real product " +
  "sha) to see the full failure the live predicate would throw.";

// Loaded once, at module scope, per `loadCampaignFiles`'s own contract as
// the ONE enumerator for the real corpus (DEC-613) -- every `it` below reads
// this same array rather than re-walking the tree.
const REAL_FILES: readonly CampaignFile[] = loadCampaignFiles(REPO_ROOT);

const REAL_EVIDENCE: SuiteEvidence = {
  productSha: "live-registry-self-test-sha",
  suiteVerifiedAtSha: null,
  framesVerifiedAtSha: null,
  isAncestor: () => false,
};

describe("exit predicate live registries against the real corpus (DEC-069 wave-56)", () => {
  it("loadCampaignFiles(REPO_ROOT) finds a non-empty real corpus", () => {
    expect(REAL_FILES.length).toBeGreaterThan(0);
  });

  it("assertCampaignPopulationTotal does not throw over the real corpus", () => {
    expect(() => {
      try {
        assertCampaignPopulationTotal(findCampaignCeilingCandidates(REAL_FILES));
      } catch (err) {
        throw new Error(
          `Live campaign population total assertion failed against the real tree: ` +
            `${(err as Error).message} ${RERUN_HINT}`,
        );
      }
    }).not.toThrow();
  });

  it("assertCampaignPopulationTotal DOES throw on a fabricated candidate the real registries don't know (non-vacuity control)", () => {
    expect(() =>
      assertCampaignPopulationTotal(["TOTALLY_FABRICATED_UNREGISTERED_CEILING"]),
    ).toThrow(/neither graded.*nor excused/);
  });

  it("assertEveryGradedCeilingIsGated does not throw over the real registries", () => {
    expect(() => {
      try {
        assertEveryGradedCeilingIsGated(
          CAMPAIGN_CONSTANT_NAMES,
          TIER2_CEILING_NAMES,
          OUT_OF_CAMPAIGN_SCOPE,
        );
      } catch (err) {
        throw new Error(
          `Live graded-ceiling-is-gated assertion failed against the real registries: ` +
            `${(err as Error).message} ${RERUN_HINT}`,
        );
      }
    }).not.toThrow();
  });

  it("assertEveryGradedCeilingIsGated DOES throw on a fabricated graded-but-ungated ceiling (non-vacuity control)", () => {
    expect(() =>
      assertEveryGradedCeilingIsGated(
        ["FABRICATED_UNGATED_CEILING"],
        [], // not in tier2
        {}, // not excused
      ),
    ).toThrow(/graded.*but neither reported.*nor excused/);
  });

  it("assertParkedPromisesAreHonestlyParked does not throw over the real corpus and registries", () => {
    expect(() => {
      try {
        assertParkedPromisesAreHonestlyParked(
          REAL_FILES,
          OUT_OF_CAMPAIGN_SCOPE,
          PARKED_FIDELITY_PROMISES,
        );
      } catch (err) {
        throw new Error(
          `Live parked-fidelity-promise assertion failed against the real tree: ` +
            `${(err as Error).message} ${RERUN_HINT}`,
        );
      }
    }).not.toThrow();
  });

  it("assertParkedPromisesAreHonestlyParked DOES throw on a fabricated promise with no rule behind it (non-vacuity control)", () => {
    expect(() =>
      assertParkedPromisesAreHonestlyParked(
        REAL_FILES,
        { FABRICATED_PROMISING_CEILING: "it measures fidelity now and is promoted once its sibling clears" },
        {}, // no PARKED_FIDELITY_PROMISES entry behind the promise above
      ),
    ).toThrow(/carry a promotion promise.*with no PARKED_FIDELITY_PROMISES entry/);
  });

  it("buildCampaignReport(REAL_FILES, evidence) does not throw and returns at least one row", () => {
    let report: ReturnType<typeof buildCampaignReport>;
    try {
      report = buildCampaignReport(REAL_FILES, REAL_EVIDENCE);
    } catch (err) {
      throw new Error(
        `Live buildCampaignReport failed against the real tree -- this is exactly the shape of ` +
          `failure that killed the exit predicate four consecutive waves (w50/w53/w54/w56): ` +
          `${(err as Error).message} ${RERUN_HINT}`,
      );
    }
    expect(report.rows.length).toBeGreaterThan(0);
  });

  it("buildCampaignReport DOES throw when the real corpus is paired with a registry missing every real name (non-vacuity control)", () => {
    // A fabricated CampaignFile[] declaring one ceiling the real registries
    // do not know about -- proves buildCampaignReport is not vacuously
    // passing regardless of input.
    const fabricatedFiles: CampaignFile[] = [
      {
        path: "test/fabricated-fixture.scan.test.ts",
        content: "export const TOTALLY_FABRICATED_UNREGISTERED_CEILING = 3;\n",
      },
    ];
    expect(() => buildCampaignReport(fabricatedFiles, REAL_EVIDENCE)).toThrow(
      /neither graded.*nor excused/,
    );
  });
});
