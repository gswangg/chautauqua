// DEC-663 (wave-30 amendment): two CSV columns sharing a header text
// collapse to one key in the mapping object (Record<string,string> can only
// have one "Email" key), so validateImportMapping's injectivity check --
// which runs on that already-collapsed mapping -- cannot see the collision.
// mapImportRow's left-to-right assignment loop then keeps whichever
// duplicate column is rightmost; when that one is blank the row returns {}
// and is silently counted as "no email, skipped" with no receipt naming the
// column that was actually discarded. validateHeaderMappingInjectivity
// (called from mapImportRow) fixes this by detecting duplicate header text
// against the raw header array (which still has both positions) and
// refusing loudly, naming every colliding position.

import { describe, expect, it } from "vitest";
import { mapImportRow, validateHeaderMappingInjectivity } from "../src/domain/contacts-parts/import";

describe("validateHeaderMappingInjectivity (DEC-663 wave-30 amendment)", () => {
  it("(a) two 'Email' columns mapped to email: refuses, naming both one-based positions, the header, and the target", () => {
    const header = ["Name", "Email", "Company", "Email"];
    const mapping = { Name: "firstName", Email: "email", Company: "company" };
    try {
      validateHeaderMappingInjectivity(mapping, header);
      expect.fail("expected validateHeaderMappingInjectivity to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("2");
      expect(message).toContain("4");
      expect(message).toContain("Email");
      expect(message).toContain("email");
    }
  });

  it("(b) previously broken: two 'Email' columns, second blank, first has a real address -- no longer silently yields {} with no receipt", () => {
    const header = ["Name", "Email", "Email"];
    const mapping = { Name: "firstName", Email: "email" };
    const row = ["Ada Lovelace", "ada@example.com", ""];

    // The old behaviour (pre-fix) was: mapImportRow(mapping, header, row)
    // returns {} silently, with nothing naming which column was dropped.
    // The fixed behaviour refuses loudly instead of ever reaching {}.
    expect(() => mapImportRow(mapping, header, row)).toThrow();
    try {
      mapImportRow(mapping, header, row);
      expect.fail("expected mapImportRow to throw, not silently return {}");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("Email");
      expect(message).toContain("2");
      expect(message).toContain("3");
    }
  });

  it("(c) three-way duplicate headers behave the same as two: refuses naming all three positions", () => {
    const header = ["Email", "Email", "Company", "Email"];
    const mapping = { Email: "email", Company: "company" };
    try {
      validateHeaderMappingInjectivity(mapping, header);
      expect.fail("expected validateHeaderMappingInjectivity to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain("1");
      expect(message).toContain("2");
      expect(message).toContain("4");
    }
  });

  it("(d) regression: all-distinct headers map exactly as before, byte-for-byte, and a legitimately skipped column is still skipped", () => {
    const header = ["Email", "First", "Junk", "Company"];
    const mapping = { Email: "email", First: "firstName", Junk: "", Company: "company" };
    const row = ["ada@example.com", "Ada", "ignore-me", "Analytical Engines"];

    expect(() => validateHeaderMappingInjectivity(mapping, header)).not.toThrow();
    expect(mapImportRow(mapping, header, row)).toEqual({
      email: "ada@example.com",
      firstName: "Ada",
      company: "Analytical Engines",
    });
  });

  it("duplicate headers that are BOTH skipped (mapped to '' or unmapped) are not a collision -- nothing is chosen from either", () => {
    const header = ["Email", "Junk", "Junk"];
    const mapping = { Email: "email", Junk: "" };
    const row = ["ada@example.com", "a", "b"];

    expect(() => validateHeaderMappingInjectivity(mapping, header)).not.toThrow();
    expect(mapImportRow(mapping, header, row)).toEqual({ email: "ada@example.com" });
  });
});
