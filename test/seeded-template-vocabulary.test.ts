// DEC-792: closing the seeded-template landmine — a seeded template whose
// tokens a send path rejects (because a compose-scoped merge-field
// vocabulary hadn't grown to match) is a landmine, not a fixture detail.
// This test asserts every {merge_field} token used by every seeded
// email_template (the exported scripts/seed-lib.ts constant, plus the
// fixture acceptance subject/body from docs/fixtures/sample-data.json) is a
// member of COMPOSE_MERGE_FIELDS — the same whitelist compose/preview and
// compose/send preflight against.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPOSE_MERGE_FIELDS } from "../src/mail/render";
import { ADDITIONAL_EMAIL_TEMPLATES } from "../scripts/seed-lib";

const REPO_ROOT = join(__dirname, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

function tokensIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

describe("seeded-template merge-field vocabulary (DEC-792)", () => {
  it("every token in every ADDITIONAL_EMAIL_TEMPLATES entry is a member of COMPOSE_MERGE_FIELDS", () => {
    expect(ADDITIONAL_EMAIL_TEMPLATES.length).toBeGreaterThan(0);
    for (const tpl of ADDITIONAL_EMAIL_TEMPLATES) {
      for (const token of [...tokensIn(tpl.subject), ...tokensIn(tpl.bodyText)]) {
        expect(
          (COMPOSE_MERGE_FIELDS as readonly string[]).includes(token),
          `template '${tpl.name}' uses {${token}}, which is not in COMPOSE_MERGE_FIELDS`,
        ).toBe(true);
      }
    }
  });

  it("every token in the fixture acceptance subject/body is a member of COMPOSE_MERGE_FIELDS", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
      communications: { acceptance_subject: string; acceptance_body: string };
    };
    const tokens = [
      ...tokensIn(fixture.communications.acceptance_subject),
      ...tokensIn(fixture.communications.acceptance_body),
    ];
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(
        (COMPOSE_MERGE_FIELDS as readonly string[]).includes(token),
        `fixture acceptance template uses {${token}}, which is not in COMPOSE_MERGE_FIELDS`,
      ).toBe(true);
    }
  });
});
