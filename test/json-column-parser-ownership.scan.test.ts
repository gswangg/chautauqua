// DEC-518 (wave 11 amendment): five JSON columns got validated parser
// owners in five separate waves, each found by hand AFTER a defect, and
// wave 11 found a sixth (submission_answer.value_json) the same way. This
// scan replaces the hand-search with a derivation.
//
// Population derivation technique (read test/limit-one-total-order.scan.
// test.ts:68-80 first -- this scan reuses its read-the-schema-as-text
// idiom): every file under src/db/schema/ is read as text at run time.
// Every `export const <table> = sqliteTable("<sql_table_name>"` declaration
// is located, and every `<prop>: text("<sql_col>_json"` column declaration
// is associated with the NEAREST PRECEDING table declaration in the same
// file (schema files declare one flat sequence of top-level `sqliteTable(`
// calls, never nested, so "nearest preceding" is unambiguous). Nothing here
// is hand-maintained -- a renamed, added, or removed `_json` column is
// picked up automatically the next time this test runs.
//
// The population is then checked against a hand-seeded ledger, two ways:
//
//   1. Every derived column has EXACTLY ONE ledger row (`<table>.<column>`).
//      A derived column with zero or more than one row fails, naming the
//      column.
//   2. Every ledger row names a LIVE derived column -- a row for a column
//      that no longer exists (renamed table/column, dropped column) fails
//      as a stale row.
//   3. Every ledger row whose verdict is 'owned' names a parser module path
//      that (a) exists on disk, and (b) is imported by at least one file
//      under src/ (other than the parser module itself and schema files)
//      that also reads the SAME column's drizzle property name -- i.e. the
//      claimed owner is actually wired to a real reader, not just present
//      in the tree. A row whose verdict is 'owed' records a column with no
//      validated parser -- admitted, not omitted, and (per test/exemption-
//      reason-is-a-principle.scan.test.ts:86-89) explicitly permitted to
//      carry a plain `reason:` string as long as that reason is not
//      schedule-shaped (that file's own scan enforces this independently;
//      see its VERDICT_OWED_RE carve-out).
//   4. DEC-839 (wave 12): check 3 alone measures PRESENCE, not BEHAVIOUR --
//      a parser file that exists, is called, and touches the column's
//      property can still just be a cast (`JSON.parse(x) as Shape`), which
//      satisfies (a)-(c) while silently mis-shaping bad data instead of
//      refusing it. Every 'owned' row now also names a `refusalTest` file
//      and a `refusalSymbol`; this scan checks the file exists on disk and
//      mentions the symbol as a literal -- i.e. that a test proving the
//      parser REFUSES (throws) or explicitly DROPS a malformed value for
//      this column actually exists, not merely that the parser does.
//
// Deliberately NO count ratchet: unlike test/limit-one-total-order.scan.
// test.ts's ceiling, this check is entirely structural (every column has a
// row; every 'owned' row has a real, wired owner) -- there is no number to
// carry, so a later wave can never "satisfy" this scan by keeping a count
// flat. The only way to pass is for the ledger to be complete and correct.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SRC_ROOT = join(REPO_ROOT, "src");
const SCHEMA_DIR = join(SRC_ROOT, "db", "schema");

// ---------------------------------------------------------------------------
// Derivation (population)
// ---------------------------------------------------------------------------

interface JsonColumn {
  /** `<sql_table_name>.<sql_column_name>`, e.g. "form_field.options_json". */
  key: string;
  table: string;
  column: string;
  /** The drizzle property name, e.g. "optionsJson". */
  property: string;
  file: string;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const TABLE_RE = /export const \w+\s*=\s*sqliteTable\(\s*"([a-zA-Z0-9_]+)"/g;
const JSON_COLUMN_RE = /(\w+):\s*text\(\s*"([a-zA-Z0-9_]+_json)"/g;

/** Reads one schema file's text and returns every `_json` text column,
 * paired with the nearest preceding `sqliteTable("...")` declaration in
 * that same file (schema files are a flat, non-nested sequence of
 * top-level table declarations, so "nearest preceding by source index" is
 * an unambiguous association). */
function deriveJsonColumnsFromFile(file: string): JsonColumn[] {
  const src = readFileSync(file, "utf8");

  const tables: { name: string; index: number }[] = [];
  {
    const re = new RegExp(TABLE_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const name = m[1];
      if (!name) continue;
      tables.push({ name, index: m.index });
    }
  }

  const columns: JsonColumn[] = [];
  {
    const re = new RegExp(JSON_COLUMN_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const property = m[1];
      const column = m[2];
      if (!property || !column) continue;
      const index = m.index;
      let owner: string | null = null;
      for (const t of tables) {
        if (t.index <= index) owner = t.name;
        else break;
      }
      if (!owner) {
        throw new Error(
          `json-column-parser-ownership.scan: found "${property}: text(\"${column}\"" in ${file} with no ` +
            `preceding sqliteTable(...) declaration -- the nearest-preceding-table association broke.`,
        );
      }
      columns.push({ key: `${owner}.${column}`, table: owner, column, property, file });
    }
  }
  return columns;
}

function deriveJsonColumns(): JsonColumn[] {
  const out: JsonColumn[] = [];
  for (const f of listSourceFiles(SCHEMA_DIR)) {
    out.push(...deriveJsonColumnsFromFile(f));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ledger (hand-seeded claims about who owns each column, checked below)
// ---------------------------------------------------------------------------

interface OwnedRow {
  key: string;
  verdict: "owned";
  /** Repo-root-relative path to the parser module. */
  parser: string;
  /** Repo-root-relative path to a test file proving the parser named above
   * REFUSES (throws) or explicitly DROPS a malformed value for this
   * column -- DEC-839's second citation, added because the first version
   * of this ledger's "owned" check could not distinguish a validating
   * parser from a cast (see this file's DEC-839 header note). */
  refusalTest: string;
  /** The exported symbol from `parser` whose refusal/drop behavior
   * `refusalTest` is required to demonstrate for THIS specific column --
   * needed because some parser modules (plan-json.ts, field-json.ts) own
   * more than one column via different exported functions. */
  refusalSymbol: string;
}

interface OwedRow {
  key: string;
  verdict: "owed";
  reason: string;
}

type LedgerRow = OwnedRow | OwedRow;

// Measured against this branch (task-w11-e, wave 11). Re-derived by hand
// against src/db/schema/** and every reader of each property, not carried
// forward from a prior wave's list -- see this file's header for the
// checking rules that keep the ledger honest going forward.
const LEDGER: LedgerRow[] = [
  {
    key: "segment.rules_json",
    verdict: "owned",
    parser: "src/domain/contacts-parts/segments.ts",
    refusalTest: "test/segment-rules-json.test.ts",
    refusalSymbol: "parseSegmentRulesJson",
  },
  {
    key: "embed.options_json",
    verdict: "owned",
    parser: "src/server/repo/embeds.ts",
    // DEC-839 (wave 12): parseStoredEmbedOptions used to cast `parsed as
    // EmbedOptions` and silently return {} for a non-object stored value --
    // now every key's type/bounds are checked and a malformed value throws
    // EmbedOptionsJsonError naming the offending key.
    refusalTest: "test/embed-options-json-parser.test.ts",
    refusalSymbol: "parseStoredEmbedOptions",
  },
  {
    key: "contact.social_links_json",
    verdict: "owned",
    parser: "src/server/repo/profile.ts",
    // parseSocialLinks is a deliberate TOLERANT reader (never throws --
    // absent/malformed/extra-key input degrades to the empty record, per
    // its own header) -- refusalTest proves the "explicitly drops a
    // malformed value" half of DEC-839's citation requirement, not a throw.
    refusalTest: "test/profile.test.ts",
    refusalSymbol: "parseSocialLinks",
  },
  {
    key: "contact.custom_fields_json",
    verdict: "owned",
    parser: "src/server/repo/contacts/crud.ts",
    refusalTest: "test/contact-custom-fields-single-parser.test.ts",
    refusalSymbol: "parseContactCustomFields",
  },
  {
    key: "event.branding_json",
    verdict: "owned",
    parser: "src/domain/event-branding.ts",
    // DEC-839 (wave 12): parseEventBranding used to throw a bare TypeError
    // on a stored JSON literal `null` (property access on null) and pass a
    // non-string accentColor straight through -- now both throw a named
    // EventBrandingJsonError naming the offending key. accentColor's
    // hex-GRAMMAR stays deliberately unvalidated here (DEC-374, render
    // edge); only its string TYPE is checked.
    refusalTest: "test/event-branding-json-parser.test.ts",
    refusalSymbol: "parseEventBranding",
  },
  {
    key: "form.tracks_json",
    verdict: "owned",
    parser: "src/forms/form-tracks.ts",
    refusalTest: "test/form-tracks-single-parser.test.ts",
    refusalSymbol: "parseFormTracks",
  },
  {
    key: "form_field.options_json",
    verdict: "owned",
    parser: "src/forms/field-json.ts",
    refusalTest: "test/form-field-json-parser.test.ts",
    refusalSymbol: "parseFieldOptions",
  },
  {
    key: "form_field.rule_json",
    verdict: "owned",
    parser: "src/forms/field-json.ts",
    refusalTest: "test/form-field-json-parser.test.ts",
    refusalSymbol: "parseFieldRule",
  },
  {
    key: "evaluation_plan.filters_json",
    verdict: "owned",
    parser: "src/domain/evaluation/plan-json.ts",
    refusalTest: "test/plan-json-single-parser.test.ts",
    refusalSymbol: "parsePlanFilters",
  },
  {
    key: "evaluation_plan.scale_json",
    verdict: "owned",
    parser: "src/domain/evaluation/plan-json.ts",
    refusalTest: "test/plan-json-single-parser.test.ts",
    refusalSymbol: "parsePlanScale",
  },
  {
    key: "evaluation_plan.criteria_json",
    verdict: "owned",
    parser: "src/domain/evaluation/plan-json.ts",
    refusalTest: "test/plan-json-single-parser.test.ts",
    refusalSymbol: "parsePlanCriteria",
  },
  {
    key: "evaluation_plan.round_criteria_json",
    verdict: "owned",
    parser: "src/domain/evaluation/plan-json.ts",
    refusalTest: "test/plan-json-single-parser.test.ts",
    refusalSymbol: "parseRoundCriteria",
  },
  {
    key: "evaluation_plan.round_meta_json",
    verdict: "owned",
    parser: "src/domain/evaluation/plan-json.ts",
    refusalTest: "test/plan-json-single-parser.test.ts",
    refusalSymbol: "parseRoundMeta",
  },
  {
    key: "evaluation.scores_json",
    verdict: "owned",
    parser: "src/domain/evaluation/scores-json.ts",
    refusalTest: "test/evaluation-scores-json.test.ts",
    refusalSymbol: "parseEvaluationScoresJson",
  },
  {
    key: "saved_view.config_json",
    verdict: "owned",
    parser: "src/server/repo/views.ts",
    refusalTest: "test/api-views.test.ts",
    refusalSymbol: "isValidSavedViewConfig",
  },
  {
    key: "task_assignment.response_json",
    verdict: "owned",
    parser: "src/forms/task-response.ts",
    refusalTest: "test/task-response-single-parser.test.ts",
    refusalSymbol: "parseTaskResponse",
  },
  {
    key: "submission.additional_track_ids_json",
    verdict: "owed",
    reason:
      "no reader anywhere under src/ -- src/server/repo/agenda/index.ts and rows.ts both say track " +
      "membership reads ONLY submission_track (DEC-017) and additional_track_ids_json is frozen legacy, " +
      "never touched by any query or parser.",
  },
  {
    key: "submission_answer.value_json",
    verdict: "owed",
    reason:
      "read directly at multiple sites (src/server/repo/submit.ts, review scoring, exports) with no " +
      "single validated parser module; src/server/repo/submit.ts's write-side round-trip assert is a " +
      "write-side guarantee, not a read-side parser.",
  },
];

const LEDGER_BY_KEY = new Map(LEDGER.map((row) => [row.key, row]));

// ---------------------------------------------------------------------------
// Check 3: an 'owned' row's parser must exist on disk and be actually wired
// to a reader of the same drizzle property.
// ---------------------------------------------------------------------------

/** Exported function names declared at the top level of a module -- used
 * to check that the claimed parser module is actually CALLED somewhere,
 * not merely present in the tree. Matches both `export function name(` and
 * `export async function name(`. */
function exportedFunctionNames(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const re = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) if (m[1]) names.push(m[1]);
  return names;
}

/** True when `fnName` is called (`fnName(`) anywhere in `file`'s text. Does
 * not distinguish call vs. redeclaration -- good enough given the call is
 * required to occur in a file OTHER than the declaring parser module. */
function fileCallsFunction(file: string, fnName: string): boolean {
  const src = readFileSync(file, "utf8");
  return new RegExp(`\\b${fnName}\\s*\\(`).test(src);
}

/** True when `file`'s text references `property` as a drizzle row read or
 * write -- `.property` (member access, e.g. `row.rulesJson`) or
 * `property:` (object literal key, e.g. `rulesJson: r.rulesJson`). Both
 * shapes appear across the repo's repo-layer modules depending on whether
 * the column is destructured or re-keyed. */
function fileTouchesProperty(file: string, property: string): boolean {
  const src = readFileSync(file, "utf8");
  const re = new RegExp(`\\.${property}\\b|\\b${property}\\s*:`);
  return re.test(src);
}

/** Checks that an 'owned' ledger row's claimed parser is a REAL, WIRED
 * owner of the column, not just a file that happens to exist:
 *
 *   (a) the parser file exists on disk;
 *   (b) at least one of the parser's exported functions is called from
 *       some OTHER file under src/ (proving the parser is actually used,
 *       not dead code sharing a name with the column);
 *   (c) the column's drizzle property is touched (read or written) SOMEWHERE
 *       under src/ (including the parser file itself, since some parsers --
 *       e.g. views.ts, segments.ts -- are also the repo-layer module that
 *       performs the query, in the same file that parses the result).
 *
 * (b) and (c) are checked independently (not required to be the SAME file)
 * because this repo's ownership pattern varies: sometimes the parser
 * function's caller passes the raw property directly (e.g.
 * `parseSegmentRulesJson(item.rulesJson, item.id)`), and sometimes the
 * parser module IS the repo layer and reads the property itself before
 * handing a typed record to every caller (e.g. views.ts's listSavedViews).
 * Both are legitimate ownership; requiring literal co-location in one file
 * would reject the second, real pattern. */
function ownedRowHasLiveOwner(row: OwnedRow, column: JsonColumn): { ok: boolean; detail: string } {
  const parserAbsPath = join(REPO_ROOT, row.parser);
  let exists = false;
  try {
    exists = statSync(parserAbsPath).isFile();
  } catch {
    exists = false;
  }
  if (!exists) {
    return { ok: false, detail: `parser file does not exist on disk: ${row.parser}` };
  }

  const fnNames = exportedFunctionNames(parserAbsPath);
  if (fnNames.length === 0) {
    return { ok: false, detail: `parser file exports no top-level functions: ${row.parser}` };
  }

  const otherFiles = listSourceFiles(SRC_ROOT).filter(
    (f) => f !== parserAbsPath && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx") && !f.startsWith(SCHEMA_DIR),
  );

  const called = otherFiles.some((f) => fnNames.some((fn) => fileCallsFunction(f, fn)));
  if (!called) {
    return {
      ok: false,
      detail: `none of ${row.parser}'s exported functions (${fnNames.join(", ")}) are called from any other file under src/`,
    };
  }

  const allFiles = listSourceFiles(SRC_ROOT).filter(
    (f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx") && !f.startsWith(SCHEMA_DIR),
  );
  const touched = allFiles.some((f) => fileTouchesProperty(f, column.property));
  if (!touched) {
    return { ok: false, detail: `no file under src/ reads or writes the "${column.property}" property` };
  }

  return { ok: true, detail: "" };
}

/** DEC-839 (wave 12): the second citation an 'owned' row must carry --
 * proof the claimed parser actually VALIDATES rather than merely EXISTS.
 * ownedRowHasLiveOwner (above) can only tell a parser file is present and
 * wired to a caller; it cannot distinguish `JSON.parse(x) as Shape` (a
 * cast) from a real validator, because both compile and both get called.
 * This check requires a `refusalTest` file that exists on disk AND
 * mentions the `refusalSymbol` -- the exact exported function this row
 * claims owns the column -- as a literal. It does not run the test file
 * (vitest already does that as its own suite); it only checks the CITATION
 * is real, so a row can't claim proof that was never written. */
function ownedRowHasRefusalTest(row: OwnedRow): { ok: boolean; detail: string } {
  const testAbsPath = join(REPO_ROOT, row.refusalTest);
  let exists = false;
  try {
    exists = statSync(testAbsPath).isFile();
  } catch {
    exists = false;
  }
  if (!exists) {
    return { ok: false, detail: `refusal test file does not exist on disk: ${row.refusalTest}` };
  }
  const src = readFileSync(testAbsPath, "utf8");
  const re = new RegExp(`\\b${row.refusalSymbol}\\b`);
  if (!re.test(src)) {
    return {
      ok: false,
      detail: `refusal test ${row.refusalTest} does not mention "${row.refusalSymbol}" -- citation does not name the owning symbol`,
    };
  }
  return { ok: true, detail: "" };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DEC-518 (wave 11 amendment): every JSON schema column has a ledgered, verified parser owner", () => {
  const derived = deriveJsonColumns();

  it("derives a non-empty population of _json columns from src/db/schema/**", () => {
    expect(derived.length).toBeGreaterThan(0);
  });

  it("every derived _json column has exactly one ledger row", () => {
    const missing: string[] = [];
    const duplicated: string[] = [];
    const seen = new Map<string, number>();
    for (const c of derived) {
      seen.set(c.key, (seen.get(c.key) ?? 0) + 1);
      if (!LEDGER_BY_KEY.has(c.key)) missing.push(c.key);
    }
    for (const [key, count] of seen) {
      if (count > 1) duplicated.push(`${key} (${count} schema declarations)`);
    }
    expect(missing, `columns derived from schema with NO ledger row: ${missing.join(", ")}`).toEqual([]);
    expect(
      duplicated,
      `columns declared more than once in schema (ambiguous key): ${duplicated.join(", ")}`,
    ).toEqual([]);
  });

  it("every ledger row names a live derived column (no stale rows)", () => {
    const derivedKeys = new Set(derived.map((c) => c.key));
    const stale = LEDGER.filter((row) => !derivedKeys.has(row.key)).map((row) => row.key);
    expect(stale, `ledger rows naming a column that no longer exists in schema: ${stale.join(", ")}`).toEqual([]);
  });

  it("every 'owned' ledger row's parser exists on disk and is actually wired to a reader of that column", () => {
    const failures: string[] = [];
    for (const row of LEDGER) {
      if (row.verdict !== "owned") continue;
      const column = derived.find((c) => c.key === row.key);
      // Guarded by the previous test (stale rows fail there); still assert
      // defensively so this test is meaningful standalone.
      if (!column) {
        failures.push(`${row.key}: ledger row has no matching derived column`);
        continue;
      }
      const result = ownedRowHasLiveOwner(row, column);
      if (!result.ok) failures.push(`${row.key}: ${result.detail}`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("every 'owned' ledger row's refusalTest exists and names the parser's owning symbol (DEC-839: proof of validation, not just presence)", () => {
    const failures: string[] = [];
    for (const row of LEDGER) {
      if (row.verdict !== "owned") continue;
      const result = ownedRowHasRefusalTest(row);
      if (!result.ok) failures.push(`${row.key}: ${result.detail}`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("every 'owed' ledger row carries a non-empty, non-schedule-shaped reason", () => {
    // Mirrors, but does not replace, test/exemption-reason-is-a-principle.
    // scan.test.ts's own machine check of every `reason:` string in test/
    // and app/src/ -- that scan explicitly carves out `verdict: 'owed'`
    // rows as permitted admissions, so this assertion (kept narrow, no
    // full schedule-word table duplicated here) only guards against an
    // EMPTY reason, which would defeat the "plain admission" requirement.
    for (const row of LEDGER) {
      if (row.verdict !== "owed") continue;
      expect(row.reason.trim().length, `${row.key}: 'owed' row has an empty reason`).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // Falsifiability controls
  // -------------------------------------------------------------------------

  it("[falsifiability] a synthetic derived column with no ledger row IS reported", () => {
    const synthetic: JsonColumn = {
      key: "nonexistent_table.made_up_json",
      table: "nonexistent_table",
      column: "made_up_json",
      property: "madeUpJson",
      file: "synthetic",
    };
    const withSynthetic = [...derived, synthetic];
    const missing = withSynthetic.filter((c) => !LEDGER_BY_KEY.has(c.key)).map((c) => c.key);
    expect(missing).toContain(synthetic.key);
  });

  it("[falsifiability] an 'owned' row naming a nonexistent parser file IS reported", () => {
    const badRow: OwnedRow = {
      key: "segment.rules_json",
      verdict: "owned",
      parser: "src/does/not/exist.ts",
      refusalTest: "test/segment-rules-json.test.ts",
      refusalSymbol: "parseSegmentRulesJson",
    };
    const column = derived.find((c) => c.key === badRow.key);
    expect(column).toBeDefined();
    const result = ownedRowHasLiveOwner(badRow, column!);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("does not exist on disk");
  });

  it("[falsifiability] an 'owned' row claiming a real, wired parser for a column whose property is never touched IS reported", () => {
    // form-tracks.ts is a REAL, called parser (check (b) passes) -- but
    // claiming it as the owner of a made-up column whose property never
    // appears anywhere in src/ must still fail on check (c): the parser
    // being wired to SOMETHING doesn't make it the owner of THIS column.
    const syntheticColumn: JsonColumn = {
      key: "nonexistent_table.made_up_json",
      table: "nonexistent_table",
      column: "made_up_json",
      property: "totallyMadeUpPropertyNameXyz",
      file: "synthetic",
    };
    const badRow: OwnedRow = {
      key: syntheticColumn.key,
      verdict: "owned",
      parser: "src/forms/form-tracks.ts",
      refusalTest: "test/form-tracks-single-parser.test.ts",
      refusalSymbol: "parseFormTracks",
    };
    const result = ownedRowHasLiveOwner(badRow, syntheticColumn);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("totallyMadeUpPropertyNameXyz");
  });

  it("[falsifiability] an 'owned' row whose refusalTest file does not exist IS reported (DEC-839)", () => {
    const badRow: OwnedRow = {
      key: "segment.rules_json",
      verdict: "owned",
      parser: "src/domain/contacts-parts/segments.ts",
      refusalTest: "test/does-not-exist-refusal.test.ts",
      refusalSymbol: "parseSegmentRulesJson",
    };
    const result = ownedRowHasRefusalTest(badRow);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("does not exist on disk");
  });

  it("[falsifiability] an 'owned' row whose refusalTest exists but never mentions the claimed symbol IS reported (DEC-839)", () => {
    // A real, on-disk test file that simply doesn't test the claimed
    // symbol -- proves the check reads the FILE CONTENTS, not just its
    // existence.
    const badRow: OwnedRow = {
      key: "segment.rules_json",
      verdict: "owned",
      parser: "src/domain/contacts-parts/segments.ts",
      refusalTest: "test/form-field-json-parser.test.ts",
      refusalSymbol: "parseSegmentRulesJson",
    };
    const result = ownedRowHasRefusalTest(badRow);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("parseSegmentRulesJson");
  });

  it("[falsifiability] a stale ledger row (column no longer derived) IS reported", () => {
    const staleLedger: LedgerRow[] = [
      ...LEDGER,
      {
        key: "renamed_table.old_column_json",
        verdict: "owned",
        parser: "src/forms/form-tracks.ts",
        refusalTest: "test/form-tracks-single-parser.test.ts",
        refusalSymbol: "parseFormTracks",
      },
    ];
    const derivedKeys = new Set(derived.map((c) => c.key));
    const stale = staleLedger.filter((row) => !derivedKeys.has(row.key)).map((row) => row.key);
    expect(stale).toContain("renamed_table.old_column_json");
  });

  it("[positive control] the real ledger, checked against the real derivation, has zero stale rows and zero missing rows today", () => {
    const derivedKeys = new Set(derived.map((c) => c.key));
    const stale = LEDGER.filter((row) => !derivedKeys.has(row.key));
    const missing = derived.filter((c) => !LEDGER_BY_KEY.has(c.key));
    expect(stale).toEqual([]);
    expect(missing).toEqual([]);
  });
});
