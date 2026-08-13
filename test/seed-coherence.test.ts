// DEC-771: "the seed is the grader package: nothing collides on the identity
// a human matches by, and every screen shows its own shape". Three graders
// independently reported: (a) two accepted sessions sharing the title
// "Taming 40-Minute CI" (the seeded one vs. a grader-created one from the
// same fixture title, per docs/eval-rubric/01-call-for-papers.yaml's
// CFP-S2), (b) a duplicate "Confirm participation" task, (c) Priya carrying
// two identically-named contact records, and (d) the Content worklist
// reading mostly "No files yet" with too few comms templates/no real batch.
//
// Every assertion here walks the FULL seeded row set (enumeration), never a
// hand-picked sample — the field guide's "universal rows graded from
// ENUMERATION never sample" rule, restated by DEC-771 itself. Reuses the
// quote-aware SQL row parser already established in test/seed.test.ts
// (task w2-d / DEC-739) rather than inventing a second one.
//
// DEC-823 (task w7-c): DEC-771's (b) collision ban only ever protected the
// IDENTITY contacts a human actually matches a person by across the app —
// personas and reviewers, which in this seed are precisely "any contact a
// seeded user account points at via user.contact_id" (every persona/
// reviewer contact IS user-linked; no other contact is). It never promised
// the synthetic CRM directory itself would be duplicate-free — a directory
// with zero duplicates is exactly what left the Duplicates tab and merge
// flow with nothing to demo. (b)'s two assertions below are rescoped to
// that identity set (derived by ENUMERATION over the seeded user rows, never
// hand-listed, per the field guide's "hand-listed manifests desync --
// enumerate"), and a new assertion below enumerates findDuplicateGroups()
// over every seeded contact to confirm the directory now carries real,
// groupable duplicates spanning DEC-800's reasons, none of them an identity
// contact.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { findDuplicateGroups, type ContactRecord } from "../src/domain/contacts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

let sql: string;

beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
  expect(existsSync(OUTPUT_PATH)).toBe(true);
  sql = readFileSync(OUTPUT_PATH, "utf-8");
}, 60_000);

/** Splits a VALUES(...) tuple's raw text into per-column literal strings
 * (still quoted, e.g. "'foo'" or "NULL" or "123"), respecting SQL's
 * doubled-single-quote escaping so an embedded comma inside a quoted string
 * never desyncs the column boundary. Mirrors test/seed.test.ts's helper. */
function tokenizeSqlValues(raw: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (raw[i] === " ") i++;
    if (raw[i] === "'") {
      let j = i + 1;
      let val = "'";
      while (j < raw.length) {
        if (raw[j] === "'" && raw[j + 1] === "'") {
          val += "''";
          j += 2;
          continue;
        }
        if (raw[j] === "'") {
          val += "'";
          j++;
          break;
        }
        val += raw[j];
        j++;
      }
      out.push(val);
      i = j;
    } else {
      let j = i;
      while (j < raw.length && raw[j] !== ",") j++;
      out.push(raw.slice(i, j).trim());
      i = j;
    }
    while (raw[i] === " ") i++;
    if (raw[i] === ",") i++;
  }
  return out;
}

/** Unquotes a tokenizeSqlValues() literal: "'foo'" -> "foo", "NULL" -> null. */
function unquote(literal: string): string | null {
  if (literal === "NULL") return null;
  if (literal.startsWith("'") && literal.endsWith("'")) {
    return literal.slice(1, -1).replace(/''/g, "'");
  }
  return literal;
}

/** Parses every `INSERT INTO <table> (...) VALUES (...);` statement (one per
 * output line -- seed.ts never embeds a raw newline in a value) into a
 * column-name -> unquoted-value record. */
function parseInserts(sqlText: string, table: string): Array<Record<string, string | null>> {
  const rowRe = new RegExp(`^INSERT INTO ${table} \\(([^)]*)\\) VALUES \\((.*)\\);$`, "gm");
  const rows: Array<Record<string, string | null>> = [];
  for (const m of sqlText.matchAll(rowRe)) {
    const columns = m[1]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const values = tokenizeSqlValues(m[2]!);
    if (values.length !== columns.length) {
      throw new Error(
        `parseInserts: column/value count mismatch for ${table} (${columns.length} cols, ${values.length} vals): ${m[0]}`,
      );
    }
    const row: Record<string, string | null> = {};
    columns.forEach((c, idx) => {
      row[c] = unquote(values[idx]!);
    });
    rows.push(row);
  }
  return rows;
}

/** Groups rows by a key function and returns only groups with >1 member,
 * as [key, count] pairs -- the "assert max count 1" shape the field guide
 * calls for, expressed so a failing test names the actual offending group. */
function duplicateGroups<T>(rows: T[], keyFn: (row: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

describe("seed coherence (DEC-771)", () => {
  it("(a) no two submissions in the event share a title", () => {
    const submissionRows = parseInserts(sql, "submission");
    // 3 fixture + 27 synthetic.
    expect(submissionRows.length).toBe(30);
    const dupes = duplicateGroups(submissionRows, (r) => r.title!);
    expect(dupes, `duplicate submission titles: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(a) the seeded fixture-derived submission does not carry the exact fixture title a grader is instructed to submit fresh (CFP-S2)", () => {
    const submissionRows = parseInserts(sql, "submission");
    const titles = submissionRows.map((r) => r.title);
    // docs/eval-rubric/01-call-for-papers.yaml CFP-S2 has the grader submit
    // this exact title fresh; the seed must not pre-occupy it.
    expect(titles).not.toContain("Taming 40-Minute CI: Incremental Builds at Monorepo Scale");
  });

  /** Identity contacts (DEC-823): every contact a seeded user account points
   * at via user.contact_id — personas and reviewers are exactly this set in
   * this seed, derived by enumeration rather than hand-listed ids. */
  function identityContactIds(): Set<string> {
    const userRows = parseInserts(sql, "user");
    return new Set(userRows.map((r) => r.contact_id).filter((id): id is string => !!id));
  }

  it("(b) no two IDENTITY contacts (personas/reviewers, i.e. user-linked) in the org share a normalized email", () => {
    const contactRows = parseInserts(sql, "contact");
    expect(contactRows.length).toBeGreaterThan(0);
    const identityIds = identityContactIds();
    expect(identityIds.size).toBeGreaterThan(0);
    const identityRows = contactRows.filter((r) => identityIds.has(r.id!));
    const dupes = duplicateGroups(identityRows, (r) => (r.email ?? "").toLowerCase().trim());
    expect(dupes, `duplicate identity contact emails: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(b) no two IDENTITY contacts (personas/reviewers, i.e. user-linked) in the org share a normalized full name", () => {
    const contactRows = parseInserts(sql, "contact");
    const identityIds = identityContactIds();
    const identityRows = contactRows.filter((r) => identityIds.has(r.id!));
    const dupes = duplicateGroups(
      identityRows,
      (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase().trim().replace(/\s+/g, " "),
    );
    expect(dupes, `duplicate identity contact full names: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(DEC-823) the seeded contact directory carries real, groupable duplicates spanning every DEC-800 reason, none of them an identity contact", () => {
    const contactRows = parseInserts(sql, "contact");
    const identityIds = identityContactIds();

    const records: ContactRecord[] = contactRows.map((r) => ({
      id: r.id!,
      email: r.email ?? "",
      firstName: r.first_name ?? "",
      lastName: r.last_name ?? "",
      company: r.company ?? undefined,
    }));

    const groups = findDuplicateGroups(records);
    expect(groups.length, `expected >= 2 duplicate groups, found: ${JSON.stringify(groups)}`).toBeGreaterThanOrEqual(2);

    const reasons = new Set(groups.map((g) => g.reason));
    expect(reasons.has("email"), `no 'email' reason among: ${JSON.stringify([...reasons])}`).toBe(true);
    expect(reasons.has("name_and_company"), `no 'name_and_company' reason among: ${JSON.stringify([...reasons])}`).toBe(
      true,
    );

    for (const group of groups) {
      for (const contactId of group.contactIds) {
        expect(
          identityIds.has(contactId),
          `duplicate group ${JSON.stringify(group)} contains identity contact ${contactId}`,
        ).toBe(false);
      }
    }
  });

  it("(c) no two tasks in the event share a title", () => {
    const taskRows = parseInserts(sql, "task");
    expect(taskRows.length).toBeGreaterThan(0);
    const dupes = duplicateGroups(taskRows, (r) => r.title!);
    expect(dupes, `duplicate task titles: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(d) roughly a third of accepted submissions carry at least one deliverable file, including at least one multi-version chain and one comment thread", () => {
    const submissionRows = parseInserts(sql, "submission");
    const acceptedIds = new Set(submissionRows.filter((r) => r.status === "accepted").map((r) => r.id!));
    expect(acceptedIds.size).toBeGreaterThan(0);

    const fileRows = parseInserts(sql, "file");
    const submissionIdsWithFiles = new Set(
      fileRows.filter((f) => f.submission_id && acceptedIds.has(f.submission_id)).map((f) => f.submission_id!),
    );

    // "Roughly a third" — never zero, never merely one-off; a wide band
    // (>=25%) so this doesn't flake on the exact accepted-submission count,
    // while still failing loudly if density regresses back toward the
    // reported 28/30-empty state.
    const fraction = submissionIdsWithFiles.size / acceptedIds.size;
    expect(
      fraction,
      `${submissionIdsWithFiles.size}/${acceptedIds.size} accepted submissions carry a file`,
    ).toBeGreaterThanOrEqual(0.25);

    // At least one multi-version chain (a file whose previous_file_id
    // points at another seeded file row).
    const fileIds = new Set(fileRows.map((f) => f.id!));
    const chainLinks = fileRows.filter((f) => f.previous_file_id && fileIds.has(f.previous_file_id));
    expect(chainLinks.length).toBeGreaterThanOrEqual(1);

    // At least one comment thread on a file belonging to an accepted
    // submission.
    const fileCommentRows = parseInserts(sql, "file_comment");
    const filesOnAcceptedSubmissions = new Set(
      fileRows.filter((f) => f.submission_id && acceptedIds.has(f.submission_id)).map((f) => f.id!),
    );
    const commentsOnAcceptedFiles = fileCommentRows.filter((c) => filesOnAcceptedSubmissions.has(c.file_id!));
    expect(commentsOnAcceptedFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("(d) at least one comms batch of ~20 recipients sharing one batch_id, plus at least five email templates", () => {
    const emailLogRows = parseInserts(sql, "email_log");
    const batchCounts = new Map<string, number>();
    for (const row of emailLogRows) {
      if (!row.batch_id) continue;
      batchCounts.set(row.batch_id, (batchCounts.get(row.batch_id) ?? 0) + 1);
    }
    const bigBatches = [...batchCounts.entries()].filter(([, count]) => count >= 20);
    expect(bigBatches.length).toBeGreaterThanOrEqual(1);

    // DEC-771 asks for "roughly ... five templates" -- a density floor, not a
    // cap: DEC-796 adds a sixth ("Speaker Portal Invitation") so the
    // portal-invite send is one template pick away. The floor is what the
    // Templates tab needs to show its own shape.
    const templateRows = parseInserts(sql, "email_template");
    expect(templateRows.length).toBeGreaterThanOrEqual(5);
  });

  it("(DEC-836) at least two evaluation plans are open at SEED_NOW, one of them alongside a genuinely closed plan, with a reviewer scoped to both open plans", () => {
    const planRows = parseInserts(sql, "evaluation_plan");
    expect(planRows.length).toBeGreaterThanOrEqual(3);

    // Mirrors app/src/pages/review/PlanList.tsx's isPlanOpen: now falls
    // inside [openDate, closeDate], a null bound unbounded on that side.
    // seed.ts always writes numeric epoch-ms literals for these two
    // columns (never NULL), so a plain Number() parse is safe here.
    const now = Date.now();
    const isOpen = (r: Record<string, string | null>) => {
      const openDate = Number(r.open_date);
      const closeDate = Number(r.close_date);
      if (closeDate < now) return false;
      if (openDate > now) return false;
      return true;
    };
    const isClosed = (r: Record<string, string | null>) => Number(r.close_date) < now;

    const openPlans = planRows.filter(isOpen);
    const closedPlans = planRows.filter(isClosed);
    expect(openPlans.length, `expected >=2 open plans, found: ${JSON.stringify(openPlans)}`).toBeGreaterThanOrEqual(2);
    expect(closedPlans.length, `expected >=1 closed plan, found: ${JSON.stringify(closedPlans)}`).toBeGreaterThanOrEqual(1);

    // Criterion weights must visibly differ between at least two plans
    // (docs/design/README.md:204 — weighted must visibly differ from
    // naive), keyed by criterion id so the comparison is meaningful even
    // if plans list criteria in a different order.
    function weightsById(criteriaJson: string): Record<string, number> {
      const criteria = JSON.parse(criteriaJson) as Array<{ id: string; weight?: number }>;
      const out: Record<string, number> = {};
      for (const c of criteria) if (typeof c.weight === "number") out[c.id] = c.weight;
      return out;
    }
    const openWeightSets = openPlans.map((r) => JSON.stringify(weightsById(r.criteria_json!)));
    expect(
      new Set(openWeightSets).size,
      `open plans' criterion weights must differ: ${JSON.stringify(openWeightSets)}`,
    ).toBeGreaterThan(1);

    // At least one reviewer (plan_reviewer.user_id) is scoped to every open
    // plan, so the multi-plan queue landing and the plan-scoped route are
    // both reachable from seeded data.
    const planReviewerRows = parseInserts(sql, "plan_reviewer");
    const openPlanIds = new Set(openPlans.map((r) => r.id!));
    const usersByOpenPlan = openPlanIds.size;
    const reviewerOpenPlanCounts = new Map<string, Set<string>>();
    for (const row of planReviewerRows) {
      if (!row.plan_id || !openPlanIds.has(row.plan_id)) continue;
      const set = reviewerOpenPlanCounts.get(row.user_id!) ?? new Set<string>();
      set.add(row.plan_id);
      reviewerOpenPlanCounts.set(row.user_id!, set);
    }
    const reviewerOnAllOpenPlans = [...reviewerOpenPlanCounts.entries()].some(
      ([, plans]) => plans.size === usersByOpenPlan,
    );
    expect(
      reviewerOnAllOpenPlans,
      `no reviewer scoped to all ${usersByOpenPlan} open plans: ${JSON.stringify([...reviewerOpenPlanCounts.entries()].map(([u, p]) => [u, [...p]]))}`,
    ).toBe(true);
  });

  it("(DEC-848) the reviewer persona has two simultaneously open, differently-track-scoped queues, each with unscored work", () => {
    // The reviewer persona is the fixture-identified login account (not the
    // synthetic reviewer.b/c/d users), matched by email exactly as seed.ts
    // derives it, so this test never hand-guesses the persona's user id.
    const fixture = JSON.parse(readFileSync(join(REPO_ROOT, "docs", "fixtures", "sample-data.json"), "utf-8")) as {
      identities: { reviewer: { email: string } };
    };
    const reviewerEmail = fixture.identities.reviewer.email;

    const userRows = parseInserts(sql, "user");
    const reviewerUser = userRows.find((r) => r.email === reviewerEmail && r.role === "reviewer");
    expect(reviewerUser, `no seeded reviewer user with email ${reviewerEmail}`).toBeTruthy();
    const reviewerUserId = reviewerUser!.id!;

    const planRows = parseInserts(sql, "evaluation_plan");
    const now = Date.now();
    const isOpen = (r: Record<string, string | null>) => {
      const openDate = Number(r.open_date);
      const closeDate = Number(r.close_date);
      return openDate <= now && now < closeDate;
    };
    const openPlans = planRows.filter(isOpen);
    expect(openPlans.length, `expected >=2 open evaluation_plan rows: ${JSON.stringify(openPlans)}`).toBeGreaterThanOrEqual(2);

    const planReviewerRows = parseInserts(sql, "plan_reviewer");
    const openPlanIds = new Set(openPlans.map((r) => r.id!));
    const reviewerAssignments = planReviewerRows.filter(
      (r) => r.user_id === reviewerUserId && openPlanIds.has(r.plan_id!),
    );
    expect(
      reviewerAssignments.length,
      `expected reviewer persona to have plan_reviewer rows on >=2 open plans: ${JSON.stringify(reviewerAssignments)}`,
    ).toBeGreaterThanOrEqual(2);

    // Their track scopes must differ across at least two of those open-plan
    // assignments -- otherwise the two live queues would only differ by name.
    const trackScopes = new Set(reviewerAssignments.map((r) => r.track_id!));
    expect(
      trackScopes.size,
      `reviewer persona's open-plan assignments all share one track scope: ${JSON.stringify([...trackScopes])}`,
    ).toBeGreaterThan(1);

    // Each of those plans must have at least one in-track submission the
    // reviewer persona has NOT yet scored -- otherwise the queue renders
    // empty and proves nothing (DEC-848).
    const submissionTrackRows = parseInserts(sql, "submission_track");
    const evaluationRows = parseInserts(sql, "evaluation");
    for (const assignment of reviewerAssignments) {
      const planId = assignment.plan_id!;
      const trackId = assignment.track_id!;
      const inTrackSubmissionIds = new Set(
        submissionTrackRows.filter((r) => r.track_id === trackId).map((r) => r.submission_id!),
      );
      const scoredSubmissionIds = new Set(
        evaluationRows
          .filter((r) => r.plan_id === planId && r.reviewer_id === reviewerUserId)
          .map((r) => r.submission_id!),
      );
      const unscored = [...inTrackSubmissionIds].filter((id) => !scoredSubmissionIds.has(id));
      expect(
        unscored.length,
        `plan ${planId} (track ${trackId}) has no submission left unscored by the reviewer persona -- queue would render empty`,
      ).toBeGreaterThan(0);
    }
  });

  it("(DEC-836) the Content worklist's three questions (needs a decision, approved, all accepted) each count a non-zero row", () => {
    const submissionRows = parseInserts(sql, "submission");
    const acceptedRows = submissionRows.filter((r) => r.status === "accepted");
    expect(acceptedRows.length).toBeGreaterThan(0);

    // Product predicate: files-content-status.ts's CONTENT_STATUSES set and
    // the worklist's pending ∪ changes_requested "needs a decision" union.
    const needsDecision = acceptedRows.filter(
      (r) => r.content_status === "pending" || r.content_status === "changes_requested",
    );
    const approved = acceptedRows.filter((r) => r.content_status === "approved");

    expect(needsDecision.length, "needs-a-decision (pending ∪ changes_requested) count is zero").toBeGreaterThan(0);
    expect(approved.length, "approved count is zero").toBeGreaterThan(0);
    expect(acceptedRows.length, "all-accepted count is zero").toBeGreaterThan(0);

    // No two tasks in one event share a title (also asserted by DEC-771's
    // (c) above; restated per DEC-836's proof requirement so this file's
    // own test set is self-sufficient).
    const taskRows = parseInserts(sql, "task");
    const dupeTasks = duplicateGroups(taskRows, (r) => r.title!);
    expect(dupeTasks, `duplicate task titles: ${JSON.stringify(dupeTasks)}`).toEqual([]);
  });

  it("(DEC-836) the ADDITIONAL_EMAIL_TEMPLATES 'Content Reminder' subject never interpolates the multi-line {task_list} block", () => {
    const templateRows = parseInserts(sql, "email_template");
    const contentReminder = templateRows.find((r) => r.name === "Content Reminder");
    expect(contentReminder, "no 'Content Reminder' email_template row found").toBeTruthy();
    expect(contentReminder!.subject).not.toContain("{task_list}");
    // The body keeps the block.
    expect(contentReminder!.body_text).toContain("{task_list}");
  });

  it("(DEC-796) no seeded email_log row's subject or body_text contains a raw '{merge_field}' placeholder", () => {
    // Scans the raw SQL text (not just parsed rows) so a literal '{' inside
    // an email_log INSERT's subject/body_text column is caught even if a
    // future edit changes the row shape — every seeded history row must
    // show the text that was actually sent, never the unrendered template.
    const emailLogInsertRe = /^INSERT INTO email_log \(([^)]*)\) VALUES \((.*)\);$/gm;
    const offenders: string[] = [];
    for (const m of sql.matchAll(emailLogInsertRe)) {
      const columns = m[1]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const values = tokenizeSqlValues(m[2]!);
      const row: Record<string, string | null> = {};
      columns.forEach((c, idx) => {
        row[c] = unquote(values[idx]!);
      });
      for (const field of ["subject", "body_text"] as const) {
        const value = row[field];
        if (value && value.includes("{")) {
          offenders.push(`${field}="${value}"`);
        }
      }
    }
    const emailLogRows = parseInserts(sql, "email_log");
    expect(emailLogRows.length).toBeGreaterThan(0);
    expect(offenders, `seeded email_log rows still carry raw template placeholders: ${JSON.stringify(offenders)}`).toEqual(
      [],
    );
  });
});

describe("seed coherence (DEC-942): the three states the demo never showed", () => {
  it("(1) a review_recusal row exists for the demo reviewer persona in plan 1, on a submission they have NOT already evaluated", () => {
    const recusalRows = parseInserts(sql, "review_recusal");
    expect(recusalRows.length, "no review_recusal row was seeded at all").toBeGreaterThan(0);

    const planRows = parseInserts(sql, "evaluation_plan");
    const plan1 = planRows.find((r) => r.name === "Program Committee Review");
    expect(plan1, "plan 1 ('Program Committee Review') not found").toBeTruthy();

    const planReviewerRows = parseInserts(sql, "plan_reviewer");
    const plan1ReviewerUserIds = new Set(
      planReviewerRows.filter((r) => r.plan_id === plan1!.id).map((r) => r.user_id),
    );

    const recusal = recusalRows.find((r) => r.plan_id === plan1!.id);
    expect(recusal, "no review_recusal row targets plan 1").toBeTruthy();
    expect(
      plan1ReviewerUserIds.has(recusal!.user_id!),
      "the recused user is not scoped to plan 1 via plan_reviewer",
    ).toBe(true);
    expect(recusal!.reason, "recusal has no human-readable reason").toBeTruthy();

    // The recused submission must NOT already have an evaluation from the
    // same reviewer in the same plan, or the queue's recused row and
    // actionable-count reduction would never actually change anything.
    const evaluationRows = parseInserts(sql, "evaluation");
    const alreadyEvaluated = evaluationRows.some(
      (r) => r.plan_id === recusal!.plan_id && r.reviewer_id === recusal!.user_id && r.submission_id === recusal!.submission_id,
    );
    expect(alreadyEvaluated, "the recused submission was also independently evaluated by the same reviewer").toBe(false);
  });

  it("(2) plan 1's evaluations produce at least 6 distinct weighted scores, not a period-5 coin flip", () => {
    const planRows = parseInserts(sql, "evaluation_plan");
    const plan1 = planRows.find((r) => r.name === "Program Committee Review")!;
    const criteria = JSON.parse(plan1.criteria_json!) as Array<{ id: string; kind: string; weight?: number }>;
    const weights = new Map(
      criteria.filter((c) => c.kind === "rating").map((c) => [c.id, c.weight ?? 1] as const),
    );

    const evaluationRows = parseInserts(sql, "evaluation").filter((r) => r.plan_id === plan1.id);
    expect(evaluationRows.length).toBeGreaterThan(0);

    const weightedScores = evaluationRows.map((r) => {
      const scores = JSON.parse(r.scores_json!) as Record<string, number | string>;
      let sum = 0;
      let totalWeight = 0;
      for (const [critId, weight] of weights) {
        const val = scores[critId];
        expect(typeof val, `scores_json missing rating criterion '${critId}'`).toBe("number");
        sum += (val as number) * weight;
        totalWeight += weight;
      }
      return sum / totalWeight;
    });

    const distinct = new Set(weightedScores.map((s) => s.toFixed(4)));
    expect(
      distinct.size,
      `only ${distinct.size} distinct weighted scores across ${weightedScores.length} evaluations -- ranking degenerates to a coin flip`,
    ).toBeGreaterThanOrEqual(6);
  });

  it("(3) a majority of pipeline_entry rows carry an integer 1-5 fit_score + rationale, but at least one is left unrated", () => {
    const entryRows = parseInserts(sql, "pipeline_entry");
    expect(entryRows.length).toBeGreaterThan(0);

    const rated = entryRows.filter((r) => r.fit_score !== null && r.fit_score !== undefined);
    const unrated = entryRows.filter((r) => r.fit_score === null || r.fit_score === undefined);

    expect(unrated.length, "every pipeline_entry is rated -- the dashed 'Unrated' state never renders").toBeGreaterThan(0);
    expect(
      rated.length,
      `rated (${rated.length}) is not a majority of ${entryRows.length} pipeline_entry rows`,
    ).toBeGreaterThan(entryRows.length / 2);

    for (const r of rated) {
      const fitScore = Number(r.fit_score);
      expect(Number.isInteger(fitScore), `fit_score '${r.fit_score}' is not an integer`).toBe(true);
      expect(fitScore, `fit_score ${fitScore} out of 1-5 range`).toBeGreaterThanOrEqual(1);
      expect(fitScore).toBeLessThanOrEqual(5);
      expect(r.rationale, `rated entry ${r.id} has no rationale`).toBeTruthy();
    }
    for (const r of unrated) {
      expect(r.rationale, `unrated entry ${r.id} unexpectedly has a rationale`).toBeFalsy();
    }
  });
});

describe("seed coherence (DEC-887 amendment, task w40-a): the front door is live on delivery day", () => {
  it("the default CFP form's submission window straddles SEED_NOW (open in the past, close in the future)", () => {
    const formRows = parseInserts(sql, "form");
    const defaultForm = formRows.find((f) => f.is_default === "1" || f.is_default === "true");
    expect(defaultForm, "no default form seeded").toBeTruthy();
    const openDate = Number(defaultForm!.open_date);
    const closeDate = Number(defaultForm!.close_date);
    expect(openDate, "default form's open_date is not before now -- /submit/<slug> reads not-yet-open").toBeLessThan(
      Date.now(),
    );
    expect(closeDate, "default form's close_date is not after now").toBeGreaterThan(Date.now());
    expect(openDate).toBeLessThan(closeDate);
  });

  it("seeds at least four saved embed rows (matching the frame), with at least one enabled and one disabled", () => {
    const embedRows = parseInserts(sql, "embed");
    expect(embedRows.length).toBeGreaterThanOrEqual(4);
    const enabled = embedRows.filter((r) => r.enabled === "1" || r.enabled === "true");
    const disabled = embedRows.filter((r) => r.enabled === "0" || r.enabled === "false");
    expect(enabled.length, `no enabled saved embed among ${embedRows.length}`).toBeGreaterThanOrEqual(1);
    expect(disabled.length, `no disabled saved embed among ${embedRows.length}`).toBeGreaterThanOrEqual(1);
  });

  it("seeds a re-upload chain on a submission left content_status pending, so the Content worklist's RE-UPLOADED tag has a live row (not just the header count)", () => {
    const fileRows = parseInserts(sql, "file");
    const filesById = new Map(fileRows.map((f) => [f.id!, f]));
    const v2ChainRows = fileRows.filter((f) => f.previous_file_id && filesById.has(f.previous_file_id));
    expect(v2ChainRows.length, "expected at least one version-2 chain row").toBeGreaterThanOrEqual(1);

    const submissionRows = parseInserts(sql, "submission");
    const submissionById = new Map(submissionRows.map((s) => [s.id!, s]));

    // Exactly one of the chain rows must sit on a submission whose
    // content_status is 'pending' -- worklistStatusLabel's precedence
    // (approved always wins) means a chain on an 'approved' submission never
    // renders the 'Re-uploaded' tag.
    const pendingChainRows = v2ChainRows.filter((v2) => submissionById.get(v2.submission_id!)?.content_status === "pending");
    expect(
      pendingChainRows.length,
      `expected exactly one re-upload chain on a content_status 'pending' submission, found ${pendingChainRows.length}`,
    ).toBe(1);

    const v2 = pendingChainRows[0]!;
    expect(v2.version_no).toBe("2");
    const v1 = filesById.get(v2.previous_file_id!)!;
    expect(v1.version_no).toBe("1");
    expect(v1.submission_id).toBe(v2.submission_id);
    expect(v1.kind).toBe(v2.kind);
  });
});
