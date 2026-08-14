// DEC-947: resolveIcsOrganizerEmail (src/server/context.ts) governs the ICS
// ORGANIZER address with the same policy makeMailer already uses under
// DEC-547 — env.MAIL_FROM_EMAIL first, the dev-local ICS_ORGANIZER_EMAIL
// placeholder only under DEV_MODE="1", and otherwise a loud throw so a
// production deploy never ships a non-routable "noreply@chautauqua.local"
// organizer that bounces RSVPs.
import { describe, expect, it } from "vitest";
import { resolveIcsOrganizerEmail, icsOrganizerEmailOrNull } from "../src/server/context";
import { ICS_ORGANIZER_EMAIL } from "../src/mail/ics";

describe("resolveIcsOrganizerEmail", () => {
  it("prefers MAIL_FROM_EMAIL when set, even in dev mode", () => {
    expect(
      resolveIcsOrganizerEmail({ DEV_MODE: "1", MAIL_FROM_EMAIL: "organizer@example.com" }),
    ).toBe("organizer@example.com");
  });

  it("falls back to the dev-local placeholder when DEV_MODE is \"1\" and MAIL_FROM_EMAIL is unset", () => {
    expect(resolveIcsOrganizerEmail({ DEV_MODE: "1", MAIL_FROM_EMAIL: undefined })).toBe(
      ICS_ORGANIZER_EMAIL,
    );
  });

  it("throws when MAIL_FROM_EMAIL is unset and DEV_MODE is not \"1\"", () => {
    expect(() => resolveIcsOrganizerEmail({ DEV_MODE: "0", MAIL_FROM_EMAIL: undefined })).toThrow(
      /MAIL_FROM_EMAIL is not set and DEV_MODE is not "1"/,
    );
    expect(() => resolveIcsOrganizerEmail({ DEV_MODE: undefined, MAIL_FROM_EMAIL: undefined })).toThrow(
      /MAIL_FROM_EMAIL is not set and DEV_MODE is not "1"/,
    );
  });
});

describe("icsOrganizerEmailOrNull", () => {
  it("returns null when MAIL_FROM_EMAIL is unset and DEV_MODE is not \"1\" (DEC-947 wave-58 amendment)", () => {
    expect(icsOrganizerEmailOrNull({ DEV_MODE: "0", MAIL_FROM_EMAIL: undefined })).toBeNull();
    expect(icsOrganizerEmailOrNull({ DEV_MODE: undefined, MAIL_FROM_EMAIL: undefined })).toBeNull();
  });

  it("falls back to the dev-local placeholder when DEV_MODE is \"1\" and MAIL_FROM_EMAIL is unset", () => {
    expect(icsOrganizerEmailOrNull({ DEV_MODE: "1", MAIL_FROM_EMAIL: undefined })).toBe(
      ICS_ORGANIZER_EMAIL,
    );
  });

  it("returns MAIL_FROM_EMAIL verbatim when set", () => {
    expect(
      icsOrganizerEmailOrNull({ DEV_MODE: "0", MAIL_FROM_EMAIL: "organizer@example.com" }),
    ).toBe("organizer@example.com");
  });
});
