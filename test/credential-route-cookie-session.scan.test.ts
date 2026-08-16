// DEC-027 wave-38 amendment: every credential-bearing registration under
// src/routes/api/** must name requireCookieSession in its Hono middleware
// chain (a bearer token can authenticate as organizer but must never mint,
// reset, or escalate credentials). A DERIVED population (DEC-099), never a
// hand list: a registration is CREDENTIAL-BEARING when its registration/
// handler text contains any capability marker below. stripComments and the
// registration-regex technique are COPIED from
// test/route-authz-enumeration.scan.test.ts (not imported -- that file is
// not owned by this wave) so this scan re-derives the population at test
// time instead of trusting a stale hand-written list.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(ROOT, "src", "routes", "api");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// ---------------------------------------------------------------------------
// stripComments -- copied verbatim from test/route-authz-enumeration.scan.test.ts
// (itself copied from test/file-delete-ordering.scan.test.ts).
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
    if (c === "'" && /[A-Za-z0-9_]/.test(src[i - 1] ?? "")) {
      out += c;
      i++;
      continue;
    }
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
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

function findMatchingParen(src: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) i++;
        i++;
      }
    }
    i++;
  }
  throw new Error(`unbalanced parens starting at index ${openIdx}`);
}

function readStringLiteral(src: string, quoteIdx: number): string {
  const quote = src[quoteIdx];
  let i = quoteIdx + 1;
  let out = "";
  while (i < src.length && src[i] !== quote) {
    if (src[i] === "\\" && i + 1 < src.length) {
      out += src[i + 1];
      i += 2;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

interface RouteReg {
  file: string;
  line: number;
  method: string;
  path: string;
  registrationText: string;
}

const REG_CALL = /\b[A-Za-z_$][\w$]*\.(get|post|put|patch|delete|all)\s*\(/g;

function findRegistrations(file: string, rawSrc: string): RouteReg[] {
  const src = stripComments(rawSrc);
  const out: RouteReg[] = [];
  let match: RegExpExecArray | null;
  REG_CALL.lastIndex = 0;
  while ((match = REG_CALL.exec(src))) {
    const methodGroup = match[1];
    if (!methodGroup) continue;
    const method = methodGroup.toUpperCase();
    const openParenIdx = match.index + match[0].length - 1;
    let j = openParenIdx + 1;
    while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    const q = src[j];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    const path = readStringLiteral(src, j);
    if (!path.startsWith("/")) continue;
    const closeParenIdx = findMatchingParen(src, openParenIdx);
    const registrationText = src.slice(match.index, closeParenIdx + 1);
    const lineIdx = src.slice(0, match.index).split("\n").length - 1;
    out.push({
      file: relative(ROOT, file).split("\\").join("/"),
      line: lineIdx + 1,
      method,
      path,
      registrationText,
    });
  }
  return out;
}

// Capability markers that classify a registration CREDENTIAL-BEARING.
const CAPABILITY_MARKERS = [
  "generatePassword(",
  "updateUserPasswordHash(",
  "hashPassword(",
  "newApiToken(",
  "updateUserRole(",
];

function isCredentialBearing(text: string): boolean {
  return CAPABILITY_MARKERS.some((marker) => text.includes(marker));
}

describe("credential-route-cookie-session.scan (DEC-027 wave-38 amendment)", () => {
  const files: string[] = [];
  walk(ROUTES_ROOT, files);

  const registrations: RouteReg[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    registrations.push(...findRegistrations(file, rawSrc));
  }

  // Capability markers commonly live in the handler body, which sits after
  // the registration's own arg-list close paren but before the next
  // registration in the same file -- an accurate per-registration slice is
  // [registration start, next registration start) within that file,
  // comment-stripped, rather than matching registrationText alone (which
  // only covers the middleware-chain args).
  const byFile = new Map<string, string>();
  for (const file of files) {
    byFile.set(relative(ROOT, file).split("\\").join("/"), stripComments(readFileSync(file, "utf8")));
  }
  const regsByFile = new Map<string, RouteReg[]>();
  for (const reg of registrations) {
    const list = regsByFile.get(reg.file) ?? [];
    list.push(reg);
    regsByFile.set(reg.file, list);
  }

  const derivedCredentialBearing: RouteReg[] = [];
  for (const [file, regs] of regsByFile) {
    const src = byFile.get(file)!;
    const starts = regs
      .map((r) => ({ reg: r, idx: src.indexOf(r.registrationText) }))
      .sort((a, b) => a.idx - b.idx);
    for (let i = 0; i < starts.length; i++) {
      const cur = starts[i]!;
      const nextIdx = i + 1 < starts.length ? starts[i + 1]!.idx : src.length;
      const slice = src.slice(cur.idx, nextIdx);
      if (isCredentialBearing(slice)) derivedCredentialBearing.push(cur.reg);
    }
  }

  it("tripwire: derived population has at least 4 members", () => {
    expect(derivedCredentialBearing.length).toBeGreaterThanOrEqual(4);
  });

  it("tripwire: derived population contains the four named routes", () => {
    const keys = derivedCredentialBearing.map((r) => `${r.method} ${r.path}`);
    expect(keys).toContain("POST /api/v1/users");
    expect(keys).toContain("POST /api/v1/users/:id/reset-password");
    expect(keys).toContain("PATCH /api/v1/users/:id");
    expect(keys).toContain("POST /api/v1/tokens");
  });

  it("negative control: derived population does NOT contain POST /api/v1/contacts", () => {
    const keys = derivedCredentialBearing.map((r) => `${r.method} ${r.path}`);
    expect(keys).not.toContain("POST /api/v1/contacts");
  });

  it("every credential-bearing registration names requireCookieSession", () => {
    const gaps: string[] = [];
    for (const reg of derivedCredentialBearing) {
      if (!/\brequireCookieSession\b/.test(reg.registrationText)) {
        gaps.push(`${reg.file}:${reg.line} ${reg.method} ${reg.path}`);
      }
    }
    expect(gaps, `credential-bearing registrations missing requireCookieSession:\n${gaps.join("\n")}`).toEqual([]);
  });
});

// =============================================================================
// DEC-027 wave-70 amendment: requireCookieSession's own comment
// (src/server/middleware.ts:263-281) calls itself "the ONE assembler" of the
// bearer-escalation refusal, "placed on every credential-bearing route" --
// wave-38's scan above only ever checked src/routes/api/**, so that claim was
// never checked against the rest of src/routes/** (the plain-HTML-form doors:
// account.tsx, auth-login.tsx, auth-claim.tsx, auth-reset.tsx). This section
// widens the population to ALL of src/routes/**, using the three primitives a
// credential MINT or ROTATION actually performs (hashPassword(,
// issueSessionRevokingAll(, buildSessionCookie() rather than wave-38's
// capability-marker list (which is api/**-specific: newApiToken(,
// updateUserRole(, ...). Reuses this file's own stripComments/walk/
// findMatchingParen helpers above rather than a second copy.
// =============================================================================

const ALL_ROUTES_ROOT = join(ROOT, "src", "routes");

// The three primitives a credential MINT or ROTATION performs. A route
// module whose stripped source calls any of these is, by construction, a
// credential-bearing route -- the population this section checks.
const CREDENTIAL_PRIMITIVES = ["hashPassword(", "issueSessionRevokingAll(", "buildSessionCookie("];

// DEC-027 wave-70: the exemption list is CLOSED. A fourth entry needs a
// written justification added directly to this record (and reflected in the
// comment below) -- it must never be extended by simply adding a file name.
const UNAUTHENTICATED_DOORS: Record<string, string> = {
  "src/routes/auth-login.tsx":
    "the login door itself -- runs with no c.var.auth at all (it is the credential MINT, not a rotation by an already-authenticated principal); requireCookieSession's refusal ('not a signed-in session') is unreachable with no session to reject",
  "src/routes/auth-claim.tsx":
    "account-claim: the 'auth' is possession of an unguessable KV claim token, not a session -- there is no c.var.auth yet for requireCookieSession to inspect",
  "src/routes/auth-reset.tsx":
    "password-reset: the 'auth' is possession of an unguessable KV reset token, not a session -- same no-session model as auth-claim.tsx",
};

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

describe("credential-route-cookie-session.scan (DEC-027 wave-70 amendment: whole-tree population)", () => {
  const files: string[] = [];
  walk(ALL_ROUTES_ROOT, files);

  const credentialFiles: string[] = [];
  for (const file of files) {
    const stripped = stripComments(readFileSync(file, "utf8"));
    if (CREDENTIAL_PRIMITIVES.some((p) => stripped.includes(p))) {
      credentialFiles.push(file);
    }
  }

  it("tripwire: the credential-primitive scan doesn't silently collapse to zero files", () => {
    expect(credentialFiles.length).toBeGreaterThanOrEqual(3);
  });

  it("every credential-bearing route file guards each mutating (.post/.patch/.put/.delete) registration with requireCookieSession, or is a declared UNAUTHENTICATED_DOOR", () => {
    const gaps: string[] = [];
    for (const file of credentialFiles) {
      const relFile = relative(ROOT, file).split("\\").join("/");
      if (relFile in UNAUTHENTICATED_DOORS) continue;
      const rawSrc = readFileSync(file, "utf8");
      const regs = findRegistrations(file, rawSrc).filter((r) => MUTATING_METHODS.has(r.method));
      for (const reg of regs) {
        if (!/\brequireCookieSession\b/.test(reg.registrationText)) {
          gaps.push(`${reg.file}:${reg.line} ${reg.method} registration is missing requireCookieSession`);
        }
      }
    }
    expect(
      gaps,
      `credential-bearing registrations with no requireCookieSession guard (add the guard, or -- only with a written reason -- add the file to UNAUTHENTICATED_DOORS):\n${gaps.join("\n")}`,
    ).toEqual([]);
  });

  it("UNAUTHENTICATED_DOORS is exactly the three declared no-session credential-mint routes, each with a written reason", () => {
    expect(Object.keys(UNAUTHENTICATED_DOORS).sort()).toEqual(
      ["src/routes/auth-claim.tsx", "src/routes/auth-login.tsx", "src/routes/auth-reset.tsx"].sort(),
    );
    for (const [file, reason] of Object.entries(UNAUTHENTICATED_DOORS)) {
      expect(reason.length, `${file}'s UNAUTHENTICATED_DOORS entry must carry a written reason`).toBeGreaterThan(20);
    }
  });

  it("UNAUTHENTICATED_DOORS has no stale entries (every door file is still in the credential-primitive population)", () => {
    const credentialRelFiles = new Set(credentialFiles.map((f) => relative(ROOT, f).split("\\").join("/")));
    const stale = Object.keys(UNAUTHENTICATED_DOORS).filter((f) => !credentialRelFiles.has(f));
    expect(
      stale,
      `stale UNAUTHENTICATED_DOORS entries (delete these lines -- file no longer calls a credential primitive):\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  it("negative control: a synthetic registration naming no requireCookieSession is caught as a gap", () => {
    const synthetic = 'app.post("/__synthetic__", requireOrganizer, csrfJson, async (c) => c.json({}))';
    const regs = findRegistrations("src/routes/__synthetic__.ts", synthetic).filter((r) => MUTATING_METHODS.has(r.method));
    expect(regs).toHaveLength(1);
    expect(/\brequireCookieSession\b/.test(regs[0]!.registrationText)).toBe(false);
  });

  it("positive control: a synthetic registration naming requireCookieSession passes", () => {
    const synthetic = 'app.post("/__synthetic__", requireOrganizer, requireCookieSession, csrfJson, async (c) => c.json({}))';
    const regs = findRegistrations("src/routes/__synthetic__.ts", synthetic).filter((r) => MUTATING_METHODS.has(r.method));
    expect(regs).toHaveLength(1);
    expect(/\brequireCookieSession\b/.test(regs[0]!.registrationText)).toBe(true);
  });

  it("known population: src/routes/account.tsx and src/routes/api/users.ts are credential-bearing and are not declared doors", () => {
    const relFiles = credentialFiles.map((f) => relative(ROOT, f).split("\\").join("/"));
    expect(relFiles).toContain("src/routes/account.tsx");
    expect(relFiles).toContain("src/routes/api/users.ts");
    expect("src/routes/account.tsx" in UNAUTHENTICATED_DOORS).toBe(false);
    expect("src/routes/api/users.ts" in UNAUTHENTICATED_DOORS).toBe(false);
  });
});
