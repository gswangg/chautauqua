// DEC-478 (amendment, wave 47): an import column mapping is INJECTIVE -- no
// two CSV columns may target the same destination field. mapImportRow
// (src/domain/contacts-parts/import.ts) walks the header left to right and
// assigns by plain assignment, so a mapping with two columns pointed at one
// destination silently keeps the RIGHTMOST value and drops the other --
// last-write-wins, the silent fallback the house rule forbids, and
// invisible in the preview because the preview runs the same fold.
// validateImportMapping is the ONE pure-core place this rule lives, called
// from both the server door (src/routes/api/contacts/import.ts) and the
// SPA's mapping step (app/src/pages/contacts/ImportWizard.tsx).

import { describe, expect, it } from "vitest";
import { validateImportMapping } from "../src/domain/contacts-parts/import";

describe("validateImportMapping (DEC-478 amendment, wave 47: injective mapping)", () => {
  it("throws naming both columns and the shared standard-field target", () => {
    expect(() => validateImportMapping({ Email: "email", "E-mail": "email" })).toThrow(/Email/);
    try {
      validateImportMapping({ Email: "email", "E-mail": "email" });
      expect.fail("expected validateImportMapping to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("Email");
      expect(message).toContain("E-mail");
      expect(message).toContain("email");
    }
  });

  it("throws naming both columns and the shared custom.<key> target, compared by full target string", () => {
    try {
      validateImportMapping({ Talk: "custom.talkTitle", Session: "custom.talkTitle" });
      expect.fail("expected validateImportMapping to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("Talk");
      expect(message).toContain("Session");
      expect(message).toContain("custom.talkTitle");
    }
  });

  it("does not confuse two DIFFERENT custom.<key> targets (distinct full target strings) with a collision", () => {
    expect(() =>
      validateImportMapping({ Talk: "custom.talkTitle", Bio: "custom.bio", Notes: "custom.notes" }),
    ).not.toThrow();
  });

  it("passes a mapping whose non-empty values are all distinct, including several distinct standard + custom targets", () => {
    expect(() =>
      validateImportMapping({
        Email: "email",
        First: "firstName",
        Last: "lastName",
        Company: "company",
        Title: "title",
        Phone: "phone",
        Bio: "bio",
        Track: "custom.track",
        Badge: "custom.badge",
      }),
    ).not.toThrow();
  });

  it("ignores columns mapped to '' or left unmapped -- multiple skipped columns are never a collision", () => {
    expect(() => validateImportMapping({ Email: "email", Junk1: "", Junk2: "" })).not.toThrow();
  });

  it("passes an empty mapping", () => {
    expect(() => validateImportMapping({})).not.toThrow();
  });
});
