// DEC-949 (wave 43 amendment): the set of user.password_hash writers is
// DERIVED, not a hand-listed trio. Every site in src/** that writes the
// user password column must revoke the target user's outstanding
// password-reset grant (revokeResetTokenForUser / consumeResetToken), or be
// named in a closed, reason-bearing WRITER_WITHOUT_REVOKE ledger. The
// population is re-derived at test time by a source scan, exactly the shape
// test/route-authz-enumeration.scan.test.ts pioneered for route authz -- read
// that file before touching this one.
//
// Two site shapes count as a "writer":
//   (1) `updateUserPasswordHash(` call sites -- this also matches the
//       function's own definition in src/server/repo/users.ts, which is why
//       that file gets a ledger entry rather than a revoke call of its own.
//   (2) `db.update(schema.user)...set({...passwordHash...})` statements --
//       covers the two direct-write routes (src/routes/account.tsx,
//       src/routes/auth-reset.tsx) plus the repo helper's own body.
//
// The ledger is two-directional: a ledger row matching no live writer site
// fails as stale ("delete this ledger line").

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// ---------------------------------------------------------------------------
// stripComments -- copied verbatim from test/route-authz-enumeration.scan.test.ts
// (itself copied from test/file-delete-ordering.scan.test.ts), so line
// numbers stay accurate (length-preserving: comments become spaces, newlines
// inside block comments are kept as newlines).
// ---------------------------------------------------------------------------
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    // Amendment to the copied stripComments: a bare `'` preceded by a word
    // character is an English contraction inside raw JSX text, not a string
    // literal opener.
    if (c === "'" && /[A-Za-z0-9_]/.test(src[i - 1] ?? "")) {
      out += c;
      i++;
      continue;
    }
    // Amendment to the copied stripComments: a regex literal can contain
    // quote/paren characters that are not string/paren syntax -- neutralize
    // its interior to `x` so it never registers as string/paren syntax.
    if (c === "/" && c2 !== "/" && c2 !== "*") {
      const prevSignificant = out.trimEnd().slice(-1);
      const isRegexContext = prevSignificant === "" || "(,=:[!&|?;{+-*%^~".includes(prevSignificant);
      if (isRegexContext) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < n && src[j] !== "\n") {
          if (src[j] === "\\" && j + 1 < n) {
            j += 2;
            continue;
          }
          if (src[j] === "[") {
            inClass = true;
            j++;
            continue;
          }
          if (src[j] === "]") {
            inClass = false;
            j++;
            continue;
          }
          if (src[j] === "/" && !inClass) {
            j++;
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          while (j < n && /[a-z]/i.test(src[j] ?? "")) j++;
          out += "x".repeat(j - i);
          i = j;
          continue;
        }
      }
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

interface WriterSite {
  file: string; // repo-relative path
  line: number; // 1-indexed
  kind: "updateUserPasswordHash-call" | "db.update(schema.user).set(passwordHash)";
}

const UPDATE_CALL_RE = /\bupdateUserPasswordHash\s*\(/g;
// `.set({ passwordHash, ... })` / `.set({ ...other, passwordHash: x })` --
// every live site keeps a flat, non-nested object literal in `.set(...)`, so
// a non-greedy match up to the first `}` is sufficient (and re-verified by
// the negative control below).
const DB_UPDATE_USER_SET_RE = /\bdb\.update\(schema\.user\)\s*\.set\(\{[^}]*\}/g;

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

/** Pure classifier: finds every writer site in a single (already
 * comment-stripped) source string. Exported implicitly via the describe
 * block below reusing this exact function for both the real tree and the
 * negative-control synthetic string -- one copy of the logic, no drift. */
function findWriterSites(fileLabel: string, strippedSrc: string): WriterSite[] {
  const out: WriterSite[] = [];
  let m: RegExpExecArray | null;
  UPDATE_CALL_RE.lastIndex = 0;
  while ((m = UPDATE_CALL_RE.exec(strippedSrc))) {
    out.push({ file: fileLabel, line: lineOf(strippedSrc, m.index), kind: "updateUserPasswordHash-call" });
  }
  DB_UPDATE_USER_SET_RE.lastIndex = 0;
  while ((m = DB_UPDATE_USER_SET_RE.exec(strippedSrc))) {
    if (!/\bpasswordHash\b/.test(m[0])) continue;
    out.push({ file: fileLabel, line: lineOf(strippedSrc, m.index), kind: "db.update(schema.user).set(passwordHash)" });
  }
  return out;
}

const REVOKE_MARKER = /\b(revokeResetTokenForUser|consumeResetToken)\b/;

interface LedgerEntry {
  file: string;
  reason: string;
}

// Closed ledger. Today the only legitimate entry is the repo helper's own
// definition -- every caller of updateUserPasswordHash is itself scanned, so
// the helper doesn't need to (and structurally cannot cleanly) call the
// revoke itself without knowing whether the caller already did.
const WRITER_WITHOUT_REVOKE: LedgerEntry[] = [
  { file: "src/server/repo/users.ts", reason: "repo helper, not a route — every caller is itself scanned" },
];

/** True when `file` is exempted by the closed ledger. */
function ledgerCovers(file: string): boolean {
  return WRITER_WITHOUT_REVOKE.some((e) => e.file === file);
}

describe("password-hash-writer-family.scan (DEC-949 wave 43 amendment)", () => {
  const files: string[] = [];
  walk(SRC_ROOT, files);

  // file -> stripped source, computed once.
  const strippedByFile = new Map<string, string>();
  const sites: WriterSite[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file).split("\\").join("/");
    const raw = readFileSync(file, "utf8");
    const stripped = stripComments(raw);
    strippedByFile.set(rel, stripped);
    sites.push(...findWriterSites(rel, stripped));
  }

  it("tripwire: the scan finds at least 3 writer sites (regex hasn't quietly shrunk to nothing)", () => {
    expect(sites.length).toBeGreaterThanOrEqual(3);
  });

  it("every writer site's enclosing file references a revoke, or is named in the closed ledger", () => {
    const gaps: string[] = [];
    for (const site of sites) {
      const stripped = strippedByFile.get(site.file)!;
      const fileRevokes = REVOKE_MARKER.test(stripped);
      if (fileRevokes) continue;
      if (ledgerCovers(site.file)) continue;
      gaps.push(`${site.file}:${site.line} (${site.kind})`);
    }
    expect(
      gaps,
      `password_hash writer sites with no revoke reference in the enclosing file and no WRITER_WITHOUT_REVOKE ledger row:\n${gaps.join("\n")}`,
    ).toEqual([]);
  });

  it("WRITER_WITHOUT_REVOKE ledger has no stale entries (every row matches a live writer site)", () => {
    const liveFiles = new Set(sites.map((s) => s.file));
    const stale = WRITER_WITHOUT_REVOKE.filter((e) => !liveFiles.has(e.file));
    expect(stale, `stale WRITER_WITHOUT_REVOKE entries (delete these lines -- no matching live writer site):\n${JSON.stringify(stale)}`).toEqual(
      [],
    );
  });

  it("sanity: known writer sites are present (route file + repo helper)", () => {
    const fileSet = new Set(sites.map((s) => s.file));
    expect(fileSet.has("src/routes/api/users.ts")).toBe(true);
    expect(fileSet.has("src/server/repo/users.ts")).toBe(true);
    expect(fileSet.has("src/routes/account.tsx")).toBe(true);
    expect(fileSet.has("src/routes/auth-reset.tsx")).toBe(true);
  });
});

describe("findWriterSites negative control (synthetic source)", () => {
  it("a passwordHash write with no revoke reference in the same file is reported as a gap", () => {
    const synthFile = "src/routes/__synthetic__.ts";
    const synthSrc = stripComments(`
      export async function reissue(db, userId, passwordHash) {
        // no revokeResetTokenForUser / consumeResetToken anywhere in this file
        await db.update(schema.user).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.user.id, userId));
      }
    `);
    const found = findWriterSites(synthFile, synthSrc);
    expect(found.length).toBeGreaterThanOrEqual(1);

    // Run the same classification the real scan runs above.
    const fileRevokes = REVOKE_MARKER.test(synthSrc);
    expect(fileRevokes).toBe(false);
    expect(ledgerCovers(synthFile)).toBe(false);
    // i.e. this synthetic site WOULD be reported as a gap by the real test.
  });

  it("the same synthetic source WITH a revoke reference is not flagged", () => {
    const synthFile = "src/routes/__synthetic_ok__.ts";
    const synthSrc = stripComments(`
      import { revokeResetTokenForUser } from "../auth/password-reset";
      export async function reissue(db, kv, userId, passwordHash) {
        await revokeResetTokenForUser(kv, userId);
        await db.update(schema.user).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.user.id, userId));
      }
    `);
    const found = findWriterSites(synthFile, synthSrc);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(REVOKE_MARKER.test(synthSrc)).toBe(true);
  });

  it("updateUserPasswordHash( call sites are found independently of the db.update(...).set(...) shape", () => {
    const stripped = stripComments(`await repo.updateUserPasswordHash(c.var.db, target.id, passwordHash);`);
    const found = findWriterSites("src/__synth__.ts", stripped);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe("updateUserPasswordHash-call");
  });
});
