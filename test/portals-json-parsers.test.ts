// The multi-portal JSON columns each have one validating parser
// (test/json-column-parser-ownership.scan.test.ts): these prove each one
// refuses a malformed stored value instead of casting it.
import { describe, expect, it } from "vitest";
import { parsePortalRuleJson } from "../src/domain/portals/rules";
import { parseCapabilitiesJson, parseFieldPermissionsJson } from "../src/domain/portals/permissions";
import { parseNotificationTaskIdsJson } from "../src/domain/portals/notifications";
import { parseAuditDetailsJson } from "../src/domain/audit";
import { parseAcceptedTypesJson } from "../src/domain/portals/file-types";

describe("portal.rule_json: parsePortalRuleJson", () => {
  it("reads a stored rule", () => {
    const rule = parsePortalRuleJson('{"groups":[{"conditions":[{"field":"role","op":"is_not","values":["panelist"]}]}]}');
    expect(rule.groups[0]!.conditions[0]).toEqual({ field: "role", op: "is_not", values: ["panelist"] });
  });
  it("refuses an unknown field, an unknown test, a missing value and a non-list", () => {
    expect(() => parsePortalRuleJson('{"groups":[{"conditions":[{"field":"shoe","op":"is","values":["a"]}]}]}')).toThrow(/Unknown rule field/);
    expect(() => parsePortalRuleJson('{"groups":[{"conditions":[{"field":"role","op":"like","values":["a"]}]}]}')).toThrow(/Unknown rule test/);
    expect(() => parsePortalRuleJson('{"groups":[{"conditions":[{"field":"role","op":"is","values":[]}]}]}')).toThrow(/needs at least one value/);
    expect(() => parsePortalRuleJson('{"groups":"all"}')).toThrow(/list of groups/);
    expect(() => parsePortalRuleJson("not json")).toThrow();
  });
  it("drops values on a valueless test", () => {
    const rule = parsePortalRuleJson('{"groups":[{"conditions":[{"field":"track","op":"is_empty","values":["x"]}]}]}');
    expect(rule.groups[0]!.conditions[0]!.values).toEqual([]);
  });
});

describe("portal.field_permissions_json: parseFieldPermissionsJson", () => {
  it("reads levels and help text", () => {
    expect(parseFieldPermissionsJson('{"bio":{"level":"edit","help":"  Third person  "}}')).toEqual({ bio: { level: "edit", help: "Third person" } });
  });
  it("refuses an unknown field, an unknown level and non-text help", () => {
    expect(() => parseFieldPermissionsJson('{"shoeSize":{"level":"edit"}}')).toThrow(/Unknown field/);
    expect(() => parseFieldPermissionsJson('{"bio":{"level":"admin"}}')).toThrow(/unknown level/);
    expect(() => parseFieldPermissionsJson('{"bio":{"level":"view","help":3}}')).toThrow(/must be text/);
    expect(() => parseFieldPermissionsJson("[]")).toThrow(/must be an object/);
  });
});

describe("portal.capabilities_json: parseCapabilitiesJson", () => {
  it("reads switches", () => {
    expect(parseCapabilitiesJson('{"addTeammates":true,"editSubmission":false}')).toEqual({ addTeammates: true, editSubmission: false });
  });
  it("refuses an unknown action and a non-boolean", () => {
    expect(() => parseCapabilitiesJson('{"deleteEvent":true}')).toThrow(/Unknown action/);
    expect(() => parseCapabilitiesJson('{"addTeammates":"yes"}')).toThrow(/on or off/);
  });
});

describe("portal_notification.task_ids_json: parseNotificationTaskIdsJson", () => {
  it("reads a list of ids", () => {
    expect(parseNotificationTaskIdsJson('["t1","t2"]')).toEqual(["t1", "t2"]);
  });
  it("refuses a non-list, a number and an empty id", () => {
    expect(() => parseNotificationTaskIdsJson('{"t1":true}')).toThrow(/list of ids/);
    expect(() => parseNotificationTaskIdsJson("[1]")).toThrow(/list of ids/);
    expect(() => parseNotificationTaskIdsJson('[""]')).toThrow(/list of ids/);
  });
});

describe("audit_event.details_json: parseAuditDetailsJson", () => {
  it("reads flat scalars; null is no details", () => {
    expect(parseAuditDetailsJson('{"portal":"Sponsors","items":3,"notify":true,"note":null}')).toEqual({ portal: "Sponsors", items: 3, notify: true, note: null });
    expect(parseAuditDetailsJson(null)).toEqual({});
  });
  it("refuses nesting and non-objects", () => {
    expect(() => parseAuditDetailsJson('{"rule":{"groups":[]}}')).toThrow(/must be a scalar/);
    expect(() => parseAuditDetailsJson('["a"]')).toThrow(/must be an object/);
  });
});

describe("task.accepted_types_json: parseAcceptedTypesJson", () => {
  it("reads groups, dedupes, null is no limit", () => {
    expect(parseAcceptedTypesJson('["pdf","keynote","pdf"]')).toEqual(["pdf", "keynote"]);
    expect(parseAcceptedTypesJson(null)).toBeNull();
  });
  it("refuses an unknown group and a non-list", () => {
    expect(() => parseAcceptedTypesJson('["exe"]')).toThrow(/File types must be/);
    expect(() => parseAcceptedTypesJson('"pdf"')).toThrow(/File types must be/);
  });
});
