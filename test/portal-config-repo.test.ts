import { describe, expect, it } from "vitest";
import {
  isWikiResource,
  mergePortalSettingsInput,
  resourceBelongsToEvent,
  type PortalSettingsRecord,
} from "../src/server/repo/portal-config";

describe("mergePortalSettingsInput (portal-settings upsert)", () => {
  it("insert path: defaults showResources true, other fields null when omitted", () => {
    expect(mergePortalSettingsInput(null, {})).toEqual({
      logoUrl: null,
      accentColor: null,
      welcomeMessage: null,
      showResources: true,
    });
  });

  it("insert path: uses provided values, including an explicit false showResources", () => {
    expect(
      mergePortalSettingsInput(null, {
        logoUrl: "https://example.com/logo.png",
        accentColor: "#336699",
        welcomeMessage: "hi",
        showResources: false,
      }),
    ).toEqual({
      logoUrl: "https://example.com/logo.png",
      accentColor: "#336699",
      welcomeMessage: "hi",
      showResources: false,
    });
  });

  const existing: PortalSettingsRecord = {
    id: "ps1",
    eventId: "e1",
    logoUrl: "https://old.example.com/logo.png",
    accentColor: "#111111",
    welcomeMessage: "old welcome",
    showResources: true,
    createdAt: 1,
    updatedAt: 1,
  };

  it("update path: leaves undefined fields unchanged (partial-merge upsert, not a full replace)", () => {
    expect(mergePortalSettingsInput(existing, { accentColor: "#222222" })).toEqual({
      logoUrl: "https://old.example.com/logo.png",
      accentColor: "#222222",
      welcomeMessage: "old welcome",
      showResources: true,
    });
  });

  it("update path: an explicit null clears a field (distinct from undefined = unchanged)", () => {
    expect(mergePortalSettingsInput(existing, { logoUrl: null })).toEqual({
      logoUrl: null,
      accentColor: "#111111",
      welcomeMessage: "old welcome",
      showResources: true,
    });
  });

  it("update path: an explicit false is applied, not treated as omitted", () => {
    expect(mergePortalSettingsInput(existing, { showResources: false }).showResources).toBe(false);
  });
});

describe("resourceBelongsToEvent (IDOR guard)", () => {
  it("is true only when the resource's own event_id matches exactly", () => {
    expect(resourceBelongsToEvent("e1", "e1")).toBe(true);
  });

  it("is false for a mismatched event_id — no cross-tenant leakage", () => {
    expect(resourceBelongsToEvent("e1", "e2")).toBe(false);
  });

  it("is false when the resource doesn't exist (null event_id)", () => {
    expect(resourceBelongsToEvent(null, "e1")).toBe(false);
  });
});

describe("isWikiResource", () => {
  it("accepts kind='wiki'", () => {
    expect(isWikiResource("wiki")).toBe(true);
  });

  it("rejects kind='file' — file-kind resources aren't editable via this API (later wave)", () => {
    expect(isWikiResource("file")).toBe(false);
  });
});
