import { describe, expect, it } from "vitest";
import {
  assertSpeakerContactId,
  isOwnedByContact,
  speakerStatusLabel,
} from "../src/server/repo/portal";

describe("speakerStatusLabel", () => {
  it("collapses all three queue-ish statuses to 'Under review' — internal queue states must never leak", () => {
    expect(speakerStatusLabel("pending")).toBe("Under review");
    expect(speakerStatusLabel("accept_queue")).toBe("Under review");
    expect(speakerStatusLabel("decline_queue")).toBe("Under review");
  });

  it("maps the two decided statuses to speaker-friendly text", () => {
    expect(speakerStatusLabel("accepted")).toBe("Accepted");
    expect(speakerStatusLabel("declined")).toBe("Not accepted");
  });

  it("throws on an unknown status literal — fail loudly, no silent default", () => {
    expect(() => speakerStatusLabel("bogus" as any)).toThrow();
  });
});

describe("assertSpeakerContactId", () => {
  it("returns the contactId for a well-formed speaker auth", () => {
    expect(assertSpeakerContactId({ role: "speaker", contactId: "c1" })).toBe("c1");
  });

  it("throws when auth is undefined", () => {
    expect(() => assertSpeakerContactId(undefined)).toThrow();
  });

  it("throws when role isn't speaker", () => {
    expect(() => assertSpeakerContactId({ role: "organizer", contactId: "c1" })).toThrow();
  });

  it("throws when a speaker session is missing contactId — data corruption, fail loudly", () => {
    expect(() => assertSpeakerContactId({ role: "speaker" })).toThrow();
  });
});

describe("isOwnedByContact", () => {
  it("is true when the contactId is among the submission's participants", () => {
    expect(isOwnedByContact(["c1", "c2"], "c2")).toBe(true);
  });

  it("is false for a contactId not in the participant list — no IDOR", () => {
    expect(isOwnedByContact(["c1", "c2"], "c3")).toBe(false);
  });

  it("is false for an empty participant list", () => {
    expect(isOwnedByContact([], "c1")).toBe(false);
  });
});
