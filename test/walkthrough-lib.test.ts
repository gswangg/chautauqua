import { describe, expect, it } from "vitest";
import {
  WALKTHROUGH_AREAS,
  buildContactsMergeBody,
  buildReviewerAssignmentBody,
  buildSpawnArgs,
  dropdownCriterionExcludedFromAverage,
  duplicatePairStillOpen,
  eventFilesContainsUpload,
  findEventBySlug,
  formatAreaPass,
  formatFailureMessage,
  formatMissingModulesMessage,
  formatSummaryTable,
  hasExactFormatDropdownField,
  modulePath,
  parseUrlArg,
  queueItemHasSubmissionId,
  resolveTrackNames,
  userListItemHasId,
} from "../scripts/walkthrough-lib";

describe("WALKTHROUGH_AREAS", () => {
  it("is the fixed DEC-062/DEC-089 order: producer, review, speaker, public, data, scale", () => {
    expect(WALKTHROUGH_AREAS).toEqual(["producer", "review", "speaker", "public", "data", "scale"]);
  });
});

describe("modulePath", () => {
  it("builds the DEC-060 module path for each area", () => {
    expect(modulePath("producer")).toBe("scripts/walkthrough/producer.ts");
    expect(modulePath("review")).toBe("scripts/walkthrough/review.ts");
    expect(modulePath("speaker")).toBe("scripts/walkthrough/speaker.ts");
    expect(modulePath("public")).toBe("scripts/walkthrough/public.ts");
    expect(modulePath("data")).toBe("scripts/walkthrough/data.ts");
    expect(modulePath("scale")).toBe("scripts/walkthrough/scale.ts");
  });
});

describe("buildSpawnArgs", () => {
  it("builds tsx argv with --url", () => {
    expect(buildSpawnArgs("producer", "http://localhost:8787")).toEqual([
      "tsx",
      "scripts/walkthrough/producer.ts",
      "--url",
      "http://localhost:8787",
    ]);
  });

  it("passes an arbitrary url through unmodified", () => {
    expect(buildSpawnArgs("data", "http://example.test:1234")).toEqual([
      "tsx",
      "scripts/walkthrough/data.ts",
      "--url",
      "http://example.test:1234",
    ]);
  });
});

describe("parseUrlArg", () => {
  it("returns the default when --url is absent", () => {
    expect(parseUrlArg([], "http://localhost:8787")).toBe("http://localhost:8787");
  });

  it("parses --url <value>", () => {
    expect(parseUrlArg(["--url", "http://localhost:9999"], "http://localhost:8787")).toBe(
      "http://localhost:9999",
    );
  });

  it("throws when --url is given with no value", () => {
    expect(() => parseUrlArg(["--url"], "http://localhost:8787")).toThrow(/no value/);
  });
});

describe("formatAreaPass / formatFailureMessage / formatMissingModulesMessage", () => {
  it("formats a PASS line per area", () => {
    expect(formatAreaPass("review")).toBe("PASS review");
  });

  it("formats the required failure message", () => {
    expect(formatFailureMessage("speaker")).toBe("WALKTHROUGH FAILED at speaker");
  });

  it("formats a missing-module message naming the missing files", () => {
    expect(formatMissingModulesMessage(["scripts/walkthrough/producer.ts"])).toBe(
      "walkthrough: missing module file(s): scripts/walkthrough/producer.ts",
    );
    expect(
      formatMissingModulesMessage([
        "scripts/walkthrough/producer.ts",
        "scripts/walkthrough/data.ts",
      ]),
    ).toBe(
      "walkthrough: missing module file(s): scripts/walkthrough/producer.ts, scripts/walkthrough/data.ts",
    );
  });
});

describe("formatSummaryTable (DEC-407)", () => {
  it("renders an all-pass summary", () => {
    expect(
      formatSummaryTable([
        { area: "producer", status: "PASS" },
        { area: "review", status: "PASS" },
      ]),
    ).toBe("  PASS producer\n  PASS review");
  });

  it("renders a mix with one failure", () => {
    expect(
      formatSummaryTable([
        { area: "producer", status: "PASS" },
        { area: "review", status: "FAIL" },
        { area: "speaker", status: "PASS" },
      ]),
    ).toBe("  PASS producer\n  FAIL review\n  PASS speaker");
  });

  it("renders an all-fail summary", () => {
    expect(
      formatSummaryTable([
        { area: "producer", status: "FAIL" },
        { area: "review", status: "FAIL" },
      ]),
    ).toBe("  FAIL producer\n  FAIL review");
  });
});

describe("buildReviewerAssignmentBody (B1)", () => {
  it("builds a track-scoped assignment body", () => {
    expect(buildReviewerAssignmentBody("user1", { trackId: "track1" })).toEqual({
      userId: "user1",
      trackId: "track1",
    });
  });

  it("builds a per-submission assignment body", () => {
    expect(buildReviewerAssignmentBody("user1", { submissionId: "sub1" })).toEqual({
      userId: "user1",
      submissionId: "sub1",
    });
  });
});

describe("userListItemHasId (B1)", () => {
  it("accepts an item with a non-empty string id", () => {
    expect(userListItemHasId({ id: "u1", email: "a@b.test" })).toBe(true);
  });

  it("rejects items missing id, or with a non-string/empty id", () => {
    expect(userListItemHasId({ email: "a@b.test" })).toBe(false);
    expect(userListItemHasId({ id: 5 })).toBe(false);
    expect(userListItemHasId({ id: "" })).toBe(false);
    expect(userListItemHasId(null)).toBe(false);
  });
});

describe("queueItemHasSubmissionId (B2, DEC-239)", () => {
  it("accepts a shaped queue item with submissionId", () => {
    expect(queueItemHasSubmissionId({ submissionId: "sub1", ref: "T-1", title: "x" })).toBe(true);
  });

  it("rejects a raw SubmissionSummary-shaped item (id, not submissionId)", () => {
    expect(queueItemHasSubmissionId({ id: "sub1" })).toBe(false);
  });
});

describe("buildContactsMergeBody (B3)", () => {
  it("builds the merge request body", () => {
    expect(buildContactsMergeBody("keep1", "merge1")).toEqual({ keepId: "keep1", mergeIds: ["merge1"] });
  });
});

describe("duplicatePairStillOpen (B3)", () => {
  const groups = [
    { contactIds: ["c1", "c2"] },
    { contactIds: ["c3", "c4", "c5"] },
  ];

  it("finds a pair present in some group, regardless of order", () => {
    expect(duplicatePairStillOpen(groups, "c1", "c2")).toBe(true);
    expect(duplicatePairStillOpen(groups, "c2", "c1")).toBe(true);
    expect(duplicatePairStillOpen(groups, "c4", "c5")).toBe(true);
  });

  it("returns false once the pair is no longer grouped together (post-merge)", () => {
    expect(duplicatePairStillOpen(groups, "c1", "c3")).toBe(false);
    expect(duplicatePairStillOpen([], "c1", "c2")).toBe(false);
  });
});

describe("eventFilesContainsUpload (CNT-07)", () => {
  const files = [{ submissionId: "sub1", latestFileId: "file2" }];

  it("finds the just-uploaded file's chain by submission + latest file id", () => {
    expect(eventFilesContainsUpload(files, "sub1", "file2")).toBe(true);
  });

  it("does not match a stale (superseded) file id or wrong submission", () => {
    expect(eventFilesContainsUpload(files, "sub1", "file1")).toBe(false);
    expect(eventFilesContainsUpload(files, "sub2", "file2")).toBe(false);
  });
});

describe("resolveTrackNames (CFP-06, DEC-243)", () => {
  const tracks = [
    { id: "t1", name: "AI Engineering" },
    { id: "t2", name: "Platform & Infra" },
  ];

  it("maps known track ids to names, in order", () => {
    expect(resolveTrackNames(["t2", "t1"], tracks)).toEqual(["Platform & Infra", "AI Engineering"]);
  });

  it("falls back to the raw id for an unresolvable track", () => {
    expect(resolveTrackNames(["t9"], tracks)).toEqual(["t9"]);
  });

  it("returns an empty list for no track ids", () => {
    expect(resolveTrackNames([], tracks)).toEqual([]);
  });
});

describe("hasExactFormatDropdownField (CFP-06, DEC-243)", () => {
  it("matches a dropdown field labeled exactly 'Format' (case-insensitive)", () => {
    expect(hasExactFormatDropdownField([{ kind: "dropdown", label: "Format" }])).toBe(true);
    expect(hasExactFormatDropdownField([{ kind: "dropdown", label: "  format  " }])).toBe(true);
  });

  it("does not match a differently-labeled dropdown or a non-dropdown 'Format' field", () => {
    expect(hasExactFormatDropdownField([{ kind: "dropdown", label: "Session format" }])).toBe(false);
    expect(hasExactFormatDropdownField([{ kind: "text", label: "Format" }])).toBe(false);
    expect(hasExactFormatDropdownField([])).toBe(false);
  });
});

describe("dropdownCriterionExcludedFromAverage (ABS-10, DEC-241)", () => {
  it("is true when a criterion appears only in perDropdown", () => {
    expect(
      dropdownCriterionExcludedFromAverage(
        { perCriterion: { content_quality: 4 }, perDropdown: { length_fit: { counts: {}, modal: null } } },
        "length_fit",
      ),
    ).toBe(true);
  });

  it("is false if the dropdown criterion leaked into perCriterion", () => {
    expect(
      dropdownCriterionExcludedFromAverage(
        { perCriterion: { length_fit: 2 }, perDropdown: { length_fit: { counts: {}, modal: null } } },
        "length_fit",
      ),
    ).toBe(false);
  });

  it("is false if the criterion is absent from perDropdown entirely", () => {
    expect(
      dropdownCriterionExcludedFromAverage({ perCriterion: {}, perDropdown: {} }, "length_fit"),
    ).toBe(false);
  });
});

describe("findEventBySlug", () => {
  it("returns the item whose slug matches, regardless of list position", () => {
    const items = [
      { id: "e1", slug: "throwaway-2027" },
      { id: "e2", slug: "devflow-conf-2027" },
    ];
    expect(findEventBySlug(items, "devflow-conf-2027")).toEqual({ id: "e2", slug: "devflow-conf-2027" });
  });

  it("does not fall back to items[0] when the wanted slug is not first", () => {
    const items = [
      { id: "e1", slug: "zzz-later-start-date" },
      { id: "e2", slug: "devflow-conf-2027" },
    ];
    const found = findEventBySlug(items, "devflow-conf-2027");
    expect(found.id).not.toBe(items[0]!.id);
    expect(found.id).toBe("e2");
  });

  it("throws a loud error naming the wanted slug and the slugs actually seen when absent", () => {
    const items = [{ id: "e1", slug: "throwaway-2027" }];
    expect(() => findEventBySlug(items, "devflow-conf-2027")).toThrow(
      /devflow-conf-2027.*throwaway-2027/s,
    );
  });

  it("names '(none)' when the items array is empty", () => {
    expect(() => findEventBySlug([], "devflow-conf-2027")).toThrow(/\(none\)/);
  });
});
