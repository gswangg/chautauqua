import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * DEC-451 (Amendment, wave 23): the scoping invariant is two-sided. SPEC §6
 * requires object-level ownership checks on every fetch-by-id (no IDOR) in a
 * schema that is org-keyed for a single-org-per-deployment app. DEC-450's
 * shipped bug (four unscoped reads in src/sync/airtable.ts) got a read-side
 * scanner (test/query-scoping-invariant.test.ts) -- but nothing has ever
 * asserted the write side. An unscoped `db.update(schema.X)` or
 * `db.delete(schema.X)` is strictly worse than an unscoped read in a
 * multi-tenant app: it doesn't just leak another org's rows, it mutates or
 * destroys them. This file is that write-side twin, built on the same
 * walker and the same top-level-chain rules as the read scanner (DEC-451),
 * bound to `.update(`/`.delete(` chains instead of `.select(`.
 *
 * Rule: every `db.update(schema.X)` / `db.delete(schema.X)` chain under
 * src/** whose own statement reaches a bare top-level `;` must contain a
 * `.where(` somewhere in that chain.
 *
 * Deliberately excluded (not bugs, must not trip the scanner) -- identical
 * to DEC-451's read-side exclusions, carried over verbatim in shape:
 *  - Chains nested as *arguments* to another call (e.g. passed into a
 *    helper, or inside a callback) terminate in `)` or `,`, never a bare
 *    top-level `;`, so the walker never flags them -- it only flags chains
 *    whose own terminator is `;`.
 *  - `.as(...)` subquery builders -- not applicable to update/delete in
 *    practice, but carried over for shape-parity with the read scanner and
 *    in case a future Drizzle usage introduces one.
 *  - A query builder assigned to `const NAME = db.update(...)` /
 *    `db.delete(...)` whose *own* statement has no `.where(`, but which is
 *    unconditionally or conditionally extended later in the same file via
 *    `NAME.where(` (the same builder-then-filter escape hatch DEC-451
 *    documents for reads).
 *
 * This is deliberately a presence-of-WHERE invariant, not an
 * ownership-predicate invariant -- the codebase's convention is
 * load-then-write behind an org-scoped requireOwned* guard, and a text scan
 * cannot decide that a delegate guard is real ("ALLOW-LIST REASON NAMING A
 * DELEGATE IS A CLAIM" -- field guide). It only proves a `.where(` exists in
 * the chain, not that the where clause is correct.
 *
 * src/server/auth-session.ts is deliberately left to wave 22's own, narrower
 * scan over `delete(schema.authSession)` -- this scanner still walks that
 * file (it is under src/**) and will still assert `.where(` presence on any
 * matching chain there; the two scans assert the same thing on overlapping
 * territory by design and do not conflict.
 */

const SRC_ROOT = join(__dirname, "..", "src");

// Allowlist for deliberate, reviewed exceptions to the invariant below.
// Entries are `${relativePath}#${enclosingFunctionName}` so an entry names
// exactly which write is exempted, not a whole file. Adding an entry here is
// a deliberate, reviewed act, not a place to silence a scanner that just
// caught a real bug. Expect this to be empty -- that is a valid, load-bearing
// result of this scan, not a reason to weaken the rule.
const UNSCOPED_WRITE_ALLOWLIST: string[] = [];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

interface ChainResult {
  file: string;
  startIndex: number;
  kind: "update" | "delete";
  methods: string[];
  terminator: string;
  targetsSchema: boolean;
  enclosingFunction: string;
}

/**
 * Walks forward from the index right after a balanced `(...)` call's
 * closing paren, consuming `.method(...)` fluent-chain segments (each of
 * whose own parens are balanced independently, so nested calls are
 * swallowed whole and never mistaken for a sibling top-level segment).
 * Returns once the next non-whitespace character is not `.`, along with
 * what that terminating character was. Identical in shape to
 * test/query-scoping-invariant.test.ts's walkChain (DEC-451).
 */
function walkChain(
  source: string,
  afterCallEnd: number,
): { end: number; methods: string[]; terminator: string } {
  let i = afterCallEnd;
  const methods: string[] = [];
  for (;;) {
    while (i < source.length && /\s/.test(source[i] as string)) i++;
    const rest = source.slice(i);
    const m = rest.match(/^\.(\w+)\s*\(/);
    if (!m) {
      return { end: i, methods, terminator: source[i] ?? "" };
    }
    const methodName = m[1] as string;
    const parenStart = i + m[0].length - 1;
    let depth = 1;
    let j = parenStart + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "(") depth++;
      else if (source[j] === ")") depth--;
      j++;
    }
    methods.push(methodName);
    i = j;
  }
}

/** Nearest preceding `const|let NAME =` immediately before a `db`/receiver
 * expression, so a chain assigned to a variable can be checked for a later
 * `NAME.where(` reference (the deferred-scoping builder pattern). */
function assignedIdentifier(source: string, matchIndex: number): string | null {
  const before = source.slice(Math.max(0, matchIndex - 200), matchIndex);
  const m = before.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?[\w.]*\s*$/);
  return m ? (m[1] as string) : null;
}

/** Nearest enclosing `function NAME(` (incl. `export async function`) before
 * a given index -- used purely to name the allowlist entry precisely. */
function enclosingFunctionName(source: string, index: number): string {
  const before = source.slice(0, index);
  const matches = [...before.matchAll(/function\s+(\w+)\s*\(/g)];
  const last = matches[matches.length - 1];
  return last ? (last[1] as string) : "(module scope)";
}

function findUnscopedWrites(source: string, file: string): ChainResult[] {
  const offenders: ChainResult[] = [];
  const writeRe = /\.(update|delete)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = writeRe.exec(source)) !== null) {
    const kind = match[1] as "update" | "delete";
    const parenStart = match.index + match[0].length - 1;
    let depth = 1;
    let j = parenStart + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "(") depth++;
      else if (source[j] === ")") depth--;
      j++;
    }
    const argText = source.slice(parenStart + 1, j - 1);
    const targetsSchema = /^\s*schema\.\w+/.test(argText);
    if (!targetsSchema) continue; // not a `.update(schema.X)`/`.delete(schema.X)` chain

    const { methods, terminator } = walkChain(source, j);
    if (methods.includes("as")) continue; // subquery builder -- excluded, shape-parity with read scanner
    if (terminator !== ";") continue; // nested inside another call's args -- not a top-level statement
    if (methods.includes("where")) continue; // scoped in this chain

    // Deferred-scoping builder pattern: `const NAME = db.update(...)` with
    // no `.where(` of its own, but `NAME.where(` appears later in the file.
    const ident = assignedIdentifier(source, match.index);
    if (ident) {
      const laterWhere = new RegExp(`\\b${ident}\\.where\\(`);
      if (laterWhere.test(source.slice(j))) continue;
    }

    offenders.push({
      file,
      startIndex: match.index,
      kind,
      methods,
      terminator,
      targetsSchema,
      enclosingFunction: enclosingFunctionName(source, match.index),
    });
  }
  return offenders;
}

function relativePath(file: string): string {
  return file.slice(join(__dirname, "..").length + 1);
}

describe("write-scoping-invariant scan negative control (DEC-518 wave-35 amendment)", () => {
  // findUnscopedWrites(source, file) is already the pure predicate the
  // repo-wide walk above feeds every file through -- these tests feed it
  // synthetic snippets directly, proving it can both fail and pass.
  it("VIOLATION: a top-level .update(schema.X) chain with no .where( is reported", () => {
    const src = "async function bad() { db.update(schema.foo).set({ x: 1 }); }";
    const offenders = findUnscopedWrites(src, "src/fixture.ts");
    expect(offenders.length).toBe(1);
    expect(offenders[0]?.kind).toBe("update");
    expect(offenders[0]?.enclosingFunction).toBe("bad");
  });

  it("VIOLATION: a top-level .delete(schema.X) chain with no .where( is reported", () => {
    const src = "async function bad() { db.delete(schema.foo); }";
    const offenders = findUnscopedWrites(src, "src/fixture.ts");
    expect(offenders.length).toBe(1);
    expect(offenders[0]?.kind).toBe("delete");
  });

  it("COMPLIANT: a .where(-scoped chain is silent", () => {
    const src = "async function ok() { db.update(schema.foo).set({ x: 1 }).where(eq(schema.foo.id, id)); }";
    expect(findUnscopedWrites(src, "src/fixture.ts")).toEqual([]);
  });

  it("COMPLIANT: a chain nested as an argument (never reaches a top-level ';') is silent", () => {
    const src = "async function ok() { await run(db.update(schema.foo).set({ x: 1 })); }";
    expect(findUnscopedWrites(src, "src/fixture.ts")).toEqual([]);
  });
});

describe("write-scoping invariant: every top-level update(schema.X)/delete(schema.X) is .where()-scoped", () => {
  const files = listTsFiles(SRC_ROOT);
  const allOffenders: ChainResult[] = [];
  let totalWriteChains = 0;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const offenders = findUnscopedWrites(source, file);
    allOffenders.push(...offenders);

    // sanity-check counter: count every `.update(schema.`/`.delete(schema.`
    // occurrence regardless of scoping, so the "finds enough chains" check
    // below can't pass vacuously if the walker itself is broken (counts
    // MATCHES, not files -- "TRIPWIRE COUNTING FILES != COUNTING MATCHES").
    totalWriteChains += (source.match(/\.(update|delete)\(\s*schema\.\w+/g) ?? []).length;
  }

  it("finds at least 110 update(schema.X)/delete(schema.X) chains across src/ (scanner sanity check)", () => {
    expect(totalWriteChains).toBeGreaterThanOrEqual(110);
  });

  it("allowlist stays small (>5 entries means the scanner is being used to silence real bugs, not review deliberate exceptions)", () => {
    expect(UNSCOPED_WRITE_ALLOWLIST.length).toBeLessThanOrEqual(5);
  });

  it("every unscoped write chain is either fixed or deliberately allowlisted", () => {
    const unowned = allOffenders.filter(
      (o) => !UNSCOPED_WRITE_ALLOWLIST.includes(`${relativePath(o.file)}#${o.enclosingFunction}`),
    );
    if (unowned.length > 0) {
      const details = unowned
        .map(
          (o) =>
            `  ${relativePath(o.file)}#${o.enclosingFunction} (offset ${o.startIndex}): ${o.kind}(schema.X) ` +
            `chain reaches its terminating ';' with no '.where(' anywhere between -- methods seen: ` +
            `[${o.methods.join(", ")}]. Either add a .where(...) that scopes this write (e.g. by orgId/eventId), ` +
            `or, if this write is deliberately unscoped, add "${relativePath(o.file)}#${o.enclosingFunction}" to ` +
            `UNSCOPED_WRITE_ALLOWLIST in test/write-scoping-invariant.scan.test.ts with a comment explaining why.`,
        )
        .join("\n");
      throw new Error(`Found ${unowned.length} unscoped top-level write(s):\n${details}`);
    }
    expect(unowned).toEqual([]);
  });

  it("allowlist has no stale entries (an entry matching no live unscoped chain must be deleted)", () => {
    const liveKeys = new Set(allOffenders.map((o) => `${relativePath(o.file)}#${o.enclosingFunction}`));
    const stale = UNSCOPED_WRITE_ALLOWLIST.filter((entry) => !liveKeys.has(entry));
    if (stale.length > 0) {
      throw new Error(
        `Stale allowlist entries (no matching unscoped write found -- delete these lines from ` +
          `UNSCOPED_WRITE_ALLOWLIST):\n${stale.map((s) => `  ${s}`).join("\n")}`,
      );
    }
    expect(stale).toEqual([]);
  });
});
