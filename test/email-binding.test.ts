// DEC-996 amendment (wave 57): EmailBindingMailer sends through the
// Cloudflare Email Service `send_email` binding. Pure-core: the binding and
// the message factory are injected, so no `cloudflare:email` import is
// needed to test this.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EmailBindingMailer, addressValue } from "../src/mail/email-binding";
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
    expect(call.raw).toContain('From: "Chautauqua" <hello@chautauqua.cc>');
    expect(call.raw).toContain('To: "Speaker Name" <speaker@example.com>');
    expect(call.raw).toContain("Subject: Hello");
    expect(call.raw).toContain("MIME-Version: 1.0");
    expect(call.raw).toContain("Content-Type: multipart/alternative");
    expect(call.raw).toContain(btoa("hello text"));
    expect(call.raw).toContain(btoa("<p>hello</p>"));

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

    const icsContent = "BEGIN:VCALENDAR\nMETHOD:REQUEST\nEND:VCALENDAR";
    await mailer.send(baseMsg({ ics: { filename: "session.ics", content: icsContent } }));

    const raw = calls[0]!.raw;
    expect(raw).toContain('Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="session.ics"');
    expect(raw).toContain('filename="session.ics"');
    expect(raw).toContain(btoa(icsContent));
  });

  // wave-82 amendment (DEC-023/DEC-168): the method= parameter must come
  // from the METHOD: line inside the ics bytes, not a hard-coded REQUEST —
  // correct today only because REQUEST was the sole caller.
  it("labels a METHOD:CANCEL calendar's part as method=CANCEL, not method=REQUEST", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    const icsContent = "BEGIN:VCALENDAR\nMETHOD:CANCEL\nEND:VCALENDAR";
    await mailer.send(baseMsg({ ics: { filename: "session.ics", content: icsContent } }));

    const raw = calls[0]!.raw;
    expect(raw).toContain('Content-Type: text/calendar; charset="UTF-8"; method=CANCEL; name="session.ics"');
    expect(raw).not.toContain("method=REQUEST");
  });

  it("refuses to send an .ics attachment whose content carries no METHOD: line", async () => {
    const binding = { send: async () => {} };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    const icsContent = "BEGIN:VCALENDAR\nEND:VCALENDAR";
    await expect(
      mailer.send(baseMsg({ ics: { filename: "session.ics", content: icsContent } })),
    ).rejects.toThrow(/METHOD/);
  });

  it("strips a header-injection subject to a single Subject: line with no Bcc: line", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    await mailer.send(baseMsg({ subject: "Update\r\nBcc: attacker@evil.example" }));

    const raw = calls[0]!.raw;
    const lines = raw.split("\r\n");
    const subjectLines = lines.filter((l) => l.startsWith("Subject:"));
    expect(subjectLines).toHaveLength(1);
    expect(subjectLines[0]).toBe("Subject: UpdateBcc: attacker@evil.example");
    expect(lines.some((l) => l.startsWith("Bcc:"))).toBe(false);
  });

  it("encodes a non-ASCII subject as an RFC 2047 encoded-word, never raw bytes in the header block", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    await mailer.send(baseMsg({ subject: "Café talk éé" }));

    const raw = calls[0]!.raw;
    const headerBlockEnd = raw.indexOf("\r\n\r\n");
    const headerBlock = raw.slice(0, headerBlockEnd);
    expect(headerBlock).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    expect(headerBlock).not.toContain("Café");
    expect(headerBlock).not.toContain("é");
  });

  it("nests the .ics as a sibling of multipart/alternative under a top-level multipart/mixed", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    await mailer.send(baseMsg({ ics: { filename: "session.ics", content: "BEGIN:VCALENDAR\nMETHOD:REQUEST\nEND:VCALENDAR" } }));

    const raw = calls[0]!.raw;
    const headerBlockEnd = raw.indexOf("\r\n\r\n");
    const headerBlock = raw.slice(0, headerBlockEnd);
    expect(headerBlock).toMatch(/Content-Type: multipart\/mixed; boundary="([^"]+)"/);
    const mixedBoundary = /Content-Type: multipart\/mixed; boundary="([^"]+)"/.exec(headerBlock)![1]!;
    const mixedBodyStart = headerBlockEnd + 4;
    const mixedBody = raw.slice(mixedBodyStart);
    // The multipart/alternative part and the text/calendar part must both be
    // direct children of the mixed boundary (siblings), not nested within
    // each other.
    const mixedParts = mixedBody.split(`--${mixedBoundary}`);
    const altPart = mixedParts.find((p) => p.includes("multipart/alternative"));
    const calPart = mixedParts.find((p) => p.includes("text/calendar"));
    expect(altPart).toBeDefined();
    expect(calPart).toBeDefined();
    expect(calPart).not.toContain("multipart/alternative");
  });

  it("keeps a top-level multipart/alternative when there is no .ics", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    await mailer.send(baseMsg());

    const raw = calls[0]!.raw;
    const headerBlockEnd = raw.indexOf("\r\n\r\n");
    const headerBlock = raw.slice(0, headerBlockEnd);
    expect(headerBlock).toMatch(/Content-Type: multipart\/alternative; boundary="[^"]+"/);
    expect(headerBlock).not.toContain("multipart/mixed");
  });

  it("carries Date: (from the injected clock) and Message-ID:", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const fixedNow = new Date("2026-08-12T16:04:05.000Z");
    const mailer = new EmailBindingMailer(
      binding,
      log,
      { email: "hello@chautauqua.cc", name: "Chautauqua" },
      identityFactory,
      { now: () => fixedNow },
    );

    await mailer.send(baseMsg());

    const raw = calls[0]!.raw;
    expect(raw).toContain("Date: Wed, 12 Aug 2026 16:04:05 +0000");
    expect(raw).toMatch(/Message-ID: <[0-9a-f-]+@chautauqua\.cc>/);
  });

  it("mints a different boundary and Message-ID on every send", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    await mailer.send(baseMsg());
    await mailer.send(baseMsg());

    const [raw1, raw2] = calls.map((c) => c.raw);
    const boundaryOf = (raw: string) => /boundary="([^"]+)"/.exec(raw)![1]!;
    const messageIdOf = (raw: string) => /Message-ID: <([^>]+)>/.exec(raw)![1]!;
    expect(boundaryOf(raw1!)).not.toBe(boundaryOf(raw2!));
    expect(messageIdOf(raw1!)).not.toBe(messageIdOf(raw2!));
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

  it("folds base64 body lines at 76 characters and every raw line at <= 998 octets for a long body (RFC 2045 / RFC 5322)", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    const longText = "The quick brown fox jumps over the lazy dog. ".repeat(120); // ~5,640 chars
    const longHtml = `<p>${"The quick brown fox jumps over the lazy dog. ".repeat(120)}</p>`;
    await mailer.send(baseMsg({ text: longText, html: longHtml }));

    const raw = calls[0]!.raw;
    const lines = raw.split("\r\n");
    for (const line of lines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(998);
    }

    // Identify the base64 body blocks (between the blank line after each
    // Content-Transfer-Encoding: base64 header and the next boundary line)
    // and assert every line within them is <= 76 characters.
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "Content-Transfer-Encoding: base64") {
        let j = i + 1;
        expect(lines[j]).toBe(""); // blank separator line
        j += 1;
        while (j < lines.length && !lines[j]!.startsWith("--")) {
          expect(lines[j]!.length).toBeLessThanOrEqual(76);
          j += 1;
        }
      }
    }
  });

  it("round-trips a long text/html body through fold+decode to the exact original bytes", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    const longText = "Line with unicode café — ".repeat(200); // ~5,200 chars, non-ASCII
    const longHtml = `<p>${"body ".repeat(200)}</p>`;
    await mailer.send(baseMsg({ text: longText, html: longHtml }));

    const raw = calls[0]!.raw;
    const headerBlockEnd = raw.indexOf("\r\n\r\n");
    const body = raw.slice(headerBlockEnd + 4);
    const parts = body.split(/\r\n--[^\r\n]+\r\n/).filter((p) => p.trim().length > 0);

    const decodeBase64Block = (block: string): string => {
      const blockLines = block.split("\r\n");
      const blankIdx = blockLines.indexOf("");
      const b64Lines = blockLines.slice(blankIdx + 1).filter((l) => l.length > 0 && !l.startsWith("--"));
      const b64 = b64Lines.join("");
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    };

    const textPart = parts.find((p) => p.includes("Content-Type: text/plain"));
    const htmlPart = parts.find((p) => p.includes("Content-Type: text/html"));
    expect(textPart).toBeDefined();
    expect(htmlPart).toBeDefined();
    expect(decodeBase64Block(textPart!)).toBe(longText);
    expect(decodeBase64Block(htmlPart!)).toBe(longHtml);
  });

  it("round-trips a multi-session .ics attachment through fold+decode to the exact original bytes", async () => {
    const calls: Array<{ raw: string }> = [];
    const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
    const log = new InMemoryEmailLog();
    const mailer = new EmailBindingMailer(binding, log, { email: "hello@chautauqua.cc", name: "Chautauqua" }, identityFactory);

    const icsEvents = Array.from({ length: 30 }, (_, i) => (
      `BEGIN:VEVENT\r\nUID:chq-${i}@chautauqua\r\nSUMMARY:Session number ${i} with a fairly long title so the ics body grows past a single 76-char line\r\nEND:VEVENT`
    )).join("\r\n");
    const icsContent = `BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\n${icsEvents}\r\nEND:VCALENDAR`;
    await mailer.send(baseMsg({ ics: { filename: "sessions.ics", content: icsContent } }));

    const raw = calls[0]!.raw;
    const lines = raw.split("\r\n");
    for (const line of lines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(998);
    }

    const calStart = raw.indexOf("Content-Type: text/calendar");
    const calSection = raw.slice(calStart);
    const calBlockEnd = calSection.indexOf("\r\n\r\n");
    const afterHeaders = calSection.slice(calBlockEnd + 4);
    const nextBoundaryIdx = afterHeaders.indexOf("\r\n--");
    const calBody = nextBoundaryIdx === -1 ? afterHeaders : afterHeaders.slice(0, nextBoundaryIdx);
    const b64 = calBody.split("\r\n").filter((l) => l.length > 0).join("");
    for (const line of calBody.split("\r\n").filter((l) => l.length > 0)) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    expect(new TextDecoder().decode(bytes)).toBe(icsContent);
  });

  it("strips every ADDRESS_FORBIDDEN_RE char from the envelope to/from addresses passed to the message factory, identical to the To: header (task-w15-f)", async () => {
    const calls: Array<{ from: string; to: string; raw: string }> = [];
    const binding = {
      send: async (message: unknown) => {
        calls.push(message as { from: string; to: string; raw: string });
      },
    };
    const log = new InMemoryEmailLog();
    const dirtyFrom = 'hel<lo>@ch,au;taua"."cc';
    const dirtyTo = 'a,b@c.com';
    const mailer = new EmailBindingMailer(
      binding,
      log,
      { email: dirtyFrom, name: "Chautauqua" },
      identityFactory,
    );

    await mailer.send(baseMsg({ to: { email: dirtyTo, name: "Someone" } }));

    const call = calls[0]!;
    // Every forbidden char (control/DEL, <, >, ",", ";", DQUOTE, backslash,
    // whitespace) must be gone from the envelope arguments...
    expect(call.from).toBe(addressValue(dirtyFrom));
    expect(call.to).toBe(addressValue(dirtyTo));
    // ...and must be identical to what the To:/From: HEADERS carry above it,
    // so there is exactly one stripped answer for the value, not two.
    expect(call.raw).toContain(`<${call.from}>`);
    expect(call.raw).toContain(`<${call.to}>`);
  });

  it("scan: every email interpolated into an address position in email-binding.ts and ics.ts is wrapped in addressValue (task-w15-f, pins the class)", () => {
    const emailBindingPath = fileURLToPath(new URL("../src/mail/email-binding.ts", import.meta.url));
    const icsPath = fileURLToPath(new URL("../src/mail/ics.ts", import.meta.url));
    const emailBindingSrc = readFileSync(emailBindingPath, "utf-8");
    const icsSrc = readFileSync(icsPath, "utf-8");

    // Address positions: `<${...}>` and `mailto:${...}` template interpolations.
    // The interpolated expression must either be a direct `addressValue(...)`
    // call, or a local identifier that was itself assigned from
    // `addressValue(...)` (e.g. `const safeEmail = addressValue(email);` then
    // `<${safeEmail}>`) -- resolving that one level of aliasing lets the test
    // still catch a future call site that interpolates a raw `.email` field
    // directly, which is exactly the class of bug this file exists to close.
    const addressPositionRe = /(?:<\$\{([^}]+)\}>|mailto:\$\{([^}]+)\})/g;

    function safeIdentifiers(src: string): Set<string> {
      const ids = new Set<string>();
      const assignRe = /const\s+(\w+)\s*=\s*addressValue\(/g;
      let m: RegExpExecArray | null;
      while ((m = assignRe.exec(src)) !== null) ids.add(m[1]!);
      return ids;
    }

    // Strip `//`-comment lines before scanning — this file's own prose
    // (deliberately) mentions `<${email}>` and `mailto:${email}` as examples
    // of the pattern being guarded against, which would otherwise false-
    // positive as an unwrapped call site.
    function stripLineComments(src: string): string {
      return src
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
    }

    function assertAllWrapped(rawSrc: string, label: string) {
      const src = stripLineComments(rawSrc);
      const aliases = safeIdentifiers(src);
      let match: RegExpExecArray | null;
      let found = 0;
      while ((match = addressPositionRe.exec(src)) !== null) {
        const expr = (match[1] ?? match[2])!.trim();
        found += 1;
        const isDirectCall = expr.startsWith("addressValue(");
        const isSafeAlias = aliases.has(expr);
        if (!isDirectCall && !isSafeAlias) {
          throw new Error(`${label}: interpolated address expression "${expr}" is neither a direct addressValue(...) call nor an addressValue-derived alias`);
        }
      }
      expect(found).toBeGreaterThan(0);
    }

    assertAllWrapped(emailBindingSrc, "email-binding.ts");
    assertAllWrapped(icsSrc, "ics.ts");

    // The messageFactory call itself is not a template interpolation (it's a
    // function call), so assert directly that both of its address arguments
    // are addressValue(...)-wrapped and not the raw `.email` field.
    const factoryCallMatch = /this\.messageFactory\(\s*([^,]+),\s*([^,]+),/.exec(emailBindingSrc);
    expect(factoryCallMatch).not.toBeNull();
    const [, fromArg, toArg] = factoryCallMatch!;
    expect(fromArg!.trim().startsWith("addressValue(")).toBe(true);
    expect(toArg!.trim().startsWith("addressValue(")).toBe(true);
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
