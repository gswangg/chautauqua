// DEC-696: /portal/edit's track fieldset must apply the SAME chq-cfp-option
// class vocabulary as the public CFP form's TrackChoices
// (src/routes/public/submit-views.tsx) — a render assertion so the two
// never drift back apart. Parity is about the option CHROME, not the input
// type or the caption: DEC-986 makes the public form single-select
// (radios, "Choose one.") while /portal/edit stays multi-select (checkboxes,
// "Choose all that apply.") because it edits an existing row that may
// already hold several tracks.
//
// DEC-951 retired the public CFP's "Tracks *" asterisk (the last asterisk
// marker in the product's optionality grammar, DEC-917) but was scoped to
// src/routes/public/submit-views.tsx only; DEC-986 finishes the job by
// dropping /portal/edit's own leftover "Tracks *" legend too, so both
// surfaces now read the identical bare "Tracks" legend.

import { describe, expect, it } from "vitest";
import { EditPage } from "../src/routes/portal/edit";
import { TrackChoices } from "../src/routes/public/submit-views";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";

const DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
  form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
  fields: [],
  answers: {},
  offeredTrackIds: ["t1", "t2"],
  allTracks: [
    { id: "t1", name: "Track One" },
    { id: "t2", name: "Track Two" },
  ],
  selectedTrackIds: ["t1"],
};

function extractOptionClasses(html: string): Set<string> {
  const classes = new Set<string>();
  for (const m of html.matchAll(/class="([^"]*chq-cfp-option[^"]*)"/g)) {
    for (const c of m[1]!.split(/\s+/)) classes.add(c);
  }
  return classes;
}

describe("track fieldset render parity (DEC-696)", () => {
  const editHtml = EditPage({
    branding: { eventName: "Event", welcomeMessage: null, accentColor: null, logoUrl: null },
    submissionId: "s1",
    data: DATA,
    answers: {},
    selectedTrackIds: ["t1"],
    csrfToken: "tok",
    editable: true,
    tracksEditable: true,
    participants: [],
    speakerName: "Speaker Name",
  }).toString();

  const submitHtml = TrackChoices({
    tracks: [{ id: "t1", name: "Track One" }],
    selected: ["t1"],
  }).toString();

  it("edit and submit pages use the same chq-cfp-option class vocabulary", () => {
    const editClasses = extractOptionClasses(editHtml);
    const submitClasses = extractOptionClasses(submitHtml);
    expect(editClasses.size).toBeGreaterThan(0);
    expect(editClasses).toEqual(submitClasses);
  });

  it("captions differ by design: edit stays multi-select, submit is single-select (DEC-986)", () => {
    expect(editHtml).toContain("Choose all that apply.");
    expect(submitHtml).toContain("Choose one.");
    expect(editHtml).not.toContain("Choose one.");
    expect(submitHtml).not.toContain("Choose all that apply.");
  });

  it("both surfaces' legends carry no asterisk (DEC-951/DEC-986 finish the optionality grammar)", () => {
    expect(submitHtml).toContain("<legend>Tracks</legend>");
    expect(editHtml).toContain("<legend>Tracks</legend>");
    expect(editHtml).not.toContain("Tracks *");
  });
});
