// DEC-434: isDevMode(env) is the ONE dev-mode predicate. This test asserts
// that every gate that used to re-spell the DEV_MODE comparison (makeMailer's
// mailer selection, shouldMountDevMailbox, resolveBaseUrl's loopback
// sniffing) agrees on every DEV_MODE value — in particular that DEV_MODE="0"
// no longer selects the dev sink / dev mailbox / loopback sniffing just
// because it's falsy.

import { describe, expect, it } from "vitest";
import { isDevMode } from "../src/server/env";
import { shouldMountDevMailbox } from "../src/routes/dev/mailbox";
import { resolveBaseUrl } from "../src/server/origin";
import { makeMailer } from "../src/server/context";
import { DevSinkMailer } from "../src/mail/dev-sink";
import { ResendMailer } from "../src/mail/resend";

const DEV_MODE_VALUES: Array<string | undefined> = [undefined, "", "0", "1", "true", "yes"];

// Minimal Db stub: makeMailer only touches db to build the EmailLogWriter
// closure (d1EmailLogWriter(db)) which isn't invoked until send() is called.
const stubDb = {} as Parameters<typeof makeMailer>[0];

describe("isDevMode (DEC-434): one predicate, every gate agrees", () => {
  for (const devMode of DEV_MODE_VALUES) {
    const expected = devMode === "1";

    it(`DEV_MODE=${JSON.stringify(devMode)} -> isDevMode=${expected}`, () => {
      expect(isDevMode({ DEV_MODE: devMode })).toBe(expected);
    });

    it(`DEV_MODE=${JSON.stringify(devMode)}: shouldMountDevMailbox agrees with isDevMode`, () => {
      expect(shouldMountDevMailbox({ DEV_MODE: devMode })).toBe(expected);
    });

    it(`DEV_MODE=${JSON.stringify(devMode)}: makeMailer's mailer selection agrees with isDevMode`, () => {
      const mailer = makeMailer(stubDb, {
        RESEND_API_KEY: "re_test_key",
        DEV_MODE: devMode,
        MAIL_FROM_EMAIL: "noreply@chautauqua.cc",
        MAIL_FROM_NAME: "Chautauqua",
      });
      if (expected) {
        expect(mailer).toBeInstanceOf(DevSinkMailer);
      } else {
        expect(mailer).toBeInstanceOf(ResendMailer);
      }
    });

    it(`DEV_MODE=${JSON.stringify(devMode)}: resolveBaseUrl's loopback sniffing agrees with isDevMode`, () => {
      // No PUBLIC_BASE_URL configured, request URL is loopback: loopback
      // sniffing (dev-only) should return the loopback origin verbatim only
      // when isDevMode(env) is true; otherwise it falls through to the
      // (identical, in this case) request-origin default. Use a request
      // whose header-based loopback candidate DIFFERS from the request URL
      // origin so the two code paths are actually distinguishable.
      const c = {
        req: {
          url: "http://chautauqua.cc/submit/foo",
          header: (name: string) => (name === "Origin" ? "http://localhost:8801" : undefined),
        },
        env: { DEV_MODE: devMode },
      };
      const result = resolveBaseUrl(c);
      if (expected) {
        expect(result).toBe("http://localhost:8801");
      } else {
        expect(result).toBe("http://chautauqua.cc");
      }
    });
  }

  it("DEV_MODE='0' with RESEND_API_KEY set now selects ResendMailer, not DevSinkMailer (the DEC-434 regression)", () => {
    const mailer = makeMailer(stubDb, {
      RESEND_API_KEY: "re_test_key",
      DEV_MODE: "0",
      MAIL_FROM_EMAIL: "noreply@chautauqua.cc",
      MAIL_FROM_NAME: "Chautauqua",
    });
    expect(mailer).toBeInstanceOf(ResendMailer);
    expect(mailer).not.toBeInstanceOf(DevSinkMailer);
  });
});

describe("makeMailer (DEC-547): never silently selects the dev sink", () => {
  it("DEV_MODE='1' with no RESEND_API_KEY set selects DevSinkMailer", () => {
    const mailer = makeMailer(stubDb, {
      RESEND_API_KEY: undefined,
      DEV_MODE: "1",
      MAIL_FROM_EMAIL: undefined,
      MAIL_FROM_NAME: undefined,
    });
    expect(mailer).toBeInstanceOf(DevSinkMailer);
  });

  for (const devMode of [undefined, "", "0", "true", "yes"]) {
    it(`DEV_MODE=${JSON.stringify(devMode)} with no RESEND_API_KEY set throws naming DEV_MODE and RESEND_API_KEY`, () => {
      expect(() =>
        makeMailer(stubDb, {
          RESEND_API_KEY: undefined,
          DEV_MODE: devMode,
          MAIL_FROM_EMAIL: undefined,
          MAIL_FROM_NAME: undefined,
        }),
      ).toThrowError(/DEV_MODE.*RESEND_API_KEY|RESEND_API_KEY.*DEV_MODE/);
    });
  }
});
