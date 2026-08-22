import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "tinyglobby";

// DEC-069 wave-25 amendment: a global `testTimeout` raise disarms hang
// detection for the whole suite (~16,880 tests) to rescue a handful of slow
// probes. The fix is per-test (`it(name, fn, ms)` with a measured receipt
// comment immediately above it), never a config-level default. This scan
// enforces both halves of that: (1) neither shared vitest config declares a
// global testTimeout, and (2) the population of measured per-test timeouts
// this policy depends on is non-empty, i.e. the fix actually landed
// somewhere and this isn't grading a vacuous population.

const ROOT = resolve(__dirname, "..");

const TESTTIMEOUT_RE = /testTimeout/;

describe("suite timeout policy (DEC-069 wave-25 amendment)", () => {
  it("neither vitest.config.ts nor vitest.fast.config.ts declares a global testTimeout", () => {
    // Synthetic positive control: prove the regex actually fires on a
    // fabricated config string, so a typo in TESTTIMEOUT_RE can't make this
    // assertion pass vacuously.
    const FABRICATED_CONFIG = `
      export default defineConfig({
        test: { testTimeout: 30000 },
      });
    `;
    expect(TESTTIMEOUT_RE.test(FABRICATED_CONFIG)).toBe(true);

    const configFiles = ["vitest.config.ts", "vitest.fast.config.ts"];
    const offenders: string[] = [];
    for (const rel of configFiles) {
      const source = readFileSync(resolve(ROOT, rel), "utf8");
      if (TESTTIMEOUT_RE.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("the population of measured per-test timeout probes is not zero", () => {
    // DEC-727 wave-17 amendment: the population isn't limited to
    // *-probe.test.ts -- a whole-corpus scan (app/src/css-contract.scan,
    // test/fixed-table-column-hack.scan, test/files-library) is a
    // first-class member too. Walk the whole test/ and app/src/ trees.
    const candidateFiles = [
      ...globSync("test/**/*.test.ts", { cwd: ROOT }),
      ...globSync("app/src/**/*.test.ts", { cwd: ROOT }),
    ];
    expect(candidateFiles.length).toBeGreaterThan(0);

    // Matches a per-test timeout: a `}, <digits>);` closing an it()/test()
    // call body, immediately preceded (anywhere earlier in the file) by the
    // DEC-069 wave-25 receipt comment naming a measured millisecond count.
    // Both signals must be present -- a bare numeric literal alone (e.g.
    // `expect(res.status).toBe(403)`) is common in these files and must not
    // count as a per-test timeout.
    const RECEIPT_RE = /\/\/ DEC-069 wave-25: measured \d+ms at [0-9a-f]{7,40} \(default 5000\)/;
    const THIRD_ARG_TIMEOUT_RE = /\}\s*,\s*\d+\s*\)\s*;/;

    // Synthetic positive control: a fabricated source string carrying both
    // signals must count.
    const FABRICATED_WITH_TIMEOUT = `
      // DEC-069 wave-25: measured 9999ms at 0123456 (default 5000)
      it("slow thing", () => {
        expect(true).toBe(true);
      }, 20000);
    `;
    expect(
      RECEIPT_RE.test(FABRICATED_WITH_TIMEOUT) && THIRD_ARG_TIMEOUT_RE.test(FABRICATED_WITH_TIMEOUT),
    ).toBe(true);

    // Synthetic negative control: a fabricated source string carrying the
    // receipt comment but NO third-argument timeout must NOT count -- a
    // stray receipt comment (e.g. left behind after a refactor) is not
    // itself evidence of a per-test timeout.
    const FABRICATED_RECEIPT_ONLY = `
      // DEC-069 wave-25: measured 9999ms at 0123456 (default 5000)
      it("slow thing", () => {
        expect(true).toBe(true);
      });
    `;
    expect(
      RECEIPT_RE.test(FABRICATED_RECEIPT_ONLY) && THIRD_ARG_TIMEOUT_RE.test(FABRICATED_RECEIPT_ONLY),
    ).toBe(false);

    const withMeasuredTimeout = candidateFiles.filter((rel) => {
      const source = readFileSync(resolve(ROOT, rel), "utf8");
      return RECEIPT_RE.test(source) && THIRD_ARG_TIMEOUT_RE.test(source);
    });

    expect(withMeasuredTimeout.length).toBeGreaterThan(0);

    for (const rel of withMeasuredTimeout) {
      const source = readFileSync(resolve(ROOT, rel), "utf8");
      expect(source.length).toBeGreaterThan(0);
    }
  });
});
