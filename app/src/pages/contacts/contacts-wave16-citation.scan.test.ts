// task v12m-w16-ui-r2-c: wave-16 minted DEC-992/DEC-994/DEC-995/DEC-996 as
// citations on the Contacts 390 landing, treating the three-digit id space
// as free. It is not -- decisions/README.md ruled the space CLOSED since
// wave 37 (a new ruling is an `## Amendment` on an existing DEC-NNN.md, never
// a new id), and all four of those ids were already spent on unrelated
// rulings (a merge-compare table, session minting, served-file content
// types, the production mailer). This is the registry-laundering failure
// mode src/decisions-data/DEC-976.md's wave-155 amendment exists to end.
//
// This scan re-derives the wave-16 population by CONTENT (DEC-808: "a
// directory is not a population" -- never a hand-listed manifest): every
// file in app/src/pages/contacts whose text contains one of the four
// wave-16 marker class names. It then asserts (1) that population is
// non-empty and contains contacts.css, (2) each of 992/994/995/996's
// decisions/DEC-NNN.md H1 line still names its own unrelated subject --
// re-deriving the ban as a FACT, not an allowlist, so it self-checks if the
// registry ever moves -- (3) none of the four hyphenated ids appears
// anywhere in the population, and (4) every hyphenated DEC-919 occurrence in
// the population is directory-qualified (immediately preceded by
// `src/decisions-data/` or `decisions/`), per DEC-976's wave-155 amendment
// ruling that DEC-919 is itself a colliding id across both directories.
//
// Only the hyphen form `DEC-919` is matched, never the underscore compile
// pin (`DEC_919`) -- those are TypeScript imports/`void` pins checked by
// app/src/decision-constant-pin.scan.test.ts, not citations.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const contactsDir = join(repoRoot, "app", "src", "pages", "contacts");
const decisionsDir = join(repoRoot, "decisions");

const MARKERS = [
  "chq-contacts-filter-chipstrip",
  "chq-contacts-segment-pills",
  "chq-contacts-head-count",
  "chq-contacts-filter-rule-chip",
];

const BANNED_IDS: Record<string, string> = {
  "DEC-992":
    "# DEC-992: The merge compare table names BOTH records and their vintages, and the primary names its target with the swap beside it",
  "DEC-994":
    "# DEC-994: Session minting is ONE helper that revokes first: login, claim and password-change all rotate, and no path inserts an auth_session by hand",
  "DEC-995":
    "# DEC-995: A served file's Content-Type is the validated DB column; the object store returns bytes and never a content type",
  "DEC-996":
    "# DEC-996: The production mailer is the Cloudflare Email Service send_email binding; Resend is deleted, not mis-typed",
};

function readdirFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

const SELF_NAME = "contacts-wave16-citation.scan.test.ts";

function buildWave16Population(): string[] {
  return readdirFiles(contactsDir).filter((name) => {
    if (name === SELF_NAME) return false; // this scan file quotes the
    // marker strings and banned ids in its own prose/source -- it is the
    // scan, not a member of the population it scans.
    const text = readFileSync(join(contactsDir, name), "utf-8");
    return MARKERS.some((marker) => text.includes(marker));
  });
}

describe("Contacts wave-16 citation scan (src/decisions-data/DEC-919.md)", () => {
  const population = buildWave16Population();

  it("the derived wave-16 population is non-empty and contains contacts.css (vacuous-population tripwire)", () => {
    expect(population.length).toBeGreaterThan(0);
    expect(population).toContain("contacts.css");
  });

  for (const [id, expectedH1] of Object.entries(BANNED_IDS)) {
    it(`decisions/${id}.md's H1 still names the unrelated subject that makes ${id} banned here`, () => {
      const docPath = join(decisionsDir, `${id}.md`);
      const firstLine = readFileSync(docPath, "utf-8").split("\n")[0];
      expect(firstLine).toBe(expectedH1);
    });
  }

  it("none of the four banned hyphenated ids appears anywhere in the wave-16 population", () => {
    const offenders: string[] = [];
    for (const name of population) {
      const text = readFileSync(join(contactsDir, name), "utf-8");
      for (const id of Object.keys(BANNED_IDS)) {
        if (text.includes(id)) {
          offenders.push(`${name}: ${id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every hyphenated DEC-919 occurrence in the wave-16 population is directory-qualified", () => {
    const unqualified: string[] = [];
    const DEC_919_RE = /(.{0,30})DEC-919/g;
    for (const name of population) {
      const text = readFileSync(join(contactsDir, name), "utf-8");
      let m: RegExpExecArray | null;
      DEC_919_RE.lastIndex = 0;
      while ((m = DEC_919_RE.exec(text)) !== null) {
        const prefix = m[1] ?? "";
        const qualified =
          prefix.endsWith("src/decisions-data/") || prefix.endsWith("decisions/");
        if (!qualified) {
          unqualified.push(`${name}: ...${prefix}DEC-919`);
        }
      }
    }
    expect(unqualified).toEqual([]);
  });
});
