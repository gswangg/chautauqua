import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * DEC-558 (wave 73 amendment): name the population where SQLite, not the
 * code, picks the row.
 *
 * `.limit(1)` is only safe when the underlying `.where(...)` predicate
 * already narrows the candidate set to at most one row *by construction*
 * (a primary-key equality) -- or when the chain carries an explicit
 * `.orderBy(...)` that gives SQLite a total order to pick the "first" row
 * from deterministically. Absent either of those, `.limit(1)` hands the
 * choice of *which* row survives to SQLite's unspecified row order, which
 * is exactly the bug class that produced two real defects:
 *
 *  - DEC-248 (wave 70): `getTaskFileScope`'s `or(...)` + `.limit(1)` with no
 *    `.orderBy(` let SQLite decide which speaker could download a task file.
 *    Now fixed at src/server/repo/files-authz.ts:330-385.
 *  - DEC-456 (wave 71): `findAccountUserId` picked arbitrarily between a
 *    contact-linked and an email-matching user with no total order either.
 *
 * This scanner does NOT fix any of the flagged sites -- each one's
 * resolution (add an `.orderBy(...)` that totally orders the candidate set,
 * or write down why exactly one row is unambiguous, citing the DEC) is a
 * per-site ruling a later wave makes with this list in hand. This wave only
 * NAMES the population and ratchets a ceiling so the count can only shrink.
 *
 * Chain-walking technique: modelled on test/query-scoping-invariant.test.ts
 * (read that file first). That scanner starts from `.select(` and walks
 * *forward* through a fluent chain to its terminator. This scanner instead
 * starts from a `.limit(1)` occurrence and walks *outward* (both backward
 * and forward) tracking paren depth to find the bounds of the top-level
 * statement it belongs to:
 *
 *  - Walking backward from the `.limit(1)` match, `)` deepens and `(`
 *    shallows the (backward) paren depth. Hitting an unmatched `(` (depth
 *    would go negative) means the match sits inside another call's
 *    arguments -- e.g. a subquery passed to `exists(...)` or `.from(...)`
 *    -- so it is NOT a top-level chain and is excluded outright. Otherwise
 *    the backward walk stops at the nearest top-level `;`, `{`, or `}`,
 *    which is the start of the enclosing statement.
 *  - Walking forward symmetrically finds the statement's own terminating
 *    `;` (top-level) or an unmatched `)` (nested inside an enclosing call,
 *    also excluded).
 *
 * Only chains whose bounds are found with BOTH a real backward boundary
 * (`;`/`{`/`}`/start-of-file) AND a real top-level `;` terminator forward
 * count as "top-level" and are scanned. Nested subquery arguments never
 * satisfy both, so they are excluded the same way
 * query-scoping-invariant.test.ts excludes them (its bullet 2).
 */

const SRC_ROOT = join(__dirname, "..", "src");
const SCHEMA_DIR = join(__dirname, "..", "src", "db", "schema");

// DEC-558 (wave 79 amendment): a bare `DEC-\d{3}` in the six lines above a
// `.limit(1)` chain used to be enough, on its own, to waive the chain --
// which meant ANY comment citing ANY DEC number (and nearly every comment
// in this codebase cites one) could exempt a genuinely unordered chain.
// Narrowed so a DEC citation only exempts when the same six-line window
// ALSO either (a) names a real `uniqueIndex(...)` declared in
// src/db/schema/** (reusing test/limit-one-index-citation.scan.test.ts's
// read-the-schema-as-text derivation -- duplicated here, ~10 lines, rather
// than imported, so this file has no cross-test-file coupling; see that
// file for the canonical population and its own citation-correctness
// checks) or (b) explicitly states an ordering (`orderBy`/`ORDER BY`).
function deriveUniqueIndexNames(): Set<string> {
  const names = new Set<string>();
  const re = /uniqueIndex\(\s*"([a-zA-Z0-9_]+)"/g;
  for (const file of listSourceFiles(SCHEMA_DIR)) {
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      if (m[1]) names.add(m[1]);
    }
  }
  return names;
}

const UNIQUE_INDEX_NAMES = deriveUniqueIndexNames();

/** True when `context` (the six-line window above a chain, or the leading
 * comment swept into the statement bounds) names a declared uniqueIndex, or
 * states an explicit ordering. Checked as a literal substring match against
 * every declared uniqueIndex name (not constrained to the `*_idx` naming
 * convention Part 1's scan targets) -- some real uniqueIndex declarations
 * are named e.g. `file_previous_file_id_unique`, without an `_idx` suffix,
 * and a citation of that name is exactly as valid a claim as one that ends
 * in `_idx`. */
function namesUniqueIndexOrOrdering(context: string): boolean {
  if (/\.orderBy\(|ORDER BY/.test(context)) return true;
  for (const name of UNIQUE_INDEX_NAMES) {
    if (context.includes(name)) return true;
  }
  return false;
}

// DEC-558: this ceiling only ever decreases. It was seeded at the count this
// branch measured against src/ as of wave 73 (177 total `.limit(1)` call
// sites; 30 of those are top-level chains with no `.orderBy(`, no
// primary-key `eq(schema.X.id, ...)` predicate, and no `DEC-\d{3}` citation
// in the six lines above the chain). Each site's resolution (order it, key
// it, or cite a DEC explaining why one row is unambiguous) should lower
// this number in a later wave -- never raise it.
//
// Wave 75 (task-w75-a, DEC-558 amendment): resolved the 14 sites this
// lane's scope covered (src/server/repo/** excluding portal/**, review/**,
// contacts/**, files*.ts, and tasks/**), lowering the count from 30 to 17.
// The remaining 17 are deliberately left to sibling lanes/files this wave
// did not own: src/routes/auth-login.tsx and src/server/middleware.ts
// (outside src/server/repo/** entirely), src/server/repo/contacts/** and
// src/server/repo/files*.ts (task-w75-b), src/server/repo/portal/**
// (task-w74-b), and src/server/repo/review/** (task-w74-a/-c).
//
// Wave 79 (task-w79-b, DEC-558 amendment): narrowed hasDecCitation (below)
// to require a named uniqueIndex or an explicit ordering alongside the DEC
// number, not a bare DEC number alone -- a bare DEC-NNN citation used to
// exempt a chain regardless of what the comment actually argued. Measured
// against this worktree's src/ under the narrowed rule, BEFORE any src/
// fix: 22 (up from 17), because 8 real sites had only ever been waived by
// the bare-DEC-number loophole (contacts/merge.ts EXISTS-only reasoning
// with no `.orderBy`, files-authz.ts's "1:1 in practice" note on a plain
// index, and a stale lookup in auth-reset.tsx that had no uniqueness
// reasoning at all). Each was resolved the honest way this same wave: an
// `.orderBy(schema.<table>.id)` added to genuinely EXISTS-only chains
// (contacts/merge.ts) so the candidate set has a real total order even
// though row identity was already never observed, and a real uniqueIndex
// name added to the citing comment where DEC-558 reasoning already argued
// for one but didn't name it in the six-line citation window (auth-reset.
// tsx: user_email_idx; contacts/merge.ts: pipeline_entry_org_id_contact_id_
// idx). That brought the measured count back down to 17 -- the same 17
// sites wave 75 left to sibling lanes (see above), now re-verified honest
// under the narrowed rule rather than merely uncounted. Ceiling held at 17.
const MAX_UNORDERED_LIMIT_ONE = 17;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

interface LimitOneChain {
  file: string;
  line: number;
  text: string;
}

interface StatementBounds {
  start: number;
  end: number;
  isTopLevel: boolean;
}

/**
 * Walks outward from a `.limit(1)` match to find the bounds of its
 * enclosing top-level statement. Returns isTopLevel=false if the match sits
 * nested inside another call's argument list in either direction.
 */
function findStatementBounds(source: string, matchIndex: number): StatementBounds {
  // Backward walk.
  let depth = 0;
  let start = 0;
  let backwardTopLevel = true;
  for (let i = matchIndex - 1; i >= 0; i--) {
    const c = source[i];
    if (c === ")") {
      depth++;
    } else if (c === "(") {
      if (depth === 0) {
        // Unmatched open paren going backward -- nested inside an
        // enclosing call's argument list.
        start = i + 1;
        backwardTopLevel = false;
        break;
      }
      depth--;
    } else if (depth === 0 && (c === ";" || c === "{" || c === "}")) {
      start = i + 1;
      break;
    }
    if (i === 0) start = 0;
  }

  // Forward walk.
  depth = 0;
  let end = source.length;
  let forwardTopLevel = true;
  for (let j = matchIndex; j < source.length; j++) {
    const c = source[j];
    if (c === "(") {
      depth++;
    } else if (c === ")") {
      if (depth === 0) {
        // Unmatched close paren going forward -- nested inside an
        // enclosing call's argument list.
        end = j;
        forwardTopLevel = false;
        break;
      }
      depth--;
    } else if (depth === 0 && c === ";") {
      end = j;
      break;
    }
  }

  return { start, end, isTopLevel: backwardTopLevel && forwardTopLevel };
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

const PRIMARY_KEY_EQ_RE = /eq\(\s*schema\.\w+\.id\s*,/;
const DEC_CITATION_RE = /DEC-\d{3}/;

// A backward statement boundary (previous top-level `;`/`{`/`}`) can land
// just before a run of blank lines and/or leading comments that belong to
// the *next* statement, not the previous one -- so the raw chain text can
// start with a comment (which may itself carry the DEC-NNN citation this
// scanner is supposed to honor). Skip that leading whitespace/comment run
// to find where the actual code of the chain begins, so both the reported
// line number and the "six lines above" citation window point at the real
// statement, not at incidental comment text swept in by the boundary scan.
const LEADING_COMMENT_RE = /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/;

function findUnorderedLimitOneChains(source: string, file: string): LimitOneChain[] {
  const offenders: LimitOneChain[] = [];
  const limitOneRe = /\.limit\(\s*1\s*\)/g;
  const seenChainStarts = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = limitOneRe.exec(source)) !== null) {
    const bounds = findStatementBounds(source, match.index);
    if (!bounds.isTopLevel) continue;
    // Multiple `.limit(1)` occurrences could in theory resolve to the same
    // enclosing statement bounds (not expected in practice, but guard
    // against double-reporting the same chain).
    if (seenChainStarts.has(bounds.start)) continue;
    seenChainStarts.add(bounds.start);

    const rawChainText = source.slice(bounds.start, bounds.end);
    const leadingMatch = rawChainText.match(LEADING_COMMENT_RE);
    const codeOffset = leadingMatch ? leadingMatch[0].length : 0;
    const codeStart = bounds.start + codeOffset;
    const chainText = rawChainText.slice(codeOffset);

    const hasOrderBy = /\.orderBy\(/.test(chainText);
    const hasPrimaryKeyPredicate = PRIMARY_KEY_EQ_RE.test(chainText);

    // DEC citation within the six lines above the chain's real code start
    // (including any leading comment swept into the statement bounds,
    // since that comment is textually "above" the code once trimmed out).
    const chainStartLine = lineNumberAt(source, codeStart);
    const sourceLines = source.split("\n");
    const contextStart = Math.max(0, chainStartLine - 1 - 6);
    const contextLines = sourceLines.slice(contextStart, chainStartLine - 1).join("\n");
    const leadingCommentText = rawChainText.slice(0, codeOffset);
    const hasDecCitation =
      (DEC_CITATION_RE.test(contextLines) && namesUniqueIndexOrOrdering(contextLines)) ||
      (DEC_CITATION_RE.test(leadingCommentText) && namesUniqueIndexOrOrdering(leadingCommentText));

    if (hasOrderBy || hasPrimaryKeyPredicate || hasDecCitation) continue;

    offenders.push({
      file,
      line: chainStartLine,
      text: chainText.trim().replace(/\s+/g, " ").slice(0, 100),
    });
  }
  return offenders;
}

function relativePath(file: string): string {
  return file.slice(join(__dirname, "..").length + 1);
}

describe("DEC-558: .limit(1) chains with no total order over the candidate set", () => {
  const files = listSourceFiles(SRC_ROOT);
  const allFlagged: LimitOneChain[] = [];
  let totalLimitOneCalls = 0;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    totalLimitOneCalls += (source.match(/\.limit\(\s*1\s*\)/g) ?? []).length;
    allFlagged.push(...findUnorderedLimitOneChains(source, file));
  }

  it("finds at least 100 .limit(1) call sites across src/ (scanner sanity check)", () => {
    expect(totalLimitOneCalls).toBeGreaterThanOrEqual(100);
  });

  it("self-check: a synthetic id-keyed .limit(1) chain is NOT flagged", () => {
    const source = `const row = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);`;
    const offenders = findUnorderedLimitOneChains(source, "synthetic-id-keyed.ts");
    expect(offenders).toEqual([]);
  });

  it("self-check: a synthetic non-id-keyed, unordered .limit(1) chain IS flagged", () => {
    const source = `const row = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);`;
    const offenders = findUnorderedLimitOneChains(source, "synthetic-unordered.ts");
    expect(offenders.length).toBe(1);
  });

  it(`flags at most ${MAX_UNORDERED_LIMIT_ONE} unordered, non-id-keyed, uncited .limit(1) chains (ratchet: only ever decreases)`, () => {
    if (allFlagged.length > MAX_UNORDERED_LIMIT_ONE) {
      const details = allFlagged
        .map((o) => `  ${relativePath(o.file)}:${o.line} — ${o.text}`)
        .join("\n");
      throw new Error(
        `Found ${allFlagged.length} unordered .limit(1) chain(s), exceeding the ceiling of ` +
          `${MAX_UNORDERED_LIMIT_ONE}. Each entry needs either an .orderBy(...) that totally orders ` +
          `the candidate set, an eq(schema.X.id, ...) predicate, or a DEC-NNN citation in the six lines ` +
          `above it explaining why one row is unambiguous:\n${details}`,
      );
    }
    expect(allFlagged.length).toBeLessThanOrEqual(MAX_UNORDERED_LIMIT_ONE);
  });
});
