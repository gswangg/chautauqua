import { describe, expect, it } from "vitest";
import { icsDownloadHeaders } from "../src/mail/ics";

describe("icsDownloadHeaders", () => {
  it("returns a text/calendar content-type", () => {
    const headers = icsDownloadHeaders("invite.ics");
    expect(headers["Content-Type"]).toBe("text/calendar; charset=utf-8");
  });

  it("serves the stored filename as an attachment", () => {
    const headers = icsDownloadHeaders("SES-014-agenda.ics");
    expect(headers["Content-Disposition"]).toBe('attachment; filename="SES-014-agenda.ics"');
  });

  it("strips header-injection characters from the filename", () => {
    const headers = icsDownloadHeaders('evil"\r\nX-Injected: 1.ics');
    expect(headers["Content-Disposition"]).not.toMatch(/[\r\n]/);
    expect(headers["Content-Disposition"]).toBe('attachment; filename="evilX-Injected: 1.ics"');
  });
});
