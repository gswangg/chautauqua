// DEC-004 (wave-55 amendment): SPEC J7's "one record, two views" promise
// (a speaker's portal edits "appear on the producer's record instantly")
// must be an ENUMERATION, not a coincidence -- nothing today fails if a
// portal-written column gains no producer-side reader.
//
// This test:
//   (1) derives the set of columns the portal's own write doors touch --
//       POST /portal/profile (src/server/repo/profile.ts's
//       updateContactProfile + setContactHeadshot) and the portal
//       submission edit (src/server/repo/portal-edit.ts's
//       saveSubmissionEdits) -- by parsing THOSE FUNCTIONS' OWN SOURCE TEXT
//       at test run time (never a hand-typed list that can drift from the
//       code), and
//   (2) asserts every written column is named by at least one of the three
//       producer-side readers DEC-004 names: the speaker detail read
//       (repo/tasks/speaker-detail.ts), the submission detail read
//       (repo/submissions/detail.ts), or the contacts read (repo/contacts/
//       rows.ts, the shared ContactRow/ContactRecord projection every
//       contacts/** read composes).
//
// A cheap round trip (the contact-profile fields) is additionally proven
// BEHAVIOURALLY against a minimal fake Db: write through
// updateContactProfile, read the same row back through the real
// toRow/toContactRecord pipeline every contacts/** reader shares, and
// assert the written values survive. The submission-edit side and the
// headshot fields are NOT cheap round trips (they need a roster
// participant/submission/event fixture, or R2 file plumbing) -- those stay
// source-derived per DEC-004's own allowance ("a source scan where the
// round trip is cheap" is the dispreferred case; the inverse is implied).
//
// Exemptions on record (DEC-004 step 3): NONE were needed -- every column
// this audit found the portal doors writing already has a reader among the
// three named surfaces (see the per-key assertions below). This is a
// FINDING, not an assumption: it is proven per-key, not waved through.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/db/schema";
import { updateContactProfile, type SocialLinks } from "../src/server/repo/profile";
import { toContactRecord, toRow } from "../src/server/repo/contacts/rows";
import type { Db } from "../src/server/context";

const ROOT = join(__dirname, "..");
function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

// ---------------------------------------------------------------------------
// Source-derived enumeration helpers. These parse real TypeScript source
// text at test time -- if a future edit renames/removes a write-path field,
// the NEXT run re-derives the set from the new source, so this can never go
// stale the way a hand-typed list would (the whole point of DEC-004 step 1).
// ---------------------------------------------------------------------------

function extractFunctionBody(source: string, fnName: string): string {
  const sigIdx = source.indexOf(`function ${fnName}(`);
  if (sigIdx === -1) throw new Error(`function not found in source: ${fnName}`);
  const bodyStart = source.indexOf("{", sigIdx);
  if (bodyStart === -1) throw new Error(`no body opening brace for ${fnName}`);
  let depth = 0;
  let i = bodyStart;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error(`unbalanced braces locating body of ${fnName}`);
  return source.slice(bodyStart, i + 1);
}

/** Extracts the key names of the first `.update(schema.<table>).set({ ... })`
 * OBJECT-LITERAL call inside `body`. Throws (fail loudly) if the .set() call
 * found isn't a literal -- callers that pass a variable (e.g. `.set(patch)`)
 * must use extractAssignedKeys instead, so a silent miss is impossible. */
function extractSetLiteralKeys(body: string, table: string): string[] {
  const updateAnchor = `.update(schema.${table})`;
  const updateIdx = body.indexOf(updateAnchor);
  if (updateIdx === -1) throw new Error(`no .update(schema.${table}) found in body`);
  const setIdx = body.indexOf(".set(", updateIdx);
  if (setIdx === -1) throw new Error(`no .set( following .update(schema.${table})`);
  const afterSet = setIdx + ".set(".length;
  if (body[afterSet] !== "{") {
    throw new Error(
      `.set() at offset ${setIdx} for table ${table} is not an object literal -- use extractAssignedKeys`,
    );
  }
  let depth = 0;
  let i = afterSet;
  for (; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const objText = body.slice(afterSet + 1, i);
  const keys = new Set<string>();
  for (const m of objText.matchAll(/(?:^|[{,\n])\s*(\w+)\s*:/g)) {
    const key = m[1];
    if (key === undefined) throw new Error("unreachable: capture group 1 always matches \\w+");
    keys.add(key);
  }
  if (keys.size === 0) throw new Error(`no keys parsed out of .set({...}) for table ${table}`);
  return [...keys];
}

/** Extracts every `<varName>.<key> = ` assignment target inside `body` --
 * the shape saveSubmissionEdits uses for the contact-row patch it builds up
 * conditionally before a single `.set(contactUpdate)` call. */
function extractAssignedKeys(body: string, varName: string): string[] {
  const re = new RegExp(`\\b${varName}\\.(\\w+)\\s*=(?!=)`, "g");
  const keys = new Set<string>();
  for (const m of body.matchAll(re)) {
    const key = m[1];
    if (key === undefined) throw new Error("unreachable: capture group 1 always matches \\w+");
    keys.add(key);
  }
  if (keys.size === 0) throw new Error(`no ${varName}.<key> = assignments found`);
  return [...keys];
}

// ---------------------------------------------------------------------------
// (1) Derive the written column sets from the write doors' own source.
// ---------------------------------------------------------------------------

const profileSrc = readSrc("src/server/repo/profile.ts");
const portalEditRepoSrc = readSrc("src/server/repo/portal-edit.ts");

const profileDetailsWriteKeys = extractSetLiteralKeys(
  extractFunctionBody(profileSrc, "updateContactProfile"),
  "contact",
);
const headshotWriteKeys = extractSetLiteralKeys(
  extractFunctionBody(profileSrc, "setContactHeadshot"),
  "contact",
);
const editSubmissionWriteKeys = extractSetLiteralKeys(
  extractFunctionBody(portalEditRepoSrc, "saveSubmissionEdits"),
  "submission",
);
const editContactWriteKeys = extractAssignedKeys(
  extractFunctionBody(portalEditRepoSrc, "saveSubmissionEdits"),
  "contactUpdate",
);

const contactWriteKeys = [
  ...new Set([...profileDetailsWriteKeys, ...headshotWriteKeys, ...editContactWriteKeys]),
];
const submissionWriteKeys = [...new Set(editSubmissionWriteKeys)];

// ---------------------------------------------------------------------------
// (2) The three producer-side readers DEC-004 names, as raw source text.
// ---------------------------------------------------------------------------

const speakerDetailSrc = readSrc("src/server/repo/tasks/speaker-detail.ts");
const submissionsDetailSrc = readSrc("src/server/repo/submissions/detail.ts");
const contactsRowsSrc = readSrc("src/server/repo/contacts/rows.ts");

/** A column is "named" by a reader if its identifier appears as a whole
 * word in that reader's source (matches both `schema.contact.foo` column
 * selections and destructured/renamed field usages like `row.foo`). */
function isNamedByAnyReader(key: string, readerSources: string[]): boolean {
  const re = new RegExp(`\\b${key}\\b`);
  return readerSources.some((src) => re.test(src));
}

function assertNamedByAReader(key: string, readerSources: string[], readerLabels: string): void {
  if (!isNamedByAnyReader(key, readerSources)) {
    throw new Error(
      `Portal-written column '${key}' has no reader among: ${readerLabels}. ` +
        `Either add a reader or record an explicit DEC-004 exemption for it.`,
    );
  }
}

const contactReaders = [speakerDetailSrc, contactsRowsSrc];
const submissionReaders = [submissionsDetailSrc];
const contactReaderLabels = "speaker-detail.ts, contacts/rows.ts";
const submissionReaderLabels = "submissions/detail.ts";

describe("DEC-004: portal-write / producer-read column parity", () => {
  it("derived at least one column per write door (sanity on the extractor itself)", () => {
    expect(contactWriteKeys.length).toBeGreaterThan(0);
    expect(submissionWriteKeys.length).toBeGreaterThan(0);
  });

  it.each(contactWriteKeys)("contact column '%s' written by a portal door has a producer-side reader", (key) => {
    assertNamedByAReader(key, contactReaders, contactReaderLabels);
  });

  it.each(submissionWriteKeys)("submission column '%s' written by portal edit has a producer-side reader", (key) => {
    assertNamedByAReader(key, submissionReaders, submissionReaderLabels);
  });

  // Negative control: proves the assertion above isn't vacuously true --
  // a genuinely orphaned column name must fail this exact check.
  it("negative control: a made-up column name fails the reader check", () => {
    expect(() =>
      assertNamedByAReader("totallyMadeUpPortalColumnXyz987", contactReaders, contactReaderLabels),
    ).toThrow(/has no reader among/);
  });
});

// ---------------------------------------------------------------------------
// Behavioural round trip (cheap case, per DEC-004's own preference): write
// the contact-profile fields through the REAL updateContactProfile repo
// function against a minimal fake Db, then read the row back through the
// REAL toRow/toContactRecord pipeline every contacts/** reader shares, and
// assert the written values actually survive to the producer-facing shape.
// firstName/lastName are held constant across the write so
// touchSubmissionsForContacts' cross-submission fan-out (irrelevant to this
// column-parity question) never fires -- see profile.ts:151-154.
// ---------------------------------------------------------------------------

interface FakeContactRow {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  bio: string | null;
  headshotUrl: string | null;
  headshotFileId: string | null;
  socialLinksJson: string | null;
  notes: string | null;
  customFieldsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeAwaitable<T>(rows: T[]) {
  return {
    limit: async (_n: number) => rows,
    then: (resolve: (v: T[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
}

function fakeContactDb(initial: FakeContactRow) {
  const row: FakeContactRow = { ...initial };
  const db = {
    select(_sel: unknown) {
      return {
        from(table: unknown) {
          return {
            where(_cond: unknown) {
              if (table !== schema.contact) throw new Error("fake db: unexpected select().from() table");
              return makeAwaitable([{ ...row }]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where: async (_cond: unknown) => {
              if (table === schema.contact) {
                Object.assign(row, vals);
                return;
              }
              if (table === schema.participant) {
                // backfillNullAttribution's NULL-only participant repair:
                // no participant rows are configured for this contact in
                // this fixture, so this is a legitimate, harmless no-op.
                return;
              }
              throw new Error("fake db: unexpected update() table");
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as Db, getRow: () => row };
}

describe("DEC-004: cheap behavioural round trip -- portal profile write, contacts read", () => {
  it("every non-blank field POST /portal/profile writes is visible through the contacts-read projection", async () => {
    const initial: FakeContactRow = {
      id: "c-parity-1",
      orgId: "org-1",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      phone: null,
      company: null,
      title: null,
      bio: null,
      headshotUrl: null,
      headshotFileId: null,
      socialLinksJson: null,
      notes: null,
      customFieldsJson: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const { db, getRow } = fakeContactDb(initial);

    const socialLinks: SocialLinks = {
      twitter: "gracehopper",
      linkedin: "in/gracehopper",
      github: "gracehopper",
      website: "https://example.com/grace",
    };
    await updateContactProfile(db, initial.id, {
      firstName: "Grace", // held constant -- see header note
      lastName: "Hopper", // held constant -- see header note
      title: "Rear Admiral",
      company: "US Navy",
      bio: "Compiler pioneer.",
      socialLinks,
    });

    // Read back through the SAME toRow/toContactRecord pipeline every
    // contacts/** producer read (findContactById, findContactForOrg, the
    // merge domain, etc.) composes -- this IS the producer-side "contacts
    // read" DEC-004 names, exercised for real, not re-implemented.
    const storedDrizzleShapedRow = {
      ...getRow(),
    } as unknown as typeof schema.contact.$inferSelect;
    const producerView = toContactRecord(toRow(storedDrizzleShapedRow));

    expect(producerView.title).toBe("Rear Admiral");
    expect(producerView.company).toBe("US Navy");
    expect(producerView.bio).toBe("Compiler pioneer.");
    expect(producerView.socialLinks).toEqual(socialLinks);
  });
});
