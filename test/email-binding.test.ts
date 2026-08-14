// DEC-996 amendment (wave 57): EmailBindingMailer sends through the
// Cloudflare Email Service `send_email` binding. Pure-core: the binding and
// the message factory are injected, so no `cloudflare:email` import is
// needed to test this.

import { describe, expect, it } from "vitest";
import { EmailBindingMailer } from "../src/mail/email-binding";
import { DevSinkMailer, InMemoryEmailLog } from "../src/mail/dev-sink";
import { mailConfigStatus } from "../src/server/env";
import type { RenderedEmail } from "../src/mail/types";

function baseMsg(overrides: Partial<RenderedEmail> = {}): RenderedEmail {
  return {
    to: { email: "speaker@example.com", name: "Speaker Name" },
    subject: "Hello",
    text: "hello text",
    html: "<p>hello</p>",
    eventId: "evt_1",
    contactId: "contact_1",
    ...overrides,
  };
}

// Identity factory: hands the raw MIME string straight through so tests can
// inspect it, mirroring how a real factory would wrap it in an EmailMessage.
const identityFactory = (from: string, to: string, raw: string) => ({ from, to, raw });

describe("EmailBindingMailer", () => {
  it("sends through the binding and logs one 'sent' row", async () => {
    const calls: Array<{ from: string; to: string; raw: string }> = [];
    const binding = {
      send: async (message: unknown) => {
        calls.push(message as { from: string; to: string; raw: string });
      },
    };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    await mailer.send(baseMsg());

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.from).toBe("hello@chautauqua.cc");
    expect(call.to).toBe("speaker@example.com");
    expect(call.raw).toContain("From: Chautauqua <hello@chautauqua.cc>");
    expect(call.raw).toContain("To: speaker@example.com");
    expect(call.raw).toContain("Subject: Hello");
    expect(call.raw).toContain("MIME-Version: 1.0");
    expect(call.raw).toContain("Content-Type: multipart/alternative");
    expect(call.raw).toContain("hello text");
    expect(call.raw).toContain("<p>hello</p>");

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.status).toBe("sent");
    expect(log.rows[0]!.provider).toBe("cloudflare");
  });

  it("rides a .ics attachment as a base64 text/calendar part named after its filename", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = {
      send: async (message: unknown) => {
        calls.push(message as { raw: string });
      },
    };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    const icsContent = "BEGIN:VCALENDAR\nEND:VCALENDAR";
    await mailer.send(baseMsg({ ics: { filename: "session.ics", content: icsContent } }));

    const raw = calls[0]!.raw;
    expect(raw).toContain('Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="session.ics"');
    expect(raw).toContain('filename="session.ics"');
    expect(raw).toContain(btoa(icsContent));
  });

  it("logs a 'failed' row and rethrows when the binding throws", async () => {
    const binding = {
      send: async () => {
        throw new Error("simulated send_email rejection");
      },
    };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    await expect(mailer.send(baseMsg())).rejects.toThrow(/simulated send_email rejection/);

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.status).toBe("failed");
    expect(log.rows[0]!.provider).toBe("cloudflare");
  });

  it("still writes exactly one row (never two) on failure", async () => {
    const binding = { send: async () => { throw new Error("boom"); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);
    await mailer.send(baseMsg()).catch(() => {});
    expect(log.rows).toHaveLength(1);
  });
});

describe("mailConfigStatus (DEC-996 amendment, wave 57)", () => {
  it("selects the dev sink in dev mode even when EMAIL is bound", () => {
    const status = mailConfigStatus({
      DEV_MODE: "1",
      EMAIL: { send: async () => {} },
      MAIL_FROM_EMAIL: "hello@chautauqua.cc",
      MAIL_FROM_NAME: "Chautauqua",
    });
    expect(status).toEqual({ provider: "dev-sink", configured: true, fromEmail: "hello@chautauqua.cc" });
  });

  it("still selects DevSinkMailer's behaviour in dev mode (log only, no external send)", async () => {
    const log = new InMemoryEmailLog();
    const mailer = new DevSinkMailer(log);
    await mailer.send(baseMsg());
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.status).toBe("sent");
  });

  it("selects 'email-binding' when EMAIL and MAIL_FROM_EMAIL are both set outside dev mode", () => {
    const status = mailConfigStatus({
      DEV_MODE: undefined,
      EMAIL: { send: async () => {} },
      MAIL_FROM_EMAIL: "hello@chautauqua.cc",
      MAIL_FROM_NAME: "Chautauqua",
    });
    expect(status).toEqual({ provider: "email-binding", configured: true, fromEmail: "hello@chautauqua.cc" });
  });

  it("selects 'none' when EMAIL is unbound", () => {
    const status = mailConfigStatus({
      DEV_MODE: undefined,
      EMAIL: undefined,
      MAIL_FROM_EMAIL: "hello@chautauqua.cc",
      MAIL_FROM_NAME: "Chautauqua",
    });
    expect(status).toEqual({ provider: "none", configured: false, fromEmail: "hello@chautauqua.cc" });
  });
});
