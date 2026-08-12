// DEC-583/DEC-518 enumeration tripwire: DEMO_IDENTITIES is hand-copied from
// docs/fixtures/sample-data.json's `identities` block (organizer, reviewer,
// speaker only -- speaker2 has no demo button). This test reads the fixture
// from disk and asserts equality in BOTH directions, so a fixture edit that
// isn't mirrored into src/lib/demo-identities.ts fails the build, and so
// does an accidental extra identity added to the module.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEMO_IDENTITIES, type DemoIdentity } from "../src/lib/demo-identities";

const REPO_ROOT = resolve(__dirname, "..");

const fixture = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "docs/fixtures/sample-data.json"), "utf-8"),
) as {
  identities: Record<string, { email: string; password: string }>;
};

const DEMO_ROLES = ["organizer", "reviewer", "speaker"] as const;

describe("DEMO_IDENTITIES matches docs/fixtures/sample-data.json identities", () => {
  it("has exactly one entry per demo role (organizer, reviewer, speaker)", () => {
    expect(DEMO_IDENTITIES.map((i) => i.role).sort()).toEqual([...DEMO_ROLES].sort());
  });

  it("every fixture demo identity (organizer/reviewer/speaker) is present with matching email+password", () => {
    for (const role of DEMO_ROLES) {
      const fixtureIdentity = fixture.identities[role];
      expect(fixtureIdentity, `fixture is missing identities.${role}`).toBeDefined();
      const demo = DEMO_IDENTITIES.find((i) => i.role === role);
      expect(demo, `DEMO_IDENTITIES is missing role "${role}"`).toBeDefined();
      expect(demo!.email).toBe(fixtureIdentity!.email);
      expect(demo!.password).toBe(fixtureIdentity!.password);
    }
  });

  it("every DEMO_IDENTITIES entry exists in the fixture with the same email+password (no ghost/stale entries)", () => {
    for (const demo of DEMO_IDENTITIES) {
      const fixtureIdentity = fixture.identities[demo.role] as
        | { email: string; password: string }
        | undefined;
      expect(fixtureIdentity, `DEMO_IDENTITIES has role "${demo.role}" not present in the fixture`).toBeDefined();
      expect(demo.email).toBe(fixtureIdentity!.email);
      expect(demo.password).toBe(fixtureIdentity!.password);
    }
  });

  it("labels follow the 'Use demo <role>' convention", () => {
    for (const demo of DEMO_IDENTITIES) {
      expect(demo.label).toBe(`Use demo ${demo.role}`);
    }
  });

  it("has no duplicate roles or emails", () => {
    const roles = DEMO_IDENTITIES.map((i: DemoIdentity) => i.role);
    const emails = DEMO_IDENTITIES.map((i: DemoIdentity) => i.email);
    expect(new Set(roles).size).toBe(roles.length);
    expect(new Set(emails).size).toBe(emails.length);
  });
});
