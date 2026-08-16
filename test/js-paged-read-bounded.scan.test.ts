// DEC-461 w78: every route that JS-pages an already-materialised array
// (`.slice(start, start + perPage)` and its `.slice(offset, offset +
// params.perPage)` sibling) does so over an array a repo function produced
// with `db.select().from(schema.X)` -- and that producer must refuse loudly
// above a named ceiling (MAX_FILE_LIBRARY_SCAN, MAX_PLAN_SUBMISSION_SCAN,
// MAX_CONTACT_DIRECTORY_SCAN, MAX_AGENDA_SCAN, MAX_REVIEWER_SCOPE_ROWS,
// MAX_SUBMISSION_FILE_SCAN...) rather than trust the caller's `.slice` to
// bound it, exactly like every other JS-paged list in this tree. This scan
// names the POPULATION mechanically (every `.slice` pagination site under
// src/routes/** and src/server/repo/**, and every repo function reachable
// from its enclosing file via `await`), not the one function (listSubmissionFiles)
// someone happened to measure -- modelled on
// test/plan-evaluation-scan-cap.scan.test.ts (same extractExportedFunctions
// splitter, same detector-self-test idiom); that file walks only
// src/server/repo/review, this one walks all of src/server/repo and
// src/routes.
//
// One structural exclusion, not a name allowlist: a repo function whose
// `.where(` clause contains an `inArray(` call is the DEC-829-blessed
// chunked id-batch read (bounded by the CALLER's already-bounded id array,
// e.g. batchContactNames/getUsersByIds/listPlansByIds -- chunkIds() splits
// a finite input, it never scans the table), not the unbounded
// whole-population scan DEC-461 forbids. listSubmissionFiles's own WHERE is
// `eq(schema.file.submissionId, submissionId)` -- no inArray -- so this
// exclusion cannot hide it.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "src", "server", "repo");
const ROUTES_ROOT = join(HERE, "..", "src", "routes");

function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.ts$/.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface FoundFunction {
  name: string;
  body: string;
}

/** Splits `src` into top-level `export (async )?function NAME(...) { ... }`
 * chunks, one per exported top-level function declaration, by slicing from
 * each declaration's start to the start of the NEXT top-level declaration
 * (or EOF) -- see test/plan-evaluation-scan-cap.scan.test.ts's own comment
 * for why this avoids naive brace-balance matching. Declarations never nest
 * in this codebase. */
function extractExportedFunctions(src: string): FoundFunction[] {
  const declRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
  const starts: { index: number; name: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(src))) {
    starts.push({ index: m.index, name: m[1]! });
  }
  const out: FoundFunction[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!.index;
    const end = i + 1 < starts.length ? starts[i + 1]!.index : src.length;
    out.push({ name: starts[i]!.name, body: src.slice(start, end) });
  }
  return out;
}

interface PaginationSite {
  file: string;
  line: number;
  match: string;
}

/** `.slice(X, X + <something>erPage)` (identical-prefix backreference,
 * catches both `.slice(start, start + perPage)` and the arithmetic
 * `.slice((page - 1) * perPage, (page - 1) * perPage + perPage)` shape) and
 * its `.slice(offset, offset + params.perPage)` variant -- both already
 * covered by the same pattern since `params.perPage` is just a longer
 * right-hand identifier. Filters to matches whose right-hand side names
 * something ending in "PerPage"/"perPage" so an unrelated `.slice(a, a + b)`
 * elsewhere never counts as a pagination site. */
const SLICE_RE = /\.slice\(((?:\([^()]*\)|[^,()])+),\s*\1\s*\+\s*([^)]+)\)/g;

function findPaginationSites(file: string, src: string): PaginationSite[] {
  const out: PaginationSite[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SLICE_RE.source, "g");
  while ((m = re.exec(src))) {
    if (!/perPage/i.test(m[0])) continue;
    const line = src.slice(0, m.index).split("\n").length;
    out.push({ file, line, match: m[0] });
  }
  return out;
}

/** Every bare identifier immediately following `await` (optionally through
 * a `.`-qualified namespace, e.g. `await repo.listReviewerRowsForPlan(`,
 * `await eventsRepo.getEventForOrg(`) anywhere in `src` -- the population
 * of repo function names a file's pagination site could be resting on. */
function awaitedCallNames(src: string): Set<string> {
  const re = /await\s+(?:[\w$]+\.)*([A-Za-z_$][\w$]*)\s*\(/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[1]!);
  return out;
}

/** True iff `fn`'s `.where(...)` argument contains an `inArray(` call --
 * the DEC-829-blessed chunked id-batch shape, bounded by the CALLER's own
 * finite array rather than by a ceiling on the table itself. */
function isIdBatchRead(body: string): boolean {
  const idx = body.indexOf(".where(");
  if (idx === -1) return false;
  const parenStart = idx + ".where(".length - 1;
  let depth = 0;
  let i = parenStart;
  for (; i < body.length; i++) {
    if (body[i] === "(") depth++;
    else if (body[i] === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  return body.slice(parenStart, i + 1).includes("inArray(");
}

/** True iff `fn` is a real, unbounded, JS-pageable producer: it selects
 * FROM a schema table and is neither capped (`.limit(` or a `MAX_`
 * identifier in its own body) nor a DEC-829 chunked id-batch read. */
function isUnboundedTableRead(fn: FoundFunction): boolean {
  if (!fn.body.includes(".from(schema.")) return false;
  if (fn.body.includes(".limit(")) return false;
  if (/MAX_/.test(fn.body)) return false;
  if (isIdBatchRead(fn.body)) return false;
  return true;
}

interface RepoFunctionIndex {
  file: string;
  fn: FoundFunction;
}

function buildRepoIndex(files: string[]): Map<string, RepoFunctionIndex[]> {
  const index = new Map<string, RepoFunctionIndex[]>();
  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    for (const fn of extractExportedFunctions(src)) {
      const list = index.get(fn.name) ?? [];
      list.push({ file, fn });
      index.set(fn.name, list);
    }
  }
  return index;
}

describe("DEC-461 w78: every JS-paged repo producer refuses loudly above a named ceiling", () => {
  const repoFiles = allSourceFiles(REPO_ROOT);
  const routeFiles = allSourceFiles(ROUTES_ROOT);
  const allFiles = [...repoFiles, ...routeFiles];
  const repoIndex = buildRepoIndex(repoFiles);

  const sitesByFile = new Map<string, PaginationSite[]>();
  for (const file of allFiles) {
    const src = readFileSync(file, "utf-8");
    const sites = findPaginationSites(file, src);
    if (sites.length > 0) sitesByFile.set(file, sites);
  }

  it("scanned more than one repo/routes file", () => {
    expect(repoFiles.length + routeFiles.length).toBeGreaterThan(1);
  });

  it("found at least one JS pagination site (the population this scan grades)", () => {
    let total = 0;
    for (const sites of sitesByFile.values()) total += sites.length;
    expect(total).toBeGreaterThan(0);
  });

  it("the discovered offender population has more than one member across the whole tree's slice sites (a population of one proves nothing)", () => {
    // Members here are (repo function, enclosing file) pairs reachable from
    // ANY pagination site, before the bounded/unbounded filter -- i.e. the
    // full population this scan's rule evaluates, not just the real
    // offenders it flags.
    const members = new Set<string>();
    for (const [file] of sitesByFile) {
      const src = readFileSync(file, "utf-8");
      for (const name of awaitedCallNames(src)) {
        const defs = repoIndex.get(name);
        if (!defs) continue;
        for (const def of defs) {
          if (!def.fn.body.includes(".from(schema.")) continue;
          members.add(`${relative(HERE, def.file)}:${name}`);
        }
      }
    }
    expect(members.size, `population: ${[...members].join(", ")}`).toBeGreaterThan(1);
  });

  it("every repo function a JS-paged file could rest its slice on is bounded (`.limit(` or `MAX_`) or a DEC-829 id-batch read", () => {
    const offenders: string[] = [];
    for (const [file, sites] of sitesByFile) {
      const src = readFileSync(file, "utf-8");
      const names = awaitedCallNames(src);
      for (const name of names) {
        const defs = repoIndex.get(name);
        if (!defs) continue;
        for (const def of defs) {
          if (!isUnboundedTableRead(def.fn)) continue;
          for (const site of sites) {
            offenders.push(
              `${relative(HERE, def.file)}:${name} (paged at ${relative(HERE, join(file))}:${site.line})`,
            );
          }
        }
      }
    }
    expect(offenders, `unbounded JS-paged producers: ${offenders.join(", ")}`).toEqual([]);
  });

  // Negative/positive control on the detector itself, independent of the
  // real source tree.
  it("detector self-test: flags an unbounded producer, does not flag a `.limit(MAX_X + 1)` one, and does not flag a chunked id-batch read", () => {
    const unboundedSrc = `
export async function scanWhole(db: Db, submissionId: string) {
  return db.select({ id: schema.file.id })
    .from(schema.file)
    .where(eq(schema.file.submissionId, submissionId))
    .orderBy(desc(schema.file.createdAt));
}`;
    const boundedSrc = `
export async function scanCapped(db: Db, submissionId: string) {
  return db.select({ id: schema.file.id })
    .from(schema.file)
    .where(eq(schema.file.submissionId, submissionId))
    .limit(MAX_X + 1);
}`;
    const idBatchSrc = `
export async function batchLookup(db: Db, ids: string[]) {
  const out = [];
  for (const batch of chunkIds(ids)) {
    out.push(...(await db.select({ id: schema.contact.id })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch))));
  }
  return out;
}`;
    const unboundedFns = extractExportedFunctions(unboundedSrc);
    const boundedFns = extractExportedFunctions(boundedSrc);
    const idBatchFns = extractExportedFunctions(idBatchSrc);
    expect(unboundedFns.map(isUnboundedTableRead)).toEqual([true]);
    expect(boundedFns.map(isUnboundedTableRead)).toEqual([false]);
    expect(idBatchFns.map(isUnboundedTableRead)).toEqual([false]);
  });

  it("detector self-test: recognizes both `.slice` pagination shapes", () => {
    const simpleShape = `const slice = items.slice(start, start + perPage);`;
    const offsetShape = `const page = merged.slice(offset, offset + params.perPage);`;
    const arithmeticShape = `const pagedIds = planIds.slice((page - 1) * perPage, (page - 1) * perPage + perPage);`;
    const unrelatedShape = `const chunk = arr.slice(a, a + windowSize);`;
    expect(findPaginationSites("x.ts", simpleShape).length).toBe(1);
    expect(findPaginationSites("x.ts", offsetShape).length).toBe(1);
    expect(findPaginationSites("x.ts", arithmeticShape).length).toBe(1);
    expect(findPaginationSites("x.ts", unrelatedShape).length).toBe(0);
  });

  it("named finding: listSubmissionFiles is the real offender this scan surfaces on an unfixed tree (regression pin)", () => {
    // Re-run the same detector against files-versions-read.ts's CURRENT
    // (fixed) body directly, to pin that the fix this scan required is the
    // one still present -- MAX_SUBMISSION_FILE_SCAN, not a truncating
    // slice.
    const file = join(HERE, "..", "src", "server", "repo", "files-versions-read.ts");
    const src = readFileSync(file, "utf-8");
    const fn = extractExportedFunctions(src).find((f) => f.name === "listSubmissionFiles");
    expect(fn).toBeDefined();
    expect(isUnboundedTableRead(fn!)).toBe(false);
    expect(fn!.body).toContain("MAX_SUBMISSION_FILE_SCAN");
  });
});
