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
    // Walk test/ for *-probe.test.ts files, then keep only the ones that
    // actually carry a numeric third argument to an it()/test() call --
    // i.e. a measured per-test timeout, per the DEC-069 wave-25 policy.
    const probeFiles = globSync("test/**/*-probe.test.ts", { cwd: ROOT });
    expect(probeFiles.length).toBeGreaterThan(0);

    // Matches a per-test timeout: a `}, <digits>);` closing an it()/test()
    // call body, immediately preceded (anywhere earlier in the file) by the
    // DEC-069 wave-25 receipt comment naming a measured millisecond count.
    // Both signals must be present -- a bare numeric literal alone (e.g.
    // `expect(res.status).toBe(403)`) is common in these files and must not
    // count as a per-test timeout.
    const RECEIPT_RE = /\/\/ DEC-069 wave-25: measured \d+ms at [0-9a-f]{7,40} \(default 5000\)/;
    const THIRD_ARG_TIMEOUT_RE = /\}\s*,\s*\d+\s*\)\s*;/;

    const withMeasuredTimeout = probeFiles.filter((rel) => {
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
