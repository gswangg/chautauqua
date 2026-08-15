// DEC-124 (wave-50 amendment): the no-red error vocabulary is declared
// TWICE -- src/views/error-states.css.ts (ERROR_STATES_CSS, composed into
// AUTH_CSS/PORTAL_CSS/CFP_CSS) for the SSR surfaces, and
// app/src/components/error-states.css for the admin SPA. DEC-124 says the
// vocabulary is defined ONCE conceptually and "reused by class name" --
// two files means the two declarations must agree property-for-property
// on every selector they share, or the two surfaces render differently
// for the same class. This scan extracts the declaration block for each
// shared selector from both files and fails naming any property present
// on only one side, or present on both with a different value.
//
// Selectors that exist on only one side BY DESIGN are named in an
// explicit allowlist below with a one-line reason each -- an allowlist
// entry is the artifact: an unexplained divergence cannot ride in behind
// it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const SSR_PATH = join(REPO_ROOT, "src/views/error-states.css.ts");
const SPA_PATH = join(REPO_ROOT, "app/src/components/error-states.css");

const SSR_SOURCE = readFileSync(SSR_PATH, "utf-8");
const SPA_SOURCE = readFileSync(SPA_PATH, "utf-8");

/** Selectors declared on only one side, and why that's correct. */
const ALLOWLIST: Record<string, string> = {
  ".chq-form-row[data-invalid='true'] .chq-form-row-control > .chq-input":
    "SPA-only: ModalFrame's FormRow wrapper pattern has no SSR equivalent -- the SSR side uses .chq-field-invalid directly on the control.",
  ".chq-form-row[data-invalid='true'] .chq-form-row-control > .chq-select":
    "SPA-only: same ModalFrame/FormRow descendant-selector pattern, select variant.",
  ".chq-form-row[data-invalid='true'] .chq-form-row-control > .chq-textarea":
    "SPA-only: same ModalFrame/FormRow descendant-selector pattern, textarea variant.",
  ".chq-error-summary-heading":
    "SPA-only (DEC-575 wave-28 amendment): the file-level pre-mapping summary variant states its heading as a bare <p> with no offending field to link to, so it can't inherit `.chq-error-summary h2` and needs its own selector.",
  ".chq-error-summary-detail":
    "SPA-only (DEC-575 wave-28 amendment): file-level summary detail paragraph, same reasoning as -heading.",
  ".chq-error-summary-rows":
    "SPA-only (DEC-575 wave-28 amendment): file-level summary row-list paragraph, same reasoning as -heading.",
  ".chq-error-summary-kept":
    "SPA-only (DEC-575 wave-28 amendment): file-level summary 'kept' paragraph, same reasoning as -heading.",
  ".chq-form-row-error":
    "SPA-only: ModalFrame's FormRow error text sits alongside .chq-field-error as an equivalent hook for the wrapper pattern; the SSR module has no FormRow concept.",
  "fieldset.chq-field-invalid":
    "SSR-only: the public CFP builder groups radio/checkbox options in a <fieldset>, which needs padding-left reset to 0 (no left padding to preserve); the SPA has no fieldset-based invalid control.",
};

/** Strips CSS block comments so a comment mentioning a selector by name
 * is never mistaken for a declaration site. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Extracts every `selector { ...props... }` block from a CSS text,
 * returning a map from the exact selector text to its property map
 * (property name -> trimmed value, `;` stripped). Handles the SSR file's
 * template-literal wrapper transparently since it's still just CSS text
 * inside the backticks. */
function parseRules(css: string): Map<string, Map<string, string>> {
  const cleaned = stripComments(css);
  const rules = new Map<string, Map<string, string>>();
  const ruleRe = /([^{}`]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(cleaned))) {
    const selectorGroup = (match[1] ?? "").trim().replace(/\s+/g, " ");
    const body = match[2] ?? "";
    const props = new Map<string, string>();
    for (const decl of body.split(";")) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const prop = trimmed.slice(0, colonIdx).trim();
      const value = trimmed
        .slice(colonIdx + 1)
        .trim()
        .replace(/\s+/g, " ");
      props.set(prop, value);
    }
    // A comma-joined selector group (e.g. `.a, .b { ... }`) applies the
    // SAME declaration block to each individual selector -- split so a
    // group like `.chq-field-invalid, .chq-form-row[...] .chq-input`
    // compares against a bare `.chq-field-invalid` on the other side.
    for (const part of selectorGroup.split(",")) {
      const selector = part.trim();
      if (!selector.startsWith(".") && !selector.startsWith("fieldset")) continue;
      // Merge if this exact selector already has a block (unlikely here,
      // but keeps the map well-defined).
      const existing = rules.get(selector);
      if (existing) {
        for (const [k, v] of props) existing.set(k, v);
      } else {
        rules.set(selector, new Map(props));
      }
    }
  }
  return rules;
}

const SSR_RULES = parseRules(SSR_SOURCE);
const SPA_RULES = parseRules(SPA_SOURCE);

describe("DEC-124: the SSR and SPA error vocabularies agree property-for-property", () => {
  it("both files have rules to compare (parser sanity check)", () => {
    expect(SSR_RULES.size).toBeGreaterThan(3);
    expect(SPA_RULES.size).toBeGreaterThan(3);
  });

  it("every selector shared by both files declares identical properties", () => {
    const allSelectors = new Set([...SSR_RULES.keys(), ...SPA_RULES.keys()]);
    const offenders: string[] = [];

    for (const selector of allSelectors) {
      const inSsr = SSR_RULES.has(selector);
      const inSpa = SPA_RULES.has(selector);

      if (inSsr !== inSpa) {
        if (ALLOWLIST[selector]) continue;
        offenders.push(
          `"${selector}" declared in ${inSsr ? "SSR only" : "SPA only"} and not in the allowlist`,
        );
        continue;
      }

      const ssrProps = SSR_RULES.get(selector)!;
      const spaProps = SPA_RULES.get(selector)!;
      const allProps = new Set([...ssrProps.keys(), ...spaProps.keys()]);
      for (const prop of allProps) {
        const ssrVal = ssrProps.get(prop);
        const spaVal = spaProps.get(prop);
        if (ssrVal === undefined) {
          offenders.push(`"${selector}" { ${prop} }: present in SPA only (value "${spaVal}")`);
        } else if (spaVal === undefined) {
          offenders.push(`"${selector}" { ${prop} }: present in SSR only (value "${ssrVal}")`);
        } else if (ssrVal !== spaVal) {
          offenders.push(`"${selector}" { ${prop} }: SSR "${ssrVal}" != SPA "${spaVal}"`);
        }
      }
    }

    expect(offenders, `error-vocabulary divergence:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("neither declaration site of .chq-field-error carries a ::before marker", () => {
    expect(SSR_SOURCE).not.toMatch(/\.chq-field-error::before/);
    expect(SPA_SOURCE).not.toMatch(/\.chq-field-error::before/);
  });

  it("every allowlist entry names a selector actually declared on one side (no stale entries)", () => {
    const stale: string[] = [];
    for (const selector of Object.keys(ALLOWLIST)) {
      const inSsr = SSR_RULES.has(selector);
      const inSpa = SPA_RULES.has(selector);
      if (inSsr === inSpa) stale.push(selector);
    }
    expect(stale, `allowlist entries no longer one-sided (or not found at all):\n${stale.join("\n")}`).toEqual([]);
  });
});
