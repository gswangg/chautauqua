import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * DEC-451: every Drizzle read chain that starts `select(...).from(schema.X)`
 * and reaches its own terminating `;` (i.e. it is a genuine top-level
 * statement, not an argument nested inside some other call) must contain a
 * `.where(` somewhere in that chain. An org-scoped multi-tenant app has no
 * legitimate unscoped top-level read of a schema table -- an unscoped read
 * is exactly the class of bug DEC-450 fixed in src/sync/airtable.ts (four
 * selects that read every org's rows).
 *
 * This scanner works on source text (like test/d1-bind-safety.test.ts), not
 * on a live db fake, because the bug class is "the `.where(` call is
 * missing from the chain" -- something no runtime fake with seeded
 * single-org fixtures would ever surface.
 *
 * Deliberately excluded (not bugs, must not trip the scanner):
 *  - Subqueries passed as *arguments* to another call, e.g.
 *    `exists(db.select()...from(...).where(...))` or
 *    `.from(db.select()...as("sub"))`. These chains terminate in `)` or `,`
 *    (the enclosing call's own paren), never a bare top-level `;`, so the
 *    walker below never flags them -- it only flags chains whose own
 *    terminator is `;`.
 *  - `.as(...)` subquery builders assigned to a `const`, e.g.
 *    `const sub = db.select()...from(...).as("sub");` -- these *do*
 *    terminate in `;` but are subquery definitions, not reads that return
 *    rows directly to the caller, so a chain containing `.as(` is excluded
 *    outright regardless of terminator.
 *  - Chains ending in `.groupBy(`/`.limit(`/`.orderBy(` that also contain
 *    `.where(` are fine -- the walker records every top-level chain method
 *    by name and only fails when `where` is absent from that list, so a
 *    trailing `.limit(1)` etc. never matters on its own.
 *  - A query builder assigned to `const NAME = db.select()...from(...)`
 *    whose *own* statement has no `.where(`, but which is unconditionally
 *    or conditionally extended later in the same file via `NAME.where(`
 *    (src/server/repo/email.ts's `base`/`countBase` builder-then-filter
 *    pattern: `const filtered = where ? base.where(where) : base;`). The
 *    scoping call is real, it just isn't part of the same fluent chain
 *    textually -- so we look for a later `IDENT.where(` reference to the
 *    same assigned identifier before treating the chain as unscoped.
 */

const SRC_ROOT = join(__dirname, "..", "src");

// DEC-451: allowlist for deliberate, reviewed exceptions to the invariant
// below. Entries are `${relativePath}#${enclosingFunctionName}` so an
// allowlist entry names exactly which read is exempted, not a whole file.
// Adding an entry here is a deliberate, reviewed act, not a place to
// silence a scanner that just caught a real bug.
//
// src/server/repo/events.ts#getFirstEventSlug is intentionally global: it
// backs the unauthenticated "/" landing page (src/routes/root.tsx), which
// has no org/session context to scope by, and it returns only a public
// routing slug (no tenant data) used to build demo CTA links.
const GLOBAL_READ_ALLOWLIST: string[] = ["src/server/repo/events.ts#getFirstEventSlug"];

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
  methods: string[];
  terminator: string;
  targetsSchema: boolean;
  enclosingFunction: string;
}

/**
 * Walks forward from the index right after a balanced `(...)` call's
 * closing paren, consuming `.method(...)` fluent-chain segments (each of
 * whose own parens are balanced independently, so nested calls -- including
 * nested `select()` subqueries -- are swallowed whole and never mistaken for
 * a sibling top-level segment). Returns once the next non-whitespace
 * character is not `.`, along with what that terminating character was.
 */
function walkChain(
  source: string,
  afterSelectCallEnd: number,
): { end: number; methods: string[]; terminator: string; targetsSchema: boolean } {
  let i = afterSelectCallEnd;
  const methods: string[] = [];
  let targetsSchema = false;
  for (;;) {
    // skip whitespace (chains may wrap across lines)
    while (i < source.length && /\s/.test(source[i] as string)) i++;
    const rest = source.slice(i);
    const m = rest.match(/^\.(\w+)\s*\(/);
    if (!m) {
      // the next non-whitespace char is the terminator
      return { end: i, methods, terminator: source[i] ?? "", targetsSchema };
    }
    const methodName = m[1] as string;
    const parenStart = i + m[0].length - 1; // index of the '('
    let depth = 1;
    let j = parenStart + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "(") depth++;
      else if (source[j] === ")") depth--;
      j++;
    }
    const argText = source.slice(parenStart + 1, j - 1);
    if (methodName === "from" && /^\s*schema\.\w+/.test(argText)) targetsSchema = true;
    methods.push(methodName);
    i = j;
  }
}

/** Nearest preceding `const|let NAME =` immediately before a `db`/receiver
 * expression, so a chain assigned to a variable can be checked for a later
 * `NAME.where(` reference (the deferred-scoping builder pattern). */
function assignedIdentifier(source: string, selectMatchIndex: number): string | null {
  const before = source.slice(Math.max(0, selectMatchIndex - 200), selectMatchIndex);
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

function findUnscopedSelects(source: string, file: string): ChainResult[] {
  const offenders: ChainResult[] = [];
  const selectRe = /\.select\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = selectRe.exec(source)) !== null) {
    const parenStart = match.index + match[0].length - 1;
    let depth = 1;
    let j = parenStart + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "(") depth++;
      else if (source[j] === ")") depth--;
      j++;
    }
    const { methods, terminator, targetsSchema } = walkChain(source, j);
    if (!targetsSchema) continue; // not a `.from(schema.X)` chain -- e.g. `.from(subquery)`
    if (methods.includes("as")) continue; // subquery builder assigned to a const -- excluded
    if (terminator !== ";") continue; // nested inside another call's args (exists(), .from(sub)) -- not a top-level statement
    if (methods.includes("where")) continue; // scoped in this chain

    // Deferred-scoping builder pattern: `const NAME = db.select()...` with
    // no `.where(` of its own, but `NAME.where(` appears later in the file.
    const ident = assignedIdentifier(source, match.index);
    if (ident) {
      const laterWhere = new RegExp(`\\b${ident}\\.where\\(`);
      if (laterWhere.test(source.slice(j))) continue;
    }

    offenders.push({
      file,
      startIndex: match.index,
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

describe("query-scoping invariant: every top-level select().from(schema.X) is .where()-scoped", () => {
  const files = listTsFiles(SRC_ROOT);
  const allOffenders: ChainResult[] = [];
  let totalFromSchemaChains = 0;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const offenders = findUnscopedSelects(source, file);
    allOffenders.push(...offenders);

    // sanity-check counter: count every `.from(schema.` occurrence regardless
    // of scoping, so the "finds enough chains" check below can't pass
    // vacuously if the walker itself is broken.
    totalFromSchemaChains += (source.match(/\.from\(\s*schema\.\w+/g) ?? []).length;
  }

  it("finds at least 30 select().from(schema.X) chains across src/ (scanner sanity check)", () => {
    expect(totalFromSchemaChains).toBeGreaterThanOrEqual(30);
  });

  it("every unscoped chain is either fixed or deliberately allowlisted", () => {
    const unowned = allOffenders.filter(
      (o) => !GLOBAL_READ_ALLOWLIST.includes(`${relativePath(o.file)}#${o.enclosingFunction}`),
    );
    if (unowned.length > 0) {
      const details = unowned
        .map(
          (o) =>
            `  ${relativePath(o.file)}#${o.enclosingFunction} (offset ${o.startIndex}): select().from(schema.X) ` +
            `chain reaches its terminating ';' with no '.where(' anywhere between -- methods seen: ` +
            `[${o.methods.join(", ")}]. Either add a .where(...) that scopes this read (e.g. by orgId/eventId), ` +
            `or, if this read is deliberately unscoped, add "${relativePath(o.file)}#${o.enclosingFunction}" to ` +
            `GLOBAL_READ_ALLOWLIST in test/query-scoping-invariant.test.ts with a comment explaining why.`,
        )
        .join("\n");
      throw new Error(`Found ${unowned.length} unscoped top-level read(s):\n${details}`);
    }
    expect(unowned).toEqual([]);
  });
});
