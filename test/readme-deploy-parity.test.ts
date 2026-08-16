// DEC-296 amendment: the operator-facing "### Deploying" section and the
// "## For evaluators" Surface|Route table are the two places a judge
// actually walks into when they try to run a deployed instance -- the
// deploy checklist must name PUBLIC_BASE_URL and DEV_MODE explicitly (a
// deployed origin missing PUBLIC_BASE_URL fails loudly in
// `resolveBaseUrl`/`resolveBaseUrlForCron`, `src/server/origin.ts`, and bulk
// email 500s rather than emailing a broken host), and the evaluator table's
// Dev mailbox row must carry its own 404-on-the-live-demo caveat rather than
// relying on the judge having read the earlier "Live demo" paragraph.
//
// Modelled on test/readme-evaluator-contract.test.ts (section extraction by
// heading, quoting the offending section text on failure) and
// test/quickstart-contract.test.ts (parsing README.md directly, no product
// code under test).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const README_PATH = resolve(REPO_ROOT, "README.md");

/** Slices the named heading section out of `markdown`, stopping at the next
 * heading of the same or higher level (or EOF). Throws if the heading is
 * absent -- a missing section is an authoring bug, not a thing to silently
 * skip. Mirrors test/readme-evaluator-contract.test.ts's extractSection,
 * generalized to accept any heading prefix (`## ` or `### `). */
function extractSection(markdown: string, heading: string): string {
  const level = heading.startsWith("### ") ? "### " : "## ";
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    throw new Error(`README.md has no "${heading}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith(level) || (level === "### " && l.startsWith("## ")));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

/** Finds the markdown table row containing `needle` inside `section`.
 * Throws if no row contains it -- a missing row is an authoring bug, not
 * something to silently skip. */
function findTableRowContaining(section: string, needle: string): string {
  const line = section.split("\n").find((l) => l.trim().startsWith("|") && l.includes(needle));
  if (!line) {
    throw new Error(`README.md 'For evaluators' surface table has no row containing "${needle}"`);
  }
  return line;
}

describe("README.md operator-doc parity (DEC-296 amendment)", () => {
  const readmeText = readFileSync(README_PATH, "utf-8");
  const deploySection = extractSection(readmeText, "### Deploying");

  describe("### Deploying section", () => {
    it("mentions PUBLIC_BASE_URL as a required deploy-parity variable", () => {
      expect(
        deploySection.includes("PUBLIC_BASE_URL"),
        `README.md "### Deploying" section does not mention PUBLIC_BASE_URL. Section text:\n\n${deploySection}`,
      ).toBe(true);
    });

    it("mentions DEV_MODE staying unset in production", () => {
      expect(
        deploySection.includes("DEV_MODE"),
        `README.md "### Deploying" section does not mention DEV_MODE. Section text:\n\n${deploySection}`,
      ).toBe(true);
    });
  });

  describe("## For evaluators Surface|Route table, Dev mailbox row", () => {
    const evaluatorsSection = extractSection(readmeText, "## For evaluators");
    const row = findTableRowContaining(evaluatorsSection, "/dev/mailbox");

    it("names 404 as the deployed-instance behaviour", () => {
      expect(
        row.includes("404"),
        `README.md's Dev mailbox row does not mention 404. Row text:\n\n${row}`,
      ).toBe(true);
    });

    it("names the live-demo host so the caveat is where the reader clicks", () => {
      expect(
        row.includes("chautauqua.cc"),
        `README.md's Dev mailbox row does not name the live-demo host (chautauqua.cc). Row text:\n\n${row}`,
      ).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Negative control: findTableRowContaining must fail loudly, not silently
// skip, when the needle is absent -- proving the check isn't vacuously green.
// ---------------------------------------------------------------------------
describe("negative control", () => {
  it("findTableRowContaining throws when no row contains the needle", () => {
    const section = "| Surface | Route |\n| --- | --- |\n| Home | `/` |";
    expect(() => findTableRowContaining(section, "/dev/mailbox")).toThrow();
  });
});
