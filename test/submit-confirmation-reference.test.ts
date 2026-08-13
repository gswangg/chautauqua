// DEC-862: the CFP confirmation names the submission's reference and echoes
// the address it emailed; the three DEC-098 states take the design's
// primary labels. Renders ConfirmationPage directly for each of the three
// ConfirmationState values.

import { describe, expect, it } from "vitest";
import { ConfirmationPage } from "../src/routes/public/submit-views";

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
} as any;

function render(state: "fresh" | "pending-existing-contact" | "has-account") {
  const el = ConfirmationPage({
    event: EVENT_ROW,
    title: "My Great Talk",
    ref: "SES-014",
    submittedEmail: "speaker@example.com",
    claimPath: "/claim/tok-123",
    state,
  });
  return el.toString();
}

describe("submit confirmation: reference + echoed address (DEC-862)", () => {
  it("fresh: eyebrow carries the ref, body echoes the address, primary CTA is Create a password with the claim href", () => {
    const html = render("fresh");
    expect(html).toContain("SUBMITTED");
    expect(html).toContain("SES-014");
    expect(html).toContain("speaker@example.com");
    expect(html).toMatch(/href="\/claim\/tok-123"/);
    expect(html).toContain("Create a password");
    expect(html).toContain("Log in");
  });

  it("pending-existing-contact: no /claim/ anywhere, body echoes address, links to /login", () => {
    const html = render("pending-existing-contact");
    expect(html).toContain("SES-014");
    expect(html).toContain("speaker@example.com");
    expect(html).not.toContain("/claim/");
    expect(html).toContain('href="/login"');
  });

  it("has-account: primary CTA is Log in to track it, no claim path", () => {
    const html = render("has-account");
    expect(html).toContain("SES-014");
    expect(html).toContain("speaker@example.com");
    expect(html).not.toContain("/claim/");
    expect(html).toContain("Log in to track it");
    expect(html).toMatch(/href="\/login"/);
  });

  it("eyebrow format is 'SUBMITTED · {ref}'", () => {
    const html = render("fresh");
    expect(html).toMatch(/SUBMITTED[^<]*SES-014/);
  });
});
