// DEC-768/DEC-968 (wave 7 amendments): pins the two shared card-vocabulary
// rules src/routes/public/cards.tsx exports to every session/agenda/
// programme surface.
import { describe, expect, it } from "vitest";
import { formatDay, SpeakerNames, speakerIdentityClause } from "../src/routes/public/cards";

describe("task-w7-a: formatDay is the ONE public day grammar (DEC-768)", () => {
  it("renders a weekday-day-month label (en-GB long form), never the retired en-US 'Wed, May 12, 2027' shape", () => {
    const label = formatDay("2027-05-12");
    expect(label).toBe("Wednesday 12 May");
    expect(label).toMatch(/^[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+$/);
    expect(label).not.toContain(",");
  });
});

describe("task-w8-a: speakerIdentityClause (DEC-968 wave 8 amendment)", () => {
  it("joins title and company with a comma when both are present", () => {
    expect(speakerIdentityClause("Engineer", "Acme")).toBe("Engineer, Acme");
  });
  it("renders the single fact when only title is present", () => {
    expect(speakerIdentityClause("Engineer", null)).toBe("Engineer");
  });
  it("renders the single fact when only company is present", () => {
    expect(speakerIdentityClause(null, "Navy")).toBe("Navy");
  });
  it("renders null when neither fact is present -- never a dangling comma", () => {
    expect(speakerIdentityClause(null, null)).toBeNull();
  });
});

describe("task-w8-a: SpeakerNames renders name + identity clause (DEC-968 wave 8 amendment, EMB-01/EMB-09)", () => {
  it("renders one .chq-pub-speaker-line per speaker, each carrying its identity clause", () => {
    const html = String(
      SpeakerNames({
        speakers: [
          { contactId: "sp1", firstName: "Ada", lastName: "Lovelace", title: "Engineer", company: "Acme", headshotUrl: null, bio: null },
          { contactId: "sp2", firstName: "Grace", lastName: "Hopper", title: null, company: "Navy", headshotUrl: null, bio: null },
        ] as any,
      }),
    );
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Grace Hopper");
    expect(html).toContain("Engineer, Acme");
    expect(html).toContain("Navy");
    expect(html.match(/chq-pub-speaker-line/g)?.length).toBe(2);
    expect(html.match(/chq-pub-speaker-identity/g)?.length).toBe(2);
  });

  it("omits the identity span entirely when neither fact is present", () => {
    const html = String(
      SpeakerNames({
        speakers: [
          { contactId: "sp1", firstName: "Rosalind", lastName: "Franklin", title: null, company: null, headshotUrl: null, bio: null },
        ] as any,
      }),
    );
    expect(html).toContain("Rosalind Franklin");
    expect(html).not.toContain("chq-pub-speaker-identity");
  });
});
