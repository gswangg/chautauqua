import { defineConfig } from "vitest/config";

// Fast tier (DEC-727, eval-findings 72/73): node-only, no jsdom, no
// wrangler/miniflare/playwright imports. Tier membership is NOT hand-listed
// here -- test/test-tiers.test.ts recomputes the FAST/SLOW predicate from
// vitest.config.ts's environmentMatchGlobs plus each file's own imports and
// asserts this include list matches it exactly. If you add a slow test,
// that check (not this file) is what should fail.
//
// This config intentionally has NO environmentMatchGlobs: every file it
// selects must already run correctly under plain "node".
export default defineConfig({
  test: {
    // DEC-797: same global DOM-cleanup setup file as vitest.config.ts. This
    // tier is node-only and never selects a jsdom-environment file, so the
    // setup file's `typeof document !== 'undefined'` guard is always false
    // here -- it's a no-op, kept only so every project points at the one
    // setup file rather than some projects silently opting out.
    setupFiles: ["app/src/test-setup.ts"],
    // Unlike vitest.config.ts (mandate item 72/73's machine-protection cap
    // for the jsdom/wrangler-heavy full suite), this tier is plain-node
    // unit tests only -- no multi-GB jsdom/miniflare workers -- so it is
    // left at vitest's default worker count to stay well under 60s.
    environment: "node",
    pool: "threads",
    include: [
      "test/**/*.test.ts",
      "app/src/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "app/src/lib/useEscapeKey.test.ts",
      "test/itinerary-script-persistence.test.ts",
      "test/embed-element.test.ts",
      "test/gate4-residue-closure.test.ts",
    ],
  },
});
