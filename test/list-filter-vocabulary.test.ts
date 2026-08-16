// DEC-905 (wave-31 amendment): filter parameters fail loudly instead of
// returning a confident empty page. Covers two routes:
//   - GET .../email-log: `status` must be one of EMAIL_LOG_STATUSES (the
//     exact literals src/mail/** writers produce), and the free-text/id
//     params (`q`, `contactId`, `batchId`) are bounded via the shared
//     parseBoundedText (never a second bounds check).
//   - GET .../breaks: `day` runs through the SAME isIsoDay shape gate the
//     POST/PATCH break body already uses -- one day-format validator, not
//     two.
// Same fake-db SQL-inspection technique as test/email-log-since-filter.test
// .ts's sibling comment explains (no real SQLite engine wired into these
// unit tests).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { EMAIL_LOG_STATUSES } from "../src/mail/types";

const dialect = new SQLiteSyncDialect();

// Combined fake db: first select() serves the route's event-ownership
// lookup (from->where->limit), every subsequent select() serves the repo's
// own query chain (from->where->orderBy->limit->offset / groupBy), each
// resolved from `responses` in call order -- mirrors
// test/email-log-since-filter.test.ts's `buildAppAndCapture` +
// `makeFakeDb`, merged into one db so the route can reach the repo.
function buildApp(eventRow: unknown, responses: unknown[]) {
  let repoCallIndex = 0;
  const repoCalls: { method: string; args: unknown[] }[][] = [];
  let ownershipServed = false;

  function repoChain(): any {
    const log: { method: string; args: unknown[] }[] = [];
    repoCalls.push(log);
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) {
      obj[m] = (...args: unknown[]) => {
        log.push({ method: m, args });
        return obj;
      };
    }
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = responses[repoCallIndex];
      repoCallIndex += 1;
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { userId: "u1", role: "organizer", orgId: "org1" });
    c.set("db", {
      select: () => {
        if (!ownershipServed) {
          ownershipServed = true;
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([eventRow]),
              }),
            }),
          };
        }
        return repoChain();
      },
    } as never);
    await next();
  });
  registerErrorHandler(app);
  return { app, repoCalls: () => repoCalls };
}

describe("GET .../email-log ?status= (DEC-905)", () => {
  it("400s on an out-of-vocabulary status instead of a confident empty page", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const { app } = buildApp({ id: "ev1", orgId: "org1" }, []);
    app.route("/", emailLogRoutes);
    const res = await app.request("/api/v1/events/ev1/email-log?status=snet", {}, { KV: {} });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("status");
  });

  it("still filters on a valid status", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const { app, repoCalls } = buildApp({ id: "ev1", orgId: "org1" }, [[], [{ count: 0 }]]);
    app.route("/", emailLogRoutes);
    const res = await app.request("/api/v1/events/ev1/email-log?status=failed", {}, { KV: {} });
    expect(res.status).toBe(200);

    const rowsWhere = repoCalls()[0]!.find((c) => c.method === "where")!;
    const rowsSql = dialect.sqlToQuery(rowsWhere.args[0] as any);
    expect(rowsSql.sql).toContain("status");
    expect(rowsSql.params).toContain("failed");
  });

  // DEC-238 (wave-8 amendment, sha efb77e4a): 'skipped' is written by
  // src/routes/comms/send.ts through d1EmailLogWriter directly -- it is
  // NOT a literal any src/mail/** writer produces (dev-sink/email-binding/
  // unconfigured never write it), so it is named here explicitly rather
  // than by the source scan below, whose SCOPE is src/mail/** only.
  it("EMAIL_LOG_STATUSES names exactly the two literals the src/mail/** writers produce, plus 'skipped'", () => {
    expect([...EMAIL_LOG_STATUSES].sort()).toEqual(["failed", "sent", "skipped"]);
  });
});

describe("GET .../email-log ?q= bound (DEC-905/DEC-417)", () => {
  it("400s a 5000-char q instead of forwarding it to SQL", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const { app } = buildApp({ id: "ev1", orgId: "org1" }, []);
    app.route("/", emailLogRoutes);
    const q = "x".repeat(5000);
    const res = await app.request(`/api/v1/events/ev1/email-log?q=${q}`, {}, { KV: {} });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("q");
  });
});

describe("GET .../breaks ?day= (DEC-905)", () => {
  function buildBreaksApp(eventRow: unknown) {
    let ownershipServed = false;
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("auth", { userId: "u1", role: "organizer", orgId: "org1" });
      c.set("db", {
        select: () => {
          if (!ownershipServed) {
            ownershipServed = true;
            return {
              from: () => ({
                where: () => ({
                  limit: () => Promise.resolve([eventRow]),
                }),
              }),
            };
          }
          // listBreaksForEvent's own chain: select().from().where()
          // .orderBy().limit() -- an empty result is enough to reach the
          // 200 this test asserts, the point being `day` was accepted.
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve([]),
                }),
              }),
            }),
          };
        },
      } as never);
      await next();
    });
    registerErrorHandler(app);
    return app;
  }

  it("400s a malformed day instead of a confident empty/unfiltered page", async () => {
    const { breaksRoutes } = await import("../src/routes/api/breaks");
    const app = buildBreaksApp({
      id: "ev1",
      orgId: "org1",
      startDate: "2026-01-01",
      endDate: "2026-01-05",
    });
    app.route("/api/v1", breaksRoutes);
    const res = await app.request("/api/v1/events/ev1/breaks?day=not-a-day", {}, { KV: {} });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("day");
  });

  it("a valid day still filters (200, no error)", async () => {
    const { breaksRoutes } = await import("../src/routes/api/breaks");
    const app = buildBreaksApp({
      id: "ev1",
      orgId: "org1",
      startDate: "2026-01-01",
      endDate: "2026-01-05",
    });
    app.route("/api/v1", breaksRoutes);
    const res = await app.request("/api/v1/events/ev1/breaks?day=2026-01-02", {}, { KV: {} });
    expect(res.status).toBe(200);
  });
});

describe("Source scan: every email_log status literal under src/mail/** is in EMAIL_LOG_STATUSES", () => {
  it("scans src/mail/** for `status:` / `status =` string literal assignments", () => {
    const mailDir = join(__dirname, "..", "src", "mail");
    const files: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (full.endsWith(".ts")) {
          files.push(full);
        }
      }
    }
    walk(mailDir);

    const literalRe = /status\s*[:=]\s*"([^"]*)"/g;
    const found = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = literalRe.exec(text)) !== null) {
        found.add(m[1]!);
      }
    }

    expect(found.size).toBeGreaterThan(0);
    for (const literal of found) {
      expect(EMAIL_LOG_STATUSES as readonly string[]).toContain(literal);
    }
  });
});
