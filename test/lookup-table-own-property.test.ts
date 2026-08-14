// Wave-39 (DEC-020 amendment): closes the own-property lookup family that
// wave 38 opened in src/domain/files.ts (test/files-allowlist-prototype.test.ts
// owns that site — untouched here). Four more module-level object literals
// were read with `map[key] ?? fallback`, which for a prototype-chain key
// (constructor, __proto__, toString, hasOwnProperty) returns a function/
// object instead of falling through to the documented fallback. Each site
// below now routes through an own-property reader
// (Object.prototype.hasOwnProperty.call(map, key) ? map[key]! : null),
// matching src/domain/files.ts's allowedContentType shape.

import { describe, expect, it } from "vitest";
import {
  blockFieldsInTemplate,
  MergeFieldError,
  missingMergeFields,
  renderTemplate,
  templateUsesMergeField,
} from "../src/mail/render";
import { lookupFormTaskFieldSpecs } from "../src/server/repo/submissions/status";
import { mergedInviteStatus } from "../src/domain/contacts";
import {
  LOCKED_SESSION_LABELS_FOR_TEST,
  LOCKED_SPEAKER_LABELS_FOR_TEST,
  LOCKED_SPEAKER_KIND_FOR_TEST,
  ownPropertyForTest,
} from "../src/server/repo/forms";

const PROTO_KEYS = ["constructor", "__proto__", "toString", "hasOwnProperty"] as const;

describe("lookup-table own-property family (DEC-020 amendment, wave 39)", () => {
  describe("site 1: src/mail/render.ts canonicalMergeField (MERGE_FIELD_ALIASES)", () => {
    it.each(PROTO_KEYS)(
      "renderTemplate throws MergeFieldError naming {%s} unchanged (unknown merge field), not a resolved alias",
      (key) => {
        expect(() => renderTemplate(`{${key}}`, {})).toThrow(MergeFieldError);
        try {
          renderTemplate(`{${key}}`, {});
          throw new Error("expected throw");
        } catch (err) {
          expect(err).toBeInstanceOf(MergeFieldError);
          expect((err as MergeFieldError).field).toBe(key);
        }
      },
    );

    it.each(PROTO_KEYS)("missingMergeFields lists {%s} as missing, unresolved", (key) => {
      expect(missingMergeFields(`{${key}}`, {})).toEqual([key]);
    });

    it.each(PROTO_KEYS)("blockFieldsInTemplate reports nothing for {%s} (not a recognized block field)", (key) => {
      expect(blockFieldsInTemplate(`{${key}}`)).toEqual([]);
    });

    it.each(PROTO_KEYS)("templateUsesMergeField never reports true for {%s} against any real field", (key) => {
      expect(templateUsesMergeField(`{${key}}`, "portal_link")).toBe(false);
      expect(templateUsesMergeField(`{${key}}`, "task_due_date")).toBe(false);
    });

    it("positive control: the real due_date alias still resolves to task_due_date", () => {
      expect(renderTemplate("{due_date}", { task_due_date: "14 Mar" })).toBe("14 Mar");
      expect(missingMergeFields("{due_date}", {})).toEqual(["due_date"]);
      expect(templateUsesMergeField("{due_date}", "task_due_date")).toBe(true);
    });
  });

  describe("site 2: src/server/repo/submissions/status.ts lookupFormTaskFieldSpecs (FORM_TASK_FIELD_SPECS)", () => {
    it.each(PROTO_KEYS)("returns [] for a form-task title of '%s'", (key) => {
      expect(lookupFormTaskFieldSpecs(key)).toEqual([]);
    });

    it("positive control: a real form-task title returns its specs", () => {
      const specs = lookupFormTaskFieldSpecs("Hotel stay requirement form");
      expect(specs.length).toBeGreaterThan(0);
      expect(specs[0]!.section).toBe("speaker");
    });
  });

  describe("site 3: src/domain/contacts.ts mergedInviteStatus (INVITE_STATUS_RANK)", () => {
    it.each(PROTO_KEYS)("a '%s' status never displaces a real known status (ranks below 'none')", (key) => {
      // key vs a known status: known status always wins, both orders.
      expect(mergedInviteStatus(key, "invited")).toBe("invited");
      expect(mergedInviteStatus("invited", key)).toBe("invited");
      expect(mergedInviteStatus(key, "none")).toBe("none");
      expect(mergedInviteStatus("none", key)).toBe("none");
    });

    it.each(PROTO_KEYS)("two unrecognized '%s' statuses tie and keep `a`", (key) => {
      expect(mergedInviteStatus(key, key)).toBe(key);
    });

    it("positive control: accepted beats declined/invited/none, both orders", () => {
      expect(mergedInviteStatus("accepted", "declined")).toBe("accepted");
      expect(mergedInviteStatus("declined", "accepted")).toBe("accepted");
      expect(mergedInviteStatus("invited", "none")).toBe("invited");
    });
  });

  describe("site 4: src/server/repo/forms.ts LOCKED_SESSION_LABELS / LOCKED_SPEAKER_LABELS / LOCKED_SPEAKER_KIND", () => {
    it.each(PROTO_KEYS)("LOCKED_SESSION_LABELS['%s'] is absent (own-property lookup returns null)", (key) => {
      expect(ownPropertyForTest(LOCKED_SESSION_LABELS_FOR_TEST, key)).toBeNull();
    });

    it.each(PROTO_KEYS)("LOCKED_SPEAKER_LABELS['%s'] is absent (own-property lookup returns null)", (key) => {
      expect(ownPropertyForTest(LOCKED_SPEAKER_LABELS_FOR_TEST, key)).toBeNull();
    });

    it.each(PROTO_KEYS)("LOCKED_SPEAKER_KIND['%s'] is absent (own-property lookup returns null)", (key) => {
      expect(ownPropertyForTest(LOCKED_SPEAKER_KIND_FOR_TEST, key)).toBeNull();
    });

    it("positive control: real locked field ids resolve to their documented label/kind", () => {
      expect(ownPropertyForTest(LOCKED_SESSION_LABELS_FOR_TEST, "title")).toBe("Title");
      expect(ownPropertyForTest(LOCKED_SPEAKER_LABELS_FOR_TEST, "email")).toBe("Email");
      expect(ownPropertyForTest(LOCKED_SPEAKER_KIND_FOR_TEST, "bio")).toBe("long_text");
    });
  });
});
