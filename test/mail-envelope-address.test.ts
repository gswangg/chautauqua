// DEC-499 amendment (findings wave 16): every address position is a
// serializer boundary — including the SMTP envelope passed to the binding's
// message factory, not just the From:/To: headers built by addressHeader.
// This file pins that class with (1) a hostile-address unit test asserting
// the envelope matches addressValue(...) AND is byte-identical to what the
// raw MIME's headers carry, (2) a legitimate-address no-op test, and (3) a
// narrow scan asserting every address-position interpolation in
// email-binding.ts and ics.ts is addressValue(...)-wrapped.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EmailBindingMailer, addressValue } from "../src/mail/email-binding";
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

// Hands the raw MIME string straight through so the envelope arguments and
// the header-rendered address can be compared byte-for-byte.
const identityFactory = (from: string, to: string, raw: string) => ({ from, to, raw });

describe("EmailBindingMailer envelope address (DEC-499 amendment, wave 16)", () => {
  it.each([
    ["comma+angle-bracket local part", "a,b@c.com"],
    ["embedded angle brackets", "a<b@c.com"],
  ])("strips the hostile %s from the envelope, identical to the header", async (_label, dirtyTo) => {
    const calls: Array<{ from: string; to: string; raw: string }> = [];
    const binding = {
      send: async (message: unknown) => {
        calls.push(message as { from: string; to: string; raw: string });
      },
    };
    const log = new InMemoryEmailLog();
    const dirtyFrom = "hi,there@chautauqua.cc";
    const mailer = new EmailBindingMailer(
      binding,
      log,
      { email: dirtyFrom, name: "Chautauqua" },
      identityFactory,
    );

    await mailer.send(baseMsg({ to: { email: dirtyTo, name: "Someone" } }));

    const call = calls[0]!;
    expect(call.from).toBe(addressValue(dirtyFrom));
    expect(call.to).toBe(addressValue(dirtyTo));
    // Byte-identical to the address rendered inside the raw MIME's
    // To:/From: headers — one stripped answer for the value, not two.
    expect(call.raw).toContain(`<${call.from}>`);
    expect(call.raw).toContain(`<${call.to}>`);
  });

  it("passes a legitimate address through unchanged", async () => {
    const calls: Array<{ from: string; to: string; raw: string }> = [];
    const binding = {
      send: async (message: unknown) => {
        calls.push(message as { from: string; to: string; raw: string });
      },
    };
    const log = new InMemoryEmailLog();
    const cleanFrom = "hello@chautauqua.cc";
    const cleanTo = "first.last@example.co.uk";
    const mailer = new EmailBindingMailer(
      binding,
      log,
      { email: cleanFrom, name: "Chautauqua" },
      identityFactory,
    );

    await mailer.send(baseMsg({ to: { email: cleanTo, name: "First Last" } }));

    const call = calls[0]!;
    expect(call.from).toBe(cleanFrom);
    expect(call.to).toBe(cleanTo);
    expect(call.raw).toContain(`<${cleanFrom}>`);
    expect(call.raw).toContain(`<${cleanTo}>`);
  });

  it("scan: every address-position interpolation in email-binding.ts and ics.ts is addressValue(...)-wrapped", () => {
    const emailBindingPath = fileURLToPath(new URL("../src/mail/email-binding.ts", import.meta.url));
    const icsPath = fileURLToPath(new URL("../src/mail/ics.ts", import.meta.url));
    const emailBindingSrc = readFileSync(emailBindingPath, "utf-8");
    const icsSrc = readFileSync(icsPath, "utf-8");

    function stripLineComments(src: string): string {
      return src
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
    }

    // Local aliases assigned directly from addressValue(...), e.g.
    // `const safeEmail = addressValue(email);` then `<${safeEmail}>` —
    // resolving one level of aliasing still catches a future call site
    // that interpolates a raw `.email` field directly.
    function safeIdentifiers(src: string): Set<string> {
      const ids = new Set<string>();
      const assignRe = /const\s+(\w+)\s*=\s*addressValue\(/g;
      let m: RegExpExecArray | null;
      while ((m = assignRe.exec(src)) !== null) ids.add(m[1]!);
      return ids;
    }

    function assertAllTemplateInterpolationsWrapped(rawSrc: string, label: string): number {
      const src = stripLineComments(rawSrc);
      const aliases = safeIdentifiers(src);
      const addressPositionRe = /(?:<\$\{([^}]+)\}>|mailto:\$\{([^}]+)\})/g;
      let match: RegExpExecArray | null;
      let found = 0;
      while ((match = addressPositionRe.exec(src)) !== null) {
        const expr = (match[1] ?? match[2])!.trim();
        found += 1;
        const isDirectCall = expr.startsWith("addressValue(");
        const isSafeAlias = aliases.has(expr);
        if (!isDirectCall && !isSafeAlias) {
          const line = src.slice(0, match.index).split("\n").length;
          throw new Error(
            `${label}:${line}: interpolated address expression "${expr}" is neither a direct addressValue(...) call nor an addressValue-derived alias`,
          );
        }
      }
      return found;
    }

    expect(assertAllTemplateInterpolationsWrapped(emailBindingSrc, "email-binding.ts")).toBeGreaterThan(0);
    expect(assertAllTemplateInterpolationsWrapped(icsSrc, "ics.ts")).toBeGreaterThan(0);

    // The messageFactory(...) call is a function call, not a template
    // interpolation, so assert its two address arguments directly.
    const factoryCallMatch = /this\.messageFactory\(\s*([^,]+),\s*([^,]+),/.exec(stripLineComments(emailBindingSrc));
    if (!factoryCallMatch) {
      throw new Error("email-binding.ts: no this.messageFactory(...) call site found to scan");
    }
    const [, fromArg, toArg] = factoryCallMatch;
    if (!fromArg!.trim().startsWith("addressValue(")) {
      throw new Error(`email-binding.ts: messageFactory's "from" argument "${fromArg!.trim()}" is not addressValue(...)-wrapped`);
    }
    if (!toArg!.trim().startsWith("addressValue(")) {
      throw new Error(`email-binding.ts: messageFactory's "to" argument "${toArg!.trim()}" is not addressValue(...)-wrapped`);
    }
  });
});
