// DEC-738/DEC-726 (task-w2-c): a contact's Labels ARE its customFields,
// formatted once, server-side -- supersedes DEC-712's derived
// participation-role query (deriveContactLabels/fetchContactLabels,
// deleted from src/server/repo/contacts/query.ts along with the batched
// `participant` fetch). Covers the one pure formatter, contactLabels.
//
// DEC-292 amendment (findings wave 5): the reserved-key set widened from
// the one travel_logistics key to three (dietary, travel_logistics,
// accessibility) -- contactLabels excludes all three.

import { describe, expect, it } from "vitest";
import { contactLabels, RESERVED_CUSTOM_FIELD_KEYS } from "../src/domain/contact-labels";

const { dietary: DIETARY_KEY, travel: TRAVEL_KEY, accessibility: ACCESSIBILITY_KEY } =
  RESERVED_CUSTOM_FIELD_KEYS;

describe("contactLabels (DEC-738/DEC-726)", () => {
  it("formats each entry as `key value`, in stable key order", () => {
    const out = contactLabels({ role: "speaker", tshirt: "L" });
    expect(out).toEqual(["role speaker", "tshirt L"]);
  });

  it("excludes the reserved travel_logistics key", () => {
    const out = contactLabels({ role: "speaker", [TRAVEL_KEY]: "Flight AA123, hotel booked" });
    expect(out).toEqual(["role speaker"]);
  });

  it("excludes all three reserved keys (dietary, travel, accessibility)", () => {
    const out = contactLabels({
      role: "speaker",
      [DIETARY_KEY]: "Vegan",
      [TRAVEL_KEY]: "Flight AA123, hotel booked",
      [ACCESSIBILITY_KEY]: "Wheelchair access",
    });
    expect(out).toEqual(["role speaker"]);
  });

  it("returns [] for an empty customFields map", () => {
    expect(contactLabels({})).toEqual([]);
  });

  it("returns [] when the only keys are the reserved keys", () => {
    expect(
      contactLabels({ [TRAVEL_KEY]: "some text", [DIETARY_KEY]: "Vegan", [ACCESSIBILITY_KEY]: "Wheelchair" }),
    ).toEqual([]);
  });
});
