// Sessionboard import, layer 1 (DEC-612, DEC-613): auto-mapping + row
// planning core. Pure module, no DB.
import { describe, expect, it } from "vitest";
import {
  SESSIONBOARD_SOURCE,
  autoMapSessionboardColumns,
  externalRef,
  planSessionboardRows,
  SB_TARGET_FIELDS,
} from "../src/domain/sessionboard";

describe("externalRef", () => {
  it("namespaces the record id with the source, never a bare id", () => {
    expect(externalRef(SESSIONBOARD_SOURCE, "12345")).toBe("sessionboard:12345");
  });

  it("keeps two different sources from ever colliding", () => {
    expect(externalRef("sessionboard", "1")).not.toBe(externalRef("other_source", "1"));
  });
});

describe("autoMapSessionboardColumns", () => {
  it("matches contacts headers case/space/underscore-insensitively", () => {
    const header = ["Speaker Email", "First_Name", "  last name  ", "Record ID", "Company", "Job Title"];
    const mapping = autoMapSessionboardColumns("contacts", header);
    expect(mapping).toEqual({
      "Speaker Email": "email",
      First_Name: "firstName",
      "  last name  ": "lastName",
      "Record ID": "externalId",
      Company: "company",
      "Job Title": "title",
    });
  });

  it("matches submissions 'Session Title' -> title and 'Id' -> externalId", () => {
    const mapping = autoMapSessionboardColumns("submissions", ["Session Title", "Id", "Abstract"]);
    expect(mapping).toEqual({
      "Session Title": "title",
      Id: "externalId",
      Abstract: "description",
    });
  });

  it("leaves unmatched columns absent from the mapping", () => {
    const mapping = autoMapSessionboardColumns("tracks", ["Track Name", "Some Unknown Column"]);
    expect(mapping).toEqual({ "Track Name": "name" });
  });

  it("only ever maps to a field declared in SB_TARGET_FIELDS for that entity", () => {
    const mapping = autoMapSessionboardColumns("tracks", ["Track Name", "Track ID", "Color"]);
    for (const field of Object.values(mapping)) {
      expect(SB_TARGET_FIELDS.tracks).toContain(field);
    }
  });
});

describe("planSessionboardRows", () => {
  const header = ["Record ID", "Speaker Email", "First Name", "Company"];
  const mapping = autoMapSessionboardColumns("contacts", header);

  it("builds a plan per row with a namespaced externalRef", () => {
    const { plans, issues } = planSessionboardRows(
      "contacts",
      header,
      [["12345", "a@example.com", "Ada", "Acme"]],
      mapping,
    );
    expect(issues).toEqual([]);
    expect(plans).toEqual([
      {
        row: 2,
        externalRef: "sessionboard:12345",
        values: { email: "a@example.com", firstName: "Ada", company: "Acme" },
      },
    ]);
  });

  it("omits blank cells rather than writing '' (blank cell is absent data)", () => {
    const { plans } = planSessionboardRows(
      "contacts",
      header,
      [["12345", "a@example.com", "", "  "]],
      mapping,
    );
    expect(plans[0]!.values).toEqual({ email: "a@example.com" });
    expect(Object.prototype.hasOwnProperty.call(plans[0]!.values, "firstName")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(plans[0]!.values, "company")).toBe(false);
  });

  it("a row with no external id yields an ISSUE naming the row, never a silent skip", () => {
    const { plans, issues } = planSessionboardRows(
      "contacts",
      header,
      [["", "a@example.com", "Ada", "Acme"]],
      mapping,
    );
    expect(issues).toEqual([{ row: 2, field: "externalId", message: "Missing external id (Record ID)" }]);
    // still produces a plan entry (not a silent skip) so callers can see the
    // row was considered, just unresolvable.
    expect(plans).toEqual([
      { row: 2, externalRef: null, values: { email: "a@example.com", firstName: "Ada", company: "Acme" } },
    ]);
  });

  it("numbers rows against the CSV file, header counted as row 1 (first data row is row 2)", () => {
    const { plans, issues } = planSessionboardRows(
      "contacts",
      header,
      [
        ["1", "a@example.com", "Ada", "Acme"],
        ["", "b@example.com", "Bea", "Beta"],
        ["3", "c@example.com", "Cy", "Gamma"],
      ],
      mapping,
    );
    expect(plans.map((p) => p.row)).toEqual([2, 3, 4]);
    expect(issues).toEqual([{ row: 3, field: "externalId", message: "Missing external id (Record ID)" }]);
  });

  it("namespaces every plan's externalRef under SESSIONBOARD_SOURCE", () => {
    const { plans } = planSessionboardRows(
      "contacts",
      header,
      [["999", "a@example.com", "Ada", "Acme"]],
      mapping,
    );
    expect(plans[0]!.externalRef).toBe(`${SESSIONBOARD_SOURCE}:999`);
  });
});

describe("participants (DEC-639: no externalId of its own)", () => {
  it("has no externalId in SB_TARGET_FIELDS.participants", () => {
    expect(SB_TARGET_FIELDS.participants).not.toContain("externalId");
    expect(SB_TARGET_FIELDS.participants).toEqual([
      "sessionExternalId",
      "speakerExternalId",
      "speakerEmail",
      "role",
      "order",
    ]);
  });

  it("auto-maps session id / speaker id / speaker email / role / order headers", () => {
    const header = ["Session ID", "Speaker ID", "Speaker Email", "Role", "Order"];
    const mapping = autoMapSessionboardColumns("participants", header);
    expect(mapping).toEqual({
      "Session ID": "sessionExternalId",
      "Speaker ID": "speakerExternalId",
      "Speaker Email": "speakerEmail",
      Role: "role",
      Order: "order",
    });
  });

  it("never emits a 'Missing external id' issue; externalRef is always null", () => {
    const header = ["Session ID", "Speaker ID"];
    const mapping = autoMapSessionboardColumns("participants", header);
    const { plans, issues } = planSessionboardRows("participants", header, [["sb-sess-1", "sb-spk-1"]], mapping);
    expect(plans).toEqual([
      { row: 2, externalRef: null, values: { sessionExternalId: "sb-sess-1", speakerExternalId: "sb-spk-1" } },
    ]);
    expect(issues).toEqual([]);
  });

  it("raises an issue when sessionExternalId is absent", () => {
    const header = ["Session ID", "Speaker ID"];
    const mapping = autoMapSessionboardColumns("participants", header);
    const { issues } = planSessionboardRows("participants", header, [["", "sb-spk-1"]], mapping);
    expect(issues).toEqual([{ row: 2, field: "sessionExternalId", message: "Missing session external id" }]);
  });

  it("raises an issue when BOTH speakerExternalId and speakerEmail are absent", () => {
    const header = ["Session ID", "Speaker ID", "Speaker Email"];
    const mapping = autoMapSessionboardColumns("participants", header);
    const { issues } = planSessionboardRows("participants", header, [["sb-sess-1", "", ""]], mapping);
    expect(issues).toEqual([
      { row: 2, field: "speakerExternalId", message: "Missing speaker external id or speaker email" },
    ]);
  });

  it("does not raise the speaker issue when only speakerEmail is present", () => {
    const header = ["Session ID", "Speaker ID", "Speaker Email"];
    const mapping = autoMapSessionboardColumns("participants", header);
    const { issues } = planSessionboardRows("participants", header, [["sb-sess-1", "", "a@example.com"]], mapping);
    expect(issues).toEqual([]);
  });
});
