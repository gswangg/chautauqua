// Mint-door cap census (DEC-180, wave-23 amendment). MEASUREMENT ONLY: this
// scan changes no product byte.
//
// test/batch-cap-declaration.scan.test.ts and app/src/cap-crossing.scan.
// test.ts both start from the DECLARED caps (`export const MAX_* = <number>`
// in src/domain/**) and grade where they live, how they cross into the SPA,
// and whether copy quotes them. Neither starts from the WRITE DOORS and asks
// whether each has a cap at all -- which is exactly how POST
// /api/v1/events/:eventId/templates shipped with no bound on this sha. A
// population derived from the answers can never find a missing answer
// (DEC-180's own rule).
//
// POPULATION: readdirSync(recursive) over src/routes/** for every *.ts file,
// scanning for `<var>Routes.post("/api/v1/...` handler registrations --
// never a hand-listed file array. Each match is CLASSIFIED (by curated,
// re-verified-every-run judgment -- see DOOR_REGISTRY below) as a MINT door
// (its handler, or the specific repo/** function it calls, performs a
// `db.insert(`) or a NON-MINT door (acts on rows that already exist:
// preview, send, reorder, advance-round, remind, reset-password). One
// exception found while building this census and corrected here: `distribute`
// DOES insert plan_reviewer rows via repo.addReviewers -- the illustrative
// NON-MINT list in this census's own mandate was wrong about that one door;
// code beats a citation (DEC-967).
//
// GRADE: a MINT door PASSES iff its own handler body, or the specific
// repo/** insert function it reaches, references a MAX_* constant that is a
// batch/count cap (not a text-length cap) OR carries a `mint-cap-exempt:
// <reason>` comment on its own line. The text-length/batch-cap partition is
// not invented here -- it reuses test/batch-cap-declaration.scan.test.ts's
// own established distinction (its isTextLengthName helper, DEC-422): a
// name ending `_LENGTH`/`_MAX_LEN` bounds one field's string length, not how
// many rows can accumulate or how large one mint's batch is. Without this
// partition the census is vacuous: templates already references
// MAX_NAME_LENGTH/MAX_TEXT_LENGTH/MAX_RICH_TEXT_LENGTH for field validation
// and would read PASS despite having *zero* cap on the number of templates
// an event can accumulate -- exactly the gap this census exists to catch.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_ROOT = join(HERE, "..", "src", "routes");
const REPO_ROOT = join(HERE, "..", "src", "server", "repo");

function allRouteFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(ROUTES_ROOT, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface DoorMatch {
  file: string;
  relFile: string;
  route: string;
  line: number;
  index: number; // char offset of the match in the file's source
}

const POST_V1_RE = /\w+Routes\.post\(\s*"(\/api\/v1\/[^"]+)"/g;

/** Every `Routes.post("/api/v1/...` registration found by walking the
 * source, never a hand-listed manifest. */
function findDoors(): DoorMatch[] {
  const out: DoorMatch[] = [];
  for (const file of allRouteFiles()) {
    const src = readFileSync(file, "utf-8");
    for (const m of src.matchAll(POST_V1_RE)) {
      const upToMatch = src.slice(0, m.index);
      const line = upToMatch.split("\n").length;
      out.push({ file, relFile: relative(HERE, file), route: m[1] as string, line, index: m.index as number });
    }
  }
  return out;
}

/** Extracts a handler's body text by brace-counting from the first `{`
 * after the match to its balanced close. Sufficient for this population:
 * every route handler here is `async (c) => { ... });`, and there is no
 * `{`-bearing type annotation between the route registration and the
 * handler's own opening brace. */
function handlerBodyAt(src: string, matchIndex: number): string {
  const openIdx = src.indexOf("{", matchIndex);
  if (openIdx === -1) throw new Error(`handlerBodyAt: no '{' found after index ${matchIndex}`);
  return bracesFrom(src, openIdx);
}

function bracesFrom(src: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  throw new Error(`bracesFrom: unbalanced braces from index ${openIdx}`);
}

/** Extracts an exported async function's body, skipping past a parameter
 * list that may itself contain `{ ... }` inline object types (e.g.
 * `input: { planId: string; ... }`) and a return-type annotation that may
 * itself contain `{ ... }` inside generics (e.g. `Promise<{ recusal: ...;
 * created: boolean }>`). Finds the matching `)` of the parameter list by
 * paren-depth, then the first `{` that is not nested inside a `<...>`
 * generic in the return-type text between `)` and the real body. */
function functionBodyFrom(src: string, declStartIdx: number): string {
  const parenOpenIdx = src.indexOf("(", declStartIdx);
  if (parenOpenIdx === -1) throw new Error(`functionBodyFrom: no '(' found after index ${declStartIdx}`);
  let parenDepth = 0;
  let parenCloseIdx = -1;
  for (let i = parenOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") parenDepth++;
    else if (ch === ")") {
      parenDepth--;
      if (parenDepth === 0) {
        parenCloseIdx = i;
        break;
      }
    }
  }
  if (parenCloseIdx === -1) throw new Error(`functionBodyFrom: unbalanced parens from index ${parenOpenIdx}`);

  let angleDepth = 0;
  for (let i = parenCloseIdx + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === "<") angleDepth++;
    else if (ch === ">") angleDepth = Math.max(0, angleDepth - 1);
    else if (ch === "{" && angleDepth === 0) return bracesFrom(src, i);
  }
  throw new Error(`functionBodyFrom: no top-level '{' found after params closing at index ${parenCloseIdx}`);
}

/** A name ending in _LENGTH/_MAX_LEN is a text-length bound (owned by
 * test/text-cap-declaration.scan.test.ts and app/src/cap-crossing.scan.
 * test.ts), not a batch/count cap on how many rows a mint can create --
 * reuses test/batch-cap-declaration.scan.test.ts's own partition (DEC-422). */
function isTextLengthName(name: string): boolean {
  return /_LENGTH$|_MAX_LEN$/.test(name);
}

const MAX_CONST_RE = /\bMAX_[A-Z0-9_]*\b/g;

/** Every MAX_* identifier referenced in `src` that is a batch/count cap
 * (i.e. NOT a text-length bound). */
function batchCapRefs(src: string): string[] {
  return [...new Set([...src.matchAll(MAX_CONST_RE)].map((m) => m[0]))].filter((n) => !isTextLengthName(n));
}

const MINT_CAP_EXEMPT_RE = /mint-cap-exempt:\s*.+/;

/** Grades one mint door's source snippets (handler + the specific repo
 * insert fn it reaches, when named). PASS iff any snippet references a
 * batch/count MAX_* constant, or any snippet carries a `mint-cap-exempt:`
 * comment on its own line. */
function gradeMintDoor(snippets: string[]): { pass: boolean; capRefs: string[]; exempt: string | null } {
  const capRefs = [...new Set(snippets.flatMap(batchCapRefs))];
  const exemptMatch = snippets.map((s) => s.match(MINT_CAP_EXEMPT_RE)).find((m) => m !== null);
  const exempt = exemptMatch ? (exemptMatch[0] as string).trim() : null;
  return { pass: capRefs.length > 0 || exempt !== null, capRefs, exempt };
}

type Kind = "mint" | "non-mint";

/** Curated classification + (for mint doors) the specific repo/** insert
 * function reached, re-verified every run against the live source (see the
 * "every registry entry's repo target still exists / still inserts" and
 * "every registry entry's route still resolves" checks below) -- this is
 * NOT a hand-listed population (the door list itself comes from findDoors()
 * above); it is the judgment call findDoors() cannot make on its own
 * (mint vs non-mint, which repo fn to check) recorded so it can be checked. */
interface RegistryEntry {
  route: string;
  file: string; // relative to src/routes
  kind: Kind;
  repoFile?: string; // relative to src/server/repo, for mint doors
  repoFn?: string; // exported function name in repoFile
  note: string;
}

const DOOR_REGISTRY: RegistryEntry[] = [
  {
    route: "/api/v1/forms/:formId/fields",
    file: "api/forms.ts",
    kind: "mint",
    repoFile: "forms.ts",
    repoFn: "createField",
    note: "creates a form field; handler checks existing.length >= MAX_FORM_FIELDS before insert.",
  },
  {
    route: "/api/v1/forms/:formId/fields/reorder",
    file: "api/forms.ts",
    kind: "non-mint",
    note: "reorders existing fields, no insert.",
  },
  {
    route: "/api/v1/tokens",
    file: "api/tokens.ts",
    kind: "mint",
    note: "handler itself db.insert(schema.apiToken); checks existingCount >= MAX_API_TOKENS_PER_ORG before insert.",
  },
  {
    route: "/api/v1/users/:id/reset-password",
    file: "api/users.ts",
    kind: "non-mint",
    note: "rotates password hash on an existing user row, no insert.",
  },
  {
    route: "/api/v1/users",
    file: "api/users.ts",
    kind: "mint",
    repoFile: "users.ts",
    repoFn: "createUser",
    note: "creates an org user; handler and createUser reference only MAX_NAME_LENGTH/MAX_PASSWORD_LENGTH (text-length), no cap on how many users an org can accumulate.",
  },
  {
    route: "/api/v1/events/:eventId/portal-invites",
    file: "comms/portal-invites.ts",
    kind: "mint",
    note: "mints real claim tokens (mintPortalLinks) and logs email_log rows; handler bounds the recipient batch via parseBoundedIdArray(..., { maxCount: MAX_PORTAL_INVITE_RECIPIENTS }).",
  },
  {
    route: "/api/v1/events/:eventId/compose/preview",
    file: "comms/preview.ts",
    kind: "non-mint",
    note: "dry-run render, no insert.",
  },
  {
    route: "/api/v1/events/:eventId/compose/send",
    file: "comms/send.ts",
    kind: "non-mint",
    note: "sends to existing submissions/participants; email_log rows are a logging side-effect of the mailer, not this door's primary mint.",
  },
  {
    route: "/api/v1/events/:eventId/templates",
    file: "comms/templates.ts",
    kind: "mint",
    repoFile: "comms.ts",
    repoFn: "createTemplate",
    note: "creates a template; handler and createTemplate reference only MAX_NAME_LENGTH/MAX_TEXT_LENGTH/MAX_RICH_TEXT_LENGTH (text-length), no cap on how many templates an event can accumulate -- the motivating gap for this whole census.",
  },
  {
    route: "/api/v1/plans/:id/advance-round",
    file: "review/plans-crud.ts",
    kind: "non-mint",
    note: "advances plan.currentRound on the existing plan row, no insert.",
  },
  {
    route: "/api/v1/plans/:id/waves",
    file: "review/plans-crud.ts",
    kind: "non-mint",
    note: "repo.startNewWave is a db.update on the existing plan row (rounds/currentRound/roundCriteriaJson), not an insert; also gated on plan.rounds >= MAX_PLAN_ROUNDS regardless.",
  },
  {
    route: "/api/v1/events/:eventId/plans",
    file: "review/plans-crud.ts",
    kind: "mint",
    repoFile: "review/plans.ts",
    repoFn: "createPlan",
    note: "creates a plan; handler and createPlan reference only MAX_NAME_LENGTH/MAX_LONG_TEXT_LENGTH (text-length). MAX_PLAN_ROUNDS does bound the rounds field, but it lives inside parseRounds's own body in src/routes/review/shared.ts -- the handler only CALLS parseRounds, its body text never appears in the handler snippet this census greps, so MAX_PLAN_ROUNDS is outside this census's grading surface as specified (handler body + named repo/** insert fn only). No cap on how many plans an event can accumulate either way. Uncapped by this census's rule.",
  },
  {
    route: "/api/v1/plans/:id/assignments/distribute",
    file: "review/plans-distribute.ts",
    kind: "mint",
    note: "repo.addReviewers db.inserts plan_reviewer rows for the whole computed set; handler refuses BEFORE writing when created.length > MAX_DISTRIBUTE_ASSIGNMENT_WRITES.",
  },
  {
    route: "/api/v1/plans/:id/remind",
    file: "review/plans-progress.ts",
    kind: "non-mint",
    note: "sends reminder emails to existing reviewer rows, no insert of a new domain row.",
  },
  {
    route: "/api/v1/plans/:id/reviewers",
    file: "review/plans-reviewers.ts",
    kind: "mint",
    repoFile: "review/reviewers.ts",
    repoFn: "addReviewers",
    note: "creates plan_reviewer rows; neither the handler nor addReviewers references any MAX_* constant -- the array-form input is bounded only by parseBoundedIdArray's DEFAULT_BOUNDED_ID_ARRAY_MAX default, which lives in src/server/http.ts (neither the handler file nor a src/server/repo/** function), so it is outside this census's grading surface as specified. Uncapped by this census's rule.",
  },
  {
    route: "/api/v1/review/plans/:planId/recusals/:submissionId",
    file: "review/recusals.ts",
    kind: "mint",
    repoFile: "review/recusal.ts",
    repoFn: "createRecusal",
    note: "creates a recusal row via db.insert(...).onConflictDoNothing keyed on the (planId, submissionId, userId) uniqueIndex -- structurally bounded by that index, but references only MAX_RECUSAL_REASON_LENGTH (text-length); no batch/count MAX_* and no mint-cap-exempt comment, so this census grades it uncapped.",
  },
];

function registryKey(e: { route: string; file: string }): string {
  return `${e.file}::${e.route}`;
}

describe("mint-door cap census (DEC-180 wave-23 amendment) -- measurement only, fixes no door", () => {
  const doors = findDoors();

  it("vacuity tripwire: found more than one route file, and the population is non-empty", () => {
    expect(new Set(doors.map((d) => d.file)).size).toBeGreaterThan(1);
    expect(doors.length).toBeGreaterThan(0);
  });

  it("vacuity tripwire: total door count matches the registry exactly (no drift)", () => {
    // Normalize doors' relFile to be relative to src/routes, matching the registry's `file`.
    const normalizedDoors = doors.map((d) => ({
      route: d.route,
      file: relative(ROUTES_ROOT, d.file).split("\\").join("/"),
    }));
    const doorKeys = new Set(normalizedDoors.map(registryKey));
    const registryKeys = new Set(DOOR_REGISTRY.map(registryKey));

    const undocumented = [...doorKeys].filter((k) => !registryKeys.has(k));
    const stale = [...registryKeys].filter((k) => !doorKeys.has(k));

    expect(undocumented, `POST /api/v1 doors found in source but missing from DOOR_REGISTRY:\n${undocumented.join("\n")}`).toEqual([]);
    expect(stale, `DOOR_REGISTRY entries whose route no longer exists in source:\n${stale.join("\n")}`).toEqual([]);
  });

  it("vacuity tripwire: exact total door count and mint/non-mint split", () => {
    expect(doors.length).toBe(16);
    expect(DOOR_REGISTRY.filter((e) => e.kind === "mint").length).toBe(9);
    expect(DOOR_REGISTRY.filter((e) => e.kind === "non-mint").length).toBe(7);
  });

  it("every mint registry entry names a repo function OR is graded directly off its own handler body, and (when named) that function still exists and still inserts", () => {
    for (const entry of DOOR_REGISTRY) {
      if (entry.kind !== "mint") continue;
      if (!entry.repoFile || !entry.repoFn) continue; // graded off the handler alone (tokens, portal-invites, distribute)
      const repoPath = join(REPO_ROOT, entry.repoFile);
      const src = readFileSync(repoPath, "utf-8");
      expect(src, `${entry.repoFile} does not export ${entry.repoFn} -- registry entry for ${entry.route} is stale`).toMatch(
        new RegExp(`export async function ${entry.repoFn}\\b`),
      );
      const fnMatch = src.match(new RegExp(`export async function ${entry.repoFn}\\b`));
      expect(fnMatch, `could not locate ${entry.repoFn} declaration in ${entry.repoFile}`).not.toBeNull();
      const fnDeclIdx = src.indexOf((fnMatch as RegExpMatchArray)[0]);
      const fnBody = functionBodyFrom(src, fnDeclIdx);
      expect(fnBody, `${entry.repoFn} in ${entry.repoFile} no longer contains a db.insert( -- registry mint classification for ${entry.route} is stale`).toMatch(
        /db\s*\.\s*insert\s*\(/,
      );
    }
  });

  function gradedSnippetsFor(entry: RegistryEntry, doorsList: DoorMatch[]): string[] {
    const routePath = join(ROUTES_ROOT, entry.file);
    const routeSrc = readFileSync(routePath, "utf-8");
    const door = doorsList.find(
      (d) => d.route === entry.route && relative(ROUTES_ROOT, d.file).split("\\").join("/") === entry.file,
    );
    if (!door) throw new Error(`no door match for registry entry ${entry.route} (${entry.file})`);
    const handlerBody = handlerBodyAt(routeSrc, door.index);
    const snippets = [handlerBody];
    if (entry.repoFile && entry.repoFn) {
      const repoSrc = readFileSync(join(REPO_ROOT, entry.repoFile), "utf-8");
      const fnMatch = repoSrc.match(new RegExp(`export async function ${entry.repoFn}\\b`));
      if (fnMatch) {
        const fnDeclIdx = repoSrc.indexOf(fnMatch[0]);
        snippets.push(functionBodyFrom(repoSrc, fnDeclIdx));
      }
    }
    return snippets;
  }

  const MINT_DOORS = DOOR_REGISTRY.filter((e) => e.kind === "mint");

  it("SEEDED MEASUREMENT: every mint door's grade matches this census's recorded verdict", () => {
    // This it() is the seed step: force EXPECTED_OFFENDERS to [] and read
    // the printed failure to regenerate the offender list, per the DEC-180
    // wave-23 mandate ("force the constant to -1, run, read the offender
    // list back"). The list below IS that reading, taken on this branch's
    // sha -- see docs/design/audit/mint-door-caps-v12.md for the full table
    // and the sha it was measured against.
    const EXPECTED_OFFENDERS = [
      "/api/v1/users (api/users.ts)",
      "/api/v1/events/:eventId/templates (comms/templates.ts)",
      "/api/v1/events/:eventId/plans (review/plans-crud.ts)",
      "/api/v1/plans/:id/reviewers (review/plans-reviewers.ts)",
      "/api/v1/review/plans/:planId/recusals/:submissionId (review/recusals.ts)",
    ];
    const offenders: string[] = [];
    for (const entry of MINT_DOORS) {
      const snippets = gradedSnippetsFor(entry, doors);
      const { pass } = gradeMintDoor(snippets);
      if (!pass) offenders.push(`${entry.route} (${entry.file})`);
    }
    expect(offenders.sort(), `uncapped mint doors:\n${offenders.join("\n")}`).toEqual(EXPECTED_OFFENDERS.slice().sort());
  });

  // RATCHET (two-sided, DEC-808): seeded by forcing this to -1 and reading
  // the offender list printed above back -- measured 5 on this branch's sha
  // (see the doc for the exact sha). Never invented, never converted from
  // the failure output into an allowlist.
  const MINT_DOOR_UNCAPPED_CEILING = 5;

  it(`ratchet: no more than ${MINT_DOOR_UNCAPPED_CEILING} mint doors are uncapped`, () => {
    const offenders: string[] = [];
    for (const entry of MINT_DOORS) {
      const snippets = gradedSnippetsFor(entry, doors);
      const { pass } = gradeMintDoor(snippets);
      if (!pass) offenders.push(`${entry.route} :: ${entry.file}`);
    }
    expect(offenders.length, `uncapped mint doors (ceiling ${MINT_DOOR_UNCAPPED_CEILING}):\n${offenders.join("\n")}`).toBeLessThanOrEqual(
      MINT_DOOR_UNCAPPED_CEILING,
    );
  });

  it(`ratchet companion: the uncapped-door count has not silently dropped below ${MINT_DOOR_UNCAPPED_CEILING} without the constant being lowered`, () => {
    const offenders: string[] = [];
    for (const entry of MINT_DOORS) {
      const snippets = gradedSnippetsFor(entry, doors);
      const { pass } = gradeMintDoor(snippets);
      if (!pass) offenders.push(`${entry.route} :: ${entry.file}`);
    }
    if (offenders.length < MINT_DOOR_UNCAPPED_CEILING) {
      throw new Error(
        `uncapped mint-door count dropped to ${offenders.length} (ceiling is ${MINT_DOOR_UNCAPPED_CEILING}) -- ` +
          `lower MINT_DOOR_UNCAPPED_CEILING to ${offenders.length} in this file. Remaining offenders:\n${offenders.join("\n")}`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(MINT_DOOR_UNCAPPED_CEILING);
  });

  it("every mint door graded PASS is passing for the stated reason: a real batch/count MAX_* reference or a mint-cap-exempt comment", () => {
    for (const entry of MINT_DOORS) {
      const snippets = gradedSnippetsFor(entry, doors);
      const { pass, capRefs, exempt } = gradeMintDoor(snippets);
      const isOffender = [
        "/api/v1/users",
        "/api/v1/events/:eventId/templates",
        "/api/v1/events/:eventId/plans",
        "/api/v1/plans/:id/reviewers",
        "/api/v1/review/plans/:planId/recusals/:submissionId",
      ].includes(entry.route);
      if (isOffender) continue;
      expect(pass, `${entry.route} (${entry.file}) expected PASS but graded uncapped`).toBe(true);
      expect(
        capRefs.length > 0 || exempt !== null,
        `${entry.route} (${entry.file}) passed with no capRefs and no exempt comment -- grading bug`,
      ).toBe(true);
    }
  });

  // Positive control: the classifier is not vacuously green. A synthetic
  // uncapped-door fixture (a handler containing a real db.insert( and only
  // a text-length MAX_* reference) must be graded FAIL.
  it("positive control: a synthetic uncapped mint-door fixture is graded FAIL", () => {
    const fixtureHandler = `{
      const body = await readJsonBody(c);
      if (body.name.length > MAX_WIDGET_NAME_LENGTH) throw new ApiError("invalid", "too long");
      const created = await repo.createWidget(c.var.db, { name: body.name });
      return c.json(created, 201);
    }`;
    const fixtureRepoFn = `{
      await db.insert(schema.widget).values({ id: newId(), name: input.name });
    }`;
    const { pass, capRefs } = gradeMintDoor([fixtureHandler, fixtureRepoFn]);
    expect(pass, "positive control fixture should grade uncapped (no batch/count MAX_*)").toBe(false);
    expect(capRefs).toEqual([]);
  });

  // Positive control, the other direction: the same fixture WITH a real
  // batch/count MAX_* reference (not _LENGTH-suffixed) grades PASS.
  it("positive control: the same fixture with a batch/count MAX_* reference grades PASS", () => {
    const fixtureHandler = `{
      const existing = await repo.countWidgets(c.var.db, eventId);
      if (existing >= MAX_WIDGETS_PER_EVENT) throw new ApiError("invalid", "cap reached");
      const created = await repo.createWidget(c.var.db, { name: body.name });
      return c.json(created, 201);
    }`;
    const { pass, capRefs } = gradeMintDoor([fixtureHandler]);
    expect(pass).toBe(true);
    expect(capRefs).toEqual(["MAX_WIDGETS_PER_EVENT"]);
  });

  // Positive control, exemption path: a fixture with no MAX_* but a
  // mint-cap-exempt comment on its own line grades PASS.
  it("positive control: a mint-cap-exempt comment (with no MAX_* reference) grades PASS", () => {
    const fixtureHandler = `{
      // mint-cap-exempt: singleton row, upserted via a uniqueIndex, cannot accumulate
      const created = await repo.createWidgetSingleton(c.var.db, { name: body.name });
      return c.json(created, 201);
    }`;
    const { pass, exempt } = gradeMintDoor([fixtureHandler]);
    expect(pass).toBe(true);
    expect(exempt).toMatch(/^mint-cap-exempt: /);
  });

  it("isTextLengthName partition matches test/batch-cap-declaration.scan.test.ts's own examples", () => {
    expect(isTextLengthName("MAX_NAME_LENGTH")).toBe(true);
    expect(isTextLengthName("MAX_RICH_TEXT_LENGTH")).toBe(true);
    expect(isTextLengthName("MAX_API_TOKENS_PER_ORG")).toBe(false);
    expect(isTextLengthName("MAX_FORM_FIELDS")).toBe(false);
  });

  // DEC-808 wave-27 (task w27-a): companion for test/campaign-ratchet-two-
  // sided.scan.test.ts's ABOVE-direction detector. The "ratchet:" `it`
  // above already asserts this same bound, but its
  // `.toBeLessThanOrEqual(\n MINT_DOOR_UNCAPPED_CEILING,\n)` call has a
  // trailing comma between the constant and the closing paren, which the
  // two-sided scan's single-line regex does not match -- so from that
  // scan's point of view the ceiling direction was invisible even though
  // the BELOW-direction "ratchet companion" `it` above it does match.
  // Appended here (never editing the existing `it`s, per that scan's own
  // instruction) as a single-line form the detector recognizes.
  it(`ratchet (single-line form for the two-sided scan): offenders never exceed ${MINT_DOOR_UNCAPPED_CEILING}`, () => {
    const offenders: string[] = [];
    for (const entry of MINT_DOORS) {
      const snippets = gradedSnippetsFor(entry, doors);
      const { pass } = gradeMintDoor(snippets);
      if (!pass) offenders.push(`${entry.route} :: ${entry.file}`);
    }
    expect(offenders.length).toBeLessThanOrEqual(MINT_DOOR_UNCAPPED_CEILING);
  });
});
