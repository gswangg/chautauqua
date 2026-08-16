// DEC-558 (wave 79 amendment): a comment that names an index is a claim
// about the schema, not decoration. ~45 comments across src/ cite a
// `*_idx` name to justify why a `.limit(1)` (or similar) query is safe --
// but nothing checked that the named index (a) actually exists, or (b) is
// declared `uniqueIndex(...)` when the citing comment asserts uniqueness.
// A stale or wrong citation is indistinguishable, at read time, from a
// correct one -- this scan makes the claim machine-checked so a rename or a
// downgrade from uniqueIndex to a plain index can never silently strand a
// citation that used to be true.
//
// Population derivation technique (read test/unique-index-guard-coverage.
// scan.test.ts first -- this scan reuses its read-the-schema-as-text idiom):
// every file under src/db/schema/ is read as text at run time and every
// `uniqueIndex("<name>"` and plain `index("<name>"` declaration is
// extracted into two disjoint sets (UNIQUE_INDEX_NAMES, PLAIN_INDEX_NAMES).
// Nothing here is hand-maintained -- a renamed or removed schema index is
// picked up automatically the next time this test runs.
//
// Citation-finding technique: walk every `.ts`/`.tsx` file under src/,
// excluding src/db/schema/** (the declarations themselves) and excluding
// *.test.ts(x) (the scans, including this one and its self-check strings),
// and find every comment token matching /\b[a-z][a-z0-9_]*_idx\b/. For each
// match:
//   1. The name must be a declared index (in UNIQUE_INDEX_NAMES union
//      PLAIN_INDEX_NAMES) -- a comment naming an index that does not exist
//      in the schema is a stale claim and fails with file:line and name.
//   2. If the citing comment BLOCK (the matched line plus the two lines
//      immediately above and below it) asserts uniqueness -- matches
//      /uniqueIndex|unique index|UNIQUE|at most one row/ -- the named index
//      must be in UNIQUE_INDEX_NAMES, not merely PLAIN_INDEX_NAMES. Citing
//      a plain (non-unique) index as if it proves "at most one row" is
//      exactly the kind of wrong claim this scan exists to catch.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SRC_ROOT = join(REPO_ROOT, "src");
const SCHEMA_DIR = join(SRC_ROOT, "db", "schema");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Extracts declared index names from schema file text, split by kind.
 * `\s` matches newlines too, so a wrapped declaration resolves the same as
 * a single-line one. The uniqueIndex regex must run (and its matches be
 * excluded) before the plain-index regex, since `uniqueIndex(` also
 * contains the substring `Index(` but NOT a bare `index(` token boundary --
 * matching `\bindex\(` avoids matching inside `uniqueIndex(` at all. */
function extractIndexNames(src: string): { unique: string[]; plain: string[] } {
  const uniqueRe = /uniqueIndex\(\s*"([a-zA-Z0-9_]+)"/g;
  const plainRe = /\bindex\(\s*"([a-zA-Z0-9_]+)"/g;
  const unique: string[] = [];
  const plain: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = uniqueRe.exec(src))) {
    if (m[1]) unique.push(m[1]);
  }
  while ((m = plainRe.exec(src))) {
    if (m[1]) plain.push(m[1]);
  }
  return { unique, plain };
}

function deriveDeclaredIndexes(): { uniqueIndexNames: Set<string>; plainIndexNames: Set<string> } {
  const files = listTsFiles(SCHEMA_DIR);
  const uniqueIndexNames = new Set<string>();
  const plainIndexNames = new Set<string>();
  for (const f of files) {
    const { unique, plain } = extractIndexNames(readFileSync(f, "utf8"));
    for (const n of unique) uniqueIndexNames.add(n);
    for (const n of plain) plainIndexNames.add(n);
  }
  return { uniqueIndexNames, plainIndexNames };
}

const { uniqueIndexNames: UNIQUE_INDEX_NAMES, plainIndexNames: PLAIN_INDEX_NAMES } = deriveDeclaredIndexes();

interface IndexCitation {
  file: string;
  line: number;
  name: string;
  block: string;
}

const IDX_NAME_RE = /\b([a-z][a-z0-9_]*_idx)\b/g;
const UNIQUENESS_ASSERTION_RE = /uniqueIndex|unique index|UNIQUE|at most one row/;

/** Finds every comment-line occurrence of a `*_idx` token in `source` and
 * returns it together with the 5-line block (2 above, the match line, 2
 * below) used to test whether the citation asserts uniqueness. Only lines
 * that look like comments (contain `//` or sit inside a `/* ... *\/` -- in
 * practice this codebase's `*_idx` citations are always in `//` line
 * comments or `/** ... *\/` block comments, so a simple `//`-or-`*`-prefix
 * check after trim is sufficient and avoids flagging identifiers named
 * `..._idx` in live code, e.g. object keys like `event_slug_idx: index(...)`
 * in the schema itself (already excluded by directory) or destructured
 * variables named `*_idx` (none exist in this codebase). */
function findIndexCitations(source: string, file: string): IndexCitation[] {
  const lines = source.split("\n");
  const citations: IndexCitation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    const isCommentLine = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
    if (!isCommentLine) continue;
    IDX_NAME_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IDX_NAME_RE.exec(raw))) {
      const name = m[1];
      if (!name) continue;
      const blockStart = Math.max(0, i - 2);
      const blockEnd = Math.min(lines.length, i + 3);
      const block = lines.slice(blockStart, blockEnd).join("\n");
      citations.push({ file, line: i + 1, name, block });
    }
  }
  return citations;
}

function relativePath(file: string): string {
  return relative(REPO_ROOT, file);
}

function listCitationSources(): string[] {
  return listTsFiles(SRC_ROOT).filter((f) => {
    const rel = relative(SRC_ROOT, f);
    if (rel.startsWith(`db${sep}schema${sep}`)) return false;
    if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) return false;
    return true;
  });
}

describe("DEC-558 (wave 79): every *_idx comment citation names a real, correctly-kinded schema index", () => {
  it("scanned at least one schema file and derived at least 15 unique + 15 plain index names (tripwire against a vacuous scan)", () => {
    expect(UNIQUE_INDEX_NAMES.size).toBeGreaterThanOrEqual(15);
    expect(PLAIN_INDEX_NAMES.size).toBeGreaterThanOrEqual(15);
  });

  it("self-check: a citation naming a real uniqueIndex, with a uniqueness assertion nearby, is NOT flagged", () => {
    const [sampleUnique] = UNIQUE_INDEX_NAMES;
    expect(sampleUnique).toBeTruthy();
    const source = [
      "// synthetic self-check comment",
      `// DEC-558: at most one row by construction -- \`${sampleUnique}\` is a uniqueIndex`,
      "const rows = await db.select().limit(1);",
    ].join("\n");
    const citations = findIndexCitations(source, "synthetic-real-unique.ts");
    expect(citations.length).toBe(1);
    const c = citations[0]!;
    expect(UNIQUE_INDEX_NAMES.has(c.name)).toBe(true);
    expect(UNIQUENESS_ASSERTION_RE.test(c.block)).toBe(true);
  });

  it("self-check: a citation naming a nonexistent index is flagged as stale", () => {
    const source = "// DEC-558: this_index_does_not_exist_anywhere_idx proves one row\n";
    const citations = findIndexCitations(source, "synthetic-stale.ts");
    expect(citations.length).toBe(1);
    const name = citations[0]!.name;
    expect(UNIQUE_INDEX_NAMES.has(name) || PLAIN_INDEX_NAMES.has(name)).toBe(false);
  });

  it("self-check: a plain (non-unique) index cited WITH a uniqueness assertion is flagged", () => {
    const [samplePlain] = [...PLAIN_INDEX_NAMES].filter((n) => !UNIQUE_INDEX_NAMES.has(n));
    expect(samplePlain).toBeTruthy();
    const source = [
      "// synthetic self-check comment",
      `// DEC-558: at most one row by construction -- \`${samplePlain}\` proves it`,
      "const rows = await db.select().limit(1);",
    ].join("\n");
    const citations = findIndexCitations(source, "synthetic-wrong-kind.ts");
    expect(citations.length).toBe(1);
    const c = citations[0]!;
    expect(PLAIN_INDEX_NAMES.has(c.name)).toBe(true);
    expect(UNIQUE_INDEX_NAMES.has(c.name)).toBe(false);
    expect(UNIQUENESS_ASSERTION_RE.test(c.block)).toBe(true);
  });

  const sourceFiles = listCitationSources();
  const allCitations = sourceFiles.flatMap((f) => findIndexCitations(readFileSync(f, "utf8"), f));

  it("scanned at least one non-schema source file for *_idx citations (scanner sanity check)", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it("every *_idx comment citation in src/ (excluding schema and test files) names a declared schema index", () => {
    const stale = allCitations.filter((c) => !UNIQUE_INDEX_NAMES.has(c.name) && !PLAIN_INDEX_NAMES.has(c.name));
    const details = stale.map((c) => `  ${relativePath(c.file)}:${c.line} — cites "${c.name}", not declared in src/db/schema/**`);
    expect(stale, `Stale index citations (name no longer exists in schema):\n${details.join("\n")}`).toEqual([]);
  });

  it("every *_idx comment citation asserting uniqueness names an actual uniqueIndex, not a plain index", () => {
    const wrongKind = allCitations.filter(
      (c) => UNIQUENESS_ASSERTION_RE.test(c.block) && !UNIQUE_INDEX_NAMES.has(c.name) && PLAIN_INDEX_NAMES.has(c.name),
    );
    const details = wrongKind.map(
      (c) => `  ${relativePath(c.file)}:${c.line} — cites "${c.name}" as proving uniqueness, but it is a plain (non-unique) index`,
    );
    expect(wrongKind, `Uniqueness claimed for a plain (non-unique) index:\n${details.join("\n")}`).toEqual([]);
  });
});
