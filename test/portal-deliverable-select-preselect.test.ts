// DEC-891 amendment: the portal deliverable picker must remember which
// candidate session an upload actually belongs to across an SSR reload — an
// unmarked <select> always renders its first <option> as chosen, so a
// speaker who uploaded against a later-seq session would be silently
// re-pointed at the wrong one on their next upload, forking the DEC-573
// version chain onto the wrong session.
//
// Regression for src/routes/portal/tasks/views.tsx:112 DeliverableSelect,
// which used to emit every <option> with no `selected` at all.

import { describe, expect, it } from "vitest";
import { DeliverableSelect, type DeliverableChoiceInfo } from "../src/routes/portal/tasks/views";
import type { DeliverableCandidate } from "../src/server/repo/portal/tasks";

function candidate(id: string, seq: number): DeliverableCandidate {
  return { id, ref: `SES-${String(seq).padStart(3, "0")}`, title: `Session ${seq}`, status: "accepted", seq };
}

function countSelected(html: string): number {
  return (html.match(/ selected(?:=|[\s>])/g) ?? []).length;
}

describe("DeliverableSelect preselection (DEC-891 amendment)", () => {
  it("renders no control at all for fewer than 2 candidates (conditional-and-quiet)", () => {
    const info: DeliverableChoiceInfo = {
      candidates: [candidate("ses-1", 1)],
      linkedFilenames: new Map([["ses-1", null]]),
    };
    const html = DeliverableSelect({ info });
    expect(html).toBeNull();
  });

  it("a fresh assignment (no linked files anywhere) preselects nothing and carries the disabled placeholder", () => {
    const info: DeliverableChoiceInfo = {
      candidates: [candidate("ses-1", 1), candidate("ses-32", 32)],
      linkedFilenames: new Map([
        ["ses-1", null],
        ["ses-32", null],
      ]),
    };
    const html = String(DeliverableSelect({ info }));
    expect(html).toContain('<option value="" selected="" disabled="">');
    expect(html).toContain("Choose a session");
    expect(countSelected(html)).toBe(1);
  });

  it("preselects the single candidate that already has a linked file", () => {
    const info: DeliverableChoiceInfo = {
      candidates: [candidate("ses-1", 1), candidate("ses-32", 32)],
      linkedFilenames: new Map([
        ["ses-1", null],
        ["ses-32", "slides.pdf"],
      ]),
    };
    const html = String(DeliverableSelect({ info }));
    expect(html).not.toContain('value="" selected="" disabled=""');
    expect(countSelected(html)).toBe(1);
    // The selected attribute must land on the ses-32 <option>, not ses-1.
    const optionMatch = html.match(/<option value="ses-32"[^>]*selected[^>]*>/);
    expect(optionMatch, "expected ses-32's option to carry `selected`").not.toBeNull();
    expect(html).not.toMatch(/<option value="ses-1"[^>]*selected[^>]*>/);
  });

  it("with several linked candidates, preselects the one whose linked filename matches the assignment's current file", () => {
    const info: DeliverableChoiceInfo = {
      candidates: [candidate("ses-1", 1), candidate("ses-32", 32), candidate("ses-40", 40)],
      linkedFilenames: new Map([
        ["ses-1", "handout.pdf"],
        ["ses-32", "slides.pdf"],
        ["ses-40", "other.pdf"],
      ]),
    };
    const html = String(DeliverableSelect({ info, currentFilename: "slides.pdf" }));
    expect(countSelected(html)).toBe(1);
    expect(html).toMatch(/<option value="ses-32"[^>]*selected[^>]*>/);
    expect(html).not.toContain('value="" selected="" disabled=""');
  });

  it("falls through to the placeholder when several are linked but the match is not derivable", () => {
    const info: DeliverableChoiceInfo = {
      candidates: [candidate("ses-1", 1), candidate("ses-32", 32)],
      linkedFilenames: new Map([
        ["ses-1", "handout.pdf"],
        ["ses-32", "slides.pdf"],
      ]),
    };
    // No currentFilename supplied at all — nothing to match against.
    const noCurrent = String(DeliverableSelect({ info }));
    expect(noCurrent).toContain('<option value="" selected="" disabled="">');
    expect(countSelected(noCurrent)).toBe(1);

    // currentFilename supplied but matches none of the linked candidates.
    const noMatch = String(DeliverableSelect({ info, currentFilename: "unrelated.pdf" }));
    expect(noMatch).toContain('<option value="" selected="" disabled="">');
    expect(countSelected(noMatch)).toBe(1);
  });

  it("never emits more than one selected option across a larger candidate set", () => {
    const info: DeliverableChoiceInfo = {
      candidates: [candidate("ses-1", 1), candidate("ses-2", 2), candidate("ses-3", 3), candidate("ses-4", 4)],
      linkedFilenames: new Map([
        ["ses-1", null],
        ["ses-2", "a.pdf"],
        ["ses-3", null],
        ["ses-4", null],
      ]),
    };
    const html = String(DeliverableSelect({ info }));
    expect(countSelected(html)).toBe(1);
    expect(html).toMatch(/<option value="ses-2"[^>]*selected[^>]*>/);
  });
});
