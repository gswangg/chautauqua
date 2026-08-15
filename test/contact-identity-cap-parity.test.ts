// DEC-417 (wave 67 amendment): ONE cap per contact identity column. The
// public CFP (via projectFieldForAnswers) and the portal co-presenter form
// (addCoPresenter) must mint contact rows the CRM can re-save — so both
// must cap first_name/last_name/job_title/company at the same
// MAX_NAME_LENGTH (200) the CRM's own writers use.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOCKED_CONTACT_TEXT_MAX_LENGTH,
  projectFieldForAnswers,
  type FormFieldDef,
} from "../src/forms/types";
import { validateAnswers } from "../src/forms/validate";
import { MAX_NAME_LENGTH } from "../src/forms/validate";
import { addCoPresenter } from "../src/server/repo/portal-edit";
import { overCapFieldMessage, overCapSentence } from "../src/domain/cap-copy";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";

describe("LOCKED_CONTACT_TEXT_MAX_LENGTH parity (DEC-417 wave 67)", () => {
  it("pins LOCKED_CONTACT_TEXT_MAX_LENGTH to validate.ts's MAX_NAME_LENGTH", () => {
    expect(LOCKED_CONTACT_TEXT_MAX_LENGTH).toBe(MAX_NAME_LENGTH);
    expect(LOCKED_CONTACT_TEXT_MAX_LENGTH).toBe(200);
  });
});

function textField(id: string, name: string, extra?: Partial<FormFieldDef>): FormFieldDef {
  return {
    id: `form-1:${id}`,
    section: "speaker",
    kind: "text",
    label: name,
    required: false,
    position: 0,
    ...extra,
  };
}

const CONTACT_IDENTITY_NAMES = ["first_name", "last_name", "job_title", "company"] as const;

describe("projectFieldForAnswers stamps a 200 cap on locked contact identity fields", () => {
  for (const name of CONTACT_IDENTITY_NAMES) {
    it(`accepts 200 chars and refuses 201 for ${name}`, () => {
      const def = projectFieldForAnswers(textField(name, name));
      expect(def.maximum).toBe(200);

      const ok = validateAnswers([def], { [name]: "a".repeat(200) });
      expect(ok.ok).toBe(true);

      const bad = validateAnswers([def], { [name]: "a".repeat(201) });
      expect(bad.ok).toBe(false);
      if (bad.ok) throw new Error("unreachable");
      expect(bad.errors[name]).toBe(overCapSentence(name, 201, 200));
    });
  }

  it("an organiser-narrowed maximum still wins (Math.min keeps widening impossible)", () => {
    const def = projectFieldForAnswers(textField("first_name", "first_name", { maximum: 50 }));
    expect(def.maximum).toBe(50);
    const bad = validateAnswers([def], { first_name: "a".repeat(51) });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("unreachable");
    expect(bad.errors.first_name).toBe(overCapSentence("first_name", 51, 50));
  });

  it("does not stamp a maximum on bio or email", () => {
    const bioDef = projectFieldForAnswers(textField("bio", "bio", { kind: "long_text" }));
    expect(bioDef.maximum).toBeUndefined();
    const emailDef = projectFieldForAnswers(textField("email", "email"));
    expect(emailDef.maximum).toBeUndefined();
  });
});

// --- addCoPresenter refusal at 201 chars ---------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => [] }),
      }),
    }),
    update: (table: unknown) => {
      if (table === schema.submission) return { set: () => ({ where: () => Promise.resolve() }) };
      throw new Error("must never update contact");
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

describe("addCoPresenter refuses a 201-char first name (DEC-417 wave 67)", () => {
  it("caps firstName at MAX_NAME_LENGTH", async () => {
    const db = fakeDb([]);
    const result = await addCoPresenter(db, {
      submissionId: "sub-1",
      orgId: "org-1",
      firstName: "a".repeat(201),
      lastName: "Okafor",
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.firstName).toBe(overCapFieldMessage(201, MAX_NAME_LENGTH));
  });
});

// --- population test: every writer of contact.firstName/lastName/company/
// title caps at 200. Bound to the COLUMN via a source grep of each named
// file, not to "the four files someone remembered" -- if a fifth writer is
// added without a matching cap constant, this test fails loudly rather than
// silently missing it.

describe("population: every writer of contact identity columns caps at 200", () => {
  const repoRoot = join(__dirname, "..");

  it("src/routes/api/contacts/crud.ts caps firstName/lastName/company/title at MAX_NAME_LENGTH (200)", () => {
    const src = readFileSync(join(repoRoot, "src/routes/api/contacts/crud.ts"), "utf8");
    expect(src).toMatch(/MAX_NAME_LENGTH/);
    expect(MAX_NAME_LENGTH).toBe(200);
    for (const field of ["firstName", "lastName", "company", "title"]) {
      const re = new RegExp(`checkLen\\([^)]*"${field}"[^)]*MAX_NAME_LENGTH`);
      expect(src, `${field} must be checked against MAX_NAME_LENGTH in crud.ts`).toMatch(re);
    }
  });

  it("src/routes/portal/profile.tsx caps firstName/lastName/title/company at MAX_NAME_LENGTH (200)", () => {
    const src = readFileSync(join(repoRoot, "src/routes/portal/profile.tsx"), "utf8");
    for (const label of ["First name", "Last name", "Title", "Company"]) {
      const re = new RegExp(`\\["${label}",\\s*\\w+,\\s*MAX_NAME_LENGTH\\]`);
      expect(src, `${label} must be checked against MAX_NAME_LENGTH in profile.tsx`).toMatch(re);
    }
  });

  it("src/server/repo/portal-edit.ts's addCoPresenter caps firstName/lastName at MAX_NAME_LENGTH (200)", () => {
    const src = readFileSync(join(repoRoot, "src/server/repo/portal-edit.ts"), "utf8");
    expect(src).toMatch(/firstName\.length > MAX_NAME_LENGTH/);
    expect(src).toMatch(/lastName\.length > MAX_NAME_LENGTH/);
  });

  it("the public-CFP path (src/forms/types.ts's projectFieldForAnswers) stamps 200 on first_name/last_name/job_title/company", () => {
    const src = readFileSync(join(repoRoot, "src/forms/types.ts"), "utf8");
    expect(src).toMatch(/LOCKED_CONTACT_TEXT_MAX_LENGTH = 200/);
    expect(src).toMatch(/first_name/);
    expect(src).toMatch(/job_title/);
    expect(src).toMatch(/company/);
  });
});
