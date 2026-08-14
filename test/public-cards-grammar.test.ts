// DEC-768/DEC-968 (wave 7 amendments): pins the two shared card-vocabulary
// rules src/routes/public/cards.tsx exports to every session/agenda/
// programme surface.
import { describe, expect, it } from "vitest";
import { formatDay, SpeakerNames } from "../src/routes/public/cards";

describe("task-w7-a: formatDay is the ONE public day grammar (DEC-768)", () => {
  it("renders a weekday-day-month label (en-GB long form), never the retired en-US 'Wed, May 12, 2027' shape", () => {
    const label = formatDay("2027-05-12");
    expect(label).toBe("Wednesday 12 May");
    expect(label).toMatch(/^[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+$/);
    expect(label).not.toContain(",");
  });
});

describe("task-w7-a: SpeakerNames renders bare names only (DEC-968 wave 7 amendment)", () => {
  it("never appends title/company parentheses on a session's speaker line", () => {
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
    expect(html).not.toContain("(");
    expect(html).not.toContain("Engineer");
    expect(html).not.toContain("Navy");
  });
});
