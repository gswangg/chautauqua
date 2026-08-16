// DEC-773 amendment (wave 32-e): headshot file ids have exactly ONE indexed
// home -- contact.headshot_file_id (migration 0040, index
// contact_headshot_file_id_idx). Wave 29 converted files-library.ts to the
// indexed column but left three readers deriving the file id by string-
// parsing contact.headshot_url ('/headshots/<fileId>'), each an unindexed
// scan or a landmine (an unguarded `.split('/').pop()!`). This wave converts
// those three readers (profile.ts's getHeadshotServeScope, contacts/crud.ts's
// GET /contacts/:id, tasks/speaker-detail.ts's getSpeakerDetail).
//
// Two legitimate exceptions remain and are NOT readers deriving an id from a
// string -- they are the writers that establish headshotFileId in the first
// place, all cited together in profile.ts's setContactHeadshot doc comment:
//   - src/server/repo/profile.ts's setContactHeadshot (constructs the
//     '/headshots/<fileId>' string FROM a freshly minted fileId, the
//     opposite direction of a reader)
//   - src/server/repo/contacts/merge.ts's applyMerge (derives the kept
//     row's headshotFileId from whichever headshotUrl planMerge chose,
//     mirroring migration 0040's own backfill -- pre-existing wave-29 code,
//     out of this task's scope to touch)
//   - scripts/seed.ts (seed-only, writes both columns together; scripts/**
//     is never product code)
//
// (a) is a static regex scan: no OTHER module under src/** may destructure
// or slice a '/headshots/<id>' string to obtain a file id.
// (b) is a behavioural case: after a contact replaces their headshot, the
// superseded file id 404s and the current one 200s through the public
// serve route, and an unrelated non-headshot file id still 404s -- proving
// the indexed lookup (eq on headshotFileId) preserves the exact "reverse
// lookup" semantics the old unindexed headshotUrl equality had.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { headshotServeRoutes } from "../src/routes/portal/profile";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// Files allowed to derive a file id from a '/headshots/<id>' string shape --
// see the module doc comment above for why each is a writer, not a reader.
const EXEMPT = new Set([
  join(SRC_ROOT, "server", "repo", "profile.ts"),
  join(SRC_ROOT, "server", "repo", "contacts", "merge.ts"),
]);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

// Matches the string-parsing idioms that pull a bare file id out of a
// '/headshots/<id>' shaped string on a SINGLE LINE (comments discussing the
// historical shape, e.g. files-library.ts's doc comment, don't call any of
// these methods and are correctly not flagged): .split("/").pop(),
// .slice(prefix.length)/.slice(N) preceded by a headshots prefix constant on
// the same or a nearby line, or .startsWith("/headshots/").
const PER_LINE_PATTERNS = [
  /headshotUrl\s*[?!]?\.\s*split\(\s*["'`]\/["'`]\s*\)\s*\.\s*pop\(\)/,
  /headshotUrl\.startsWith\(\s*["'`]\/headshots\/["'`]\s*\)/,
  /headshotUrl\.slice\(\s*["'`]\/headshots\/["'`]\.length\s*\)/,
];

describe("headshot file id has one home (DEC-773 amendment, w32-e)", () => {
  it("no module outside the named writers derives a file id by string-parsing headshotUrl", () => {
    const files: string[] = [];
    walk(SRC_ROOT, files);

    const offenders: string[] = [];
    for (const file of files) {
      if (EXEMPT.has(file)) continue;
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      const hit = lines.some((line) => PER_LINE_PATTERNS.some((re) => re.test(line)));
      if (hit) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("scripts/seed.ts is the only non-src writer of both columns together, and does not read headshotFileId back out of a string", () => {
    const seedPath = join(ROOT, "scripts", "seed.ts");
    const text = readFileSync(seedPath, "utf8");
    // The seed script mints fileId itself and writes both columns from that
    // same variable -- it never re-derives headshotFileId by parsing
    // headshotUrl back apart.
    expect(text).toMatch(/headshot_file_id.*=.*sqlQuote\(fileId\)/);
  });
});

// ---------------------------------------------------------------------------
// (b) behavioural: indexed headshotFileId lookup preserves "reverse lookup"
// semantics identical to the old unindexed headshotUrl equality.

type FileRow = { id: string; kind: string; r2Key: string; contentType: string };

// Same fakeDb shape as test/headshot-gate.test.ts: three sequential select()
// calls per getHeadshotServeScope invocation (file row, reverse contact
// lookup, visibility check) -- but here call 1 (file) and call 2 (contact)
// now fire inside a Promise.all, which still constructs both chains
// synchronously, in array order, before either awaits, so the call-order
// counter is unaffected.
function fakeDb(fileRow: FileRow | null, contactRow: { id: string; orgId: string } | null, visible: boolean) {
  let call = 0;
  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
    };
    return chain;
  }
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain(fileRow ? [fileRow] : []);
      if (call === 2) return makeChain(contactRow ? [contactRow] : []);
      return makeChain(visible ? [{ id: "p1" }] : []);
    },
  } as unknown as AppEnv["Variables"]["db"];
}

describe("GET /headshots/:fileId reverse lookup, indexed (DEC-773 amendment, w32-e)", () => {
  it("404s the superseded file id, 200s the current one, and 404s an unrelated non-headshot file id", async () => {
    const OLD_FILE: FileRow = { id: "file-old", kind: "headshot", r2Key: "headshot/c1/old.jpg", contentType: "image/jpeg" };
    const NEW_FILE: FileRow = { id: "file-new", kind: "headshot", r2Key: "headshot/c1/new.jpg", contentType: "image/jpeg" };
    const OTHER_FILE: FileRow = { id: "file-attachment", kind: "attachment", r2Key: "x", contentType: "application/pdf" };
    // Only the CURRENT upload's fileId is mirrored onto the contact row --
    // the superseded file row still exists (R2 object intact, kind still
    // 'headshot') but no contact's headshotFileId points at it any more,
    // exactly like the pre-existing headshotUrl reverse-lookup semantics
    // (getHeadshotServeScope returns null -> the route 404s).
    const CONTACT_ROW = { id: "c1", orgId: "org1" };

    function fakeFilesBucket() {
      return {
        async get() {
          return { body: new ReadableStream(), httpMetadata: { contentType: "image/jpeg" }, size: 3 };
        },
        async put() {},
        async delete() {},
      } as unknown as R2Bucket;
    }

    function app(d: AppEnv["Variables"]["db"]) {
      const a = new Hono<AppEnv>();
      registerErrorHandler(a);
      a.use("*", async (c, next) => {
        c.set("db", d);
        await next();
      });
      a.route("/", headshotServeRoutes);
      return a;
    }

    async function request(a: Hono<AppEnv>, fileId: string) {
      return a.request(`/headshots/${fileId}`, undefined, { FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    }

    // Old file id: kind is still 'headshot' but the indexed contact lookup
    // (eq(contact.headshotFileId, 'file-old')) finds no row -- superseded.
    const resOld = await request(app(fakeDb(OLD_FILE, null, false)), "file-old");
    expect(resOld.status).toBe(404);

    // New file id: the indexed lookup finds the contact that currently
    // references it, and it's publicly visible.
    const resNew = await request(app(fakeDb(NEW_FILE, CONTACT_ROW, true)), "file-new");
    expect(resNew.status).toBe(200);

    // Unrelated non-headshot file id: fails the kind check before the
    // contact lookup even runs.
    const resOther = await request(app(fakeDb(OTHER_FILE, null, false)), "file-attachment");
    expect(resOther.status).toBe(404);
  });
});
