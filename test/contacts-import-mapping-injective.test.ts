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
//
// DEC-663 (wave 34): validateImportMapping now also takes the raw `header`
// array and refuses at the door when a header NAME repeats and both
// occurrences are mapped to a (the same, necessarily -- `mapping` is keyed
// by name) non-empty target -- the case the column-target loop below can
// never see because `mapping` has already collapsed the duplicate name into
// one key by the time that loop runs.

import { describe, expect, it } from "vitest";
import { validateImportMapping } from "../src/domain/contacts-parts/import";

describe("validateImportMapping (DEC-478 amendment, wave 47: injective mapping)", () => {
  it("throws naming both columns and the shared standard-field target", () => {
    const mapping = { Email: "email", "E-mail": "email" };
    const header = Object.keys(mapping);
    expect(() => validateImportMapping(mapping, header)).toThrow(/Email/);
    try {
      validateImportMapping(mapping, header);
      expect.fail("expected validateImportMapping to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("Email");
      expect(message).toContain("E-mail");
      expect(message).toContain("email");
    }
  });

  it("throws naming both columns and the shared custom.<key> target, compared by full target string", () => {
    const mapping = { Talk: "custom.talkTitle", Session: "custom.talkTitle" };
    const header = Object.keys(mapping);
    try {
      validateImportMapping(mapping, header);
      expect.fail("expected validateImportMapping to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("Talk");
      expect(message).toContain("Session");
      expect(message).toContain("custom.talkTitle");
    }
  });

  it("does not confuse two DIFFERENT custom.<key> targets (distinct full target strings) with a collision", () => {
    const mapping = { Talk: "custom.talkTitle", Bio: "custom.bio", Notes: "custom.notes" };
    expect(() => validateImportMapping(mapping, Object.keys(mapping))).not.toThrow();
  });

  it("passes a mapping whose non-empty values are all distinct, including several distinct standard + custom targets", () => {
    const mapping = {
      Email: "email",
      First: "firstName",
      Last: "lastName",
      Company: "company",
      Title: "title",
      Phone: "phone",
      Bio: "bio",
      Track: "custom.track",
      Badge: "custom.badge",
    };
    expect(() => validateImportMapping(mapping, Object.keys(mapping))).not.toThrow();
  });

  it("ignores columns mapped to '' or left unmapped -- multiple skipped columns are never a collision", () => {
    const mapping = { Email: "email", Junk1: "", Junk2: "" };
    expect(() => validateImportMapping(mapping, Object.keys(mapping))).not.toThrow();
  });

  it("passes an empty mapping", () => {
    expect(() => validateImportMapping({}, [])).not.toThrow();
  });
});

describe("validateImportMapping (DEC-663, wave 34: duplicate header refusal)", () => {
  it("refuses two identically-headed columns both mapped to the same target, naming both 1-based positions", () => {
    const header = ["Name", "Email", "Company", "Email", "Phone"];
    const mapping = { Name: "firstName", Email: "email", Company: "company", Phone: "phone" };
    try {
      validateImportMapping(mapping, header);
      expect.fail("expected validateImportMapping to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("2");
      expect(message).toContain("4");
      expect(message).toContain("Email");
      expect(message).toContain("email");
    }
  });

  // Note (w34-e, narrowest interpretation): `mapping` is keyed by header
  // NAME (unchanged by this task -- DEC-663's own zero-based-INDEX-key
  // ruling is a separate, larger change not in this slice), so two columns
  // sharing a name necessarily share ONE mapping entry -- there is no way
  // for "only one" of two identically-named columns to be mapped while the
  // other is not; mapping[name] is either set (both count as mapped, tested
  // above) or unset/"" (both count as skipped, tested below). This case
  // instead proves the duplicate-but-unmapped column never collaterally
  // blocks an unrelated, distinctly-named column that IS mapped.
  it("does not refuse a duplicated-but-unmapped header alongside a distinct, mapped column", () => {
    const header = ["Name", "Email", "Email", "Email2"];
    const mapping = { Name: "firstName", Email2: "email" };
    expect(() => validateImportMapping(mapping, header)).not.toThrow();
  });

  it("does not refuse a duplicated header mapped to '' (both copies skipped)", () => {
    const header = ["Name", "Email", "Notes", "Notes"];
    const mapping = { Name: "firstName", Email: "email", Notes: "" };
    expect(() => validateImportMapping(mapping, header)).not.toThrow();
  });

  it("does not refuse a duplicated header that is entirely unmapped", () => {
    const header = ["Name", "Email", "Junk", "Junk"];
    const mapping = { Name: "firstName", Email: "email" };
    expect(() => validateImportMapping(mapping, header)).not.toThrow();
  });

  it("still refuses two DIFFERENTLY-named columns mapped to the same target (pre-existing target-collision case, unchanged)", () => {
    const header = ["Email", "E-mail"];
    const mapping = { Email: "email", "E-mail": "email" };
    try {
      validateImportMapping(mapping, header);
      expect.fail("expected validateImportMapping to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("Email");
      expect(message).toContain("E-mail");
      expect(message).toContain("email");
      expect(message).not.toMatch(/^Columns \d/); // target-collision message, not the position-based one
    }
  });
});
