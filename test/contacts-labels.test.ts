// DEC-738/DEC-726 (task-w2-c): a contact's Labels ARE its customFields,
// formatted once, server-side -- supersedes DEC-712's derived
// participation-role query (deriveContactLabels/fetchContactLabels,
// deleted from src/server/repo/contacts/query.ts along with the batched
// `participant` fetch). Covers the one pure formatter, contactLabels.

import { describe, expect, it } from "vitest";
import { contactLabels, TRAVEL_KEY } from "../src/domain/contact-labels";

describe("contactLabels (DEC-738/DEC-726)", () => {
  it("formats each entry as `key value`, in stable key order", () => {
    const out = contactLabels({ role: "speaker", tshirt: "L" });
    expect(out).toEqual(["role speaker", "tshirt L"]);
  });

  it("excludes the reserved travel_logistics key", () => {
    const out = contactLabels({ role: "speaker", [TRAVEL_KEY]: "Flight AA123, hotel booked" });
    expect(out).toEqual(["role speaker"]);
  });

  it("returns [] for an empty customFields map", () => {
    expect(contactLabels({})).toEqual([]);
  });

  it("returns [] when the only key is the reserved travel key", () => {
    expect(contactLabels({ [TRAVEL_KEY]: "some text" })).toEqual([]);
  });
});
