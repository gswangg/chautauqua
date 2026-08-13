import { describe, expect, it } from "vitest";
import { ResendMailer } from "../src/mail/resend";
import { InMemoryEmailLog } from "../src/mail/dev-sink";
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

describe("ResendMailer", () => {
  it("POSTs the expected URL, headers, and body shape, and logs a sent row on 200", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
    }) as unknown as typeof fetch;

    const log = new InMemoryEmailLog();
    const mailer = new ResendMailer(fetchImpl, "re_test_key", log, {
      email: "hello@chautauqua.cc",
      name: "Chautauqua",
    });

    await mailer.send(baseMsg());

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(call.init.body as string);
    expect(body).toEqual({
      from: "Chautauqua <hello@chautauqua.cc>",
      to: ["speaker@example.com"],
      subject: "Hello",
      html: "<p>hello</p>",
      text: "hello text",
    });

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.status).toBe("sent");
    expect(log.rows[0]!.provider).toBe("resend");
  });

  it("base64-encodes an .ics attachment with its filename", async () => {
    const calls: Array<{ init: RequestInit }> = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls.push({ init });
      return new Response(JSON.stringify({ id: "re_124" }), { status: 200 });
    }) as unknown as typeof fetch;

    const log = new InMemoryEmailLog();
    const mailer = new ResendMailer(fetchImpl, "re_test_key", log, {
      email: "hello@chautauqua.cc",
      name: "Chautauqua",
    });

    const icsContent = "BEGIN:VCALENDAR\nEND:VCALENDAR";
    await mailer.send(baseMsg({ ics: { filename: "session.ics", content: icsContent } }));

    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.attachments).toEqual([
      { filename: "session.ics", content: btoa(icsContent) },
    ]);
  });

  it("logs a failed row and throws on a non-2xx response", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ message: "Invalid `to` field" }), { status: 422 })) as unknown as typeof fetch;

    const log = new InMemoryEmailLog();
    const mailer = new ResendMailer(fetchImpl, "re_test_key", log, {
      email: "hello@chautauqua.cc",
      name: "Chautauqua",
    });

    await expect(mailer.send(baseMsg())).rejects.toThrow(/422/);

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.status).toBe("failed");
    expect(log.rows[0]!.provider).toBe("resend");
  });
});
