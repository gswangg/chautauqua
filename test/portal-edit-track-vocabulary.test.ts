// DEC-696: /portal/edit's track fieldset must apply the SAME chq-cfp-option
// class vocabulary and the same "Tracks *" / "Choose all that apply" copy
// as the public CFP form's TrackChoices (src/routes/public/submit-views.tsx)
// — a render assertion so the two never drift back apart.

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

  it("edit and submit pages use the same legend and caption copy", () => {
    for (const html of [editHtml, submitHtml]) {
      expect(html).toContain("Tracks *");
      expect(html).toContain("Choose all that apply.");
    }
  });
});
