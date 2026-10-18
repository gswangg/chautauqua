// DEC-441 amendment (wave 48): ONE owner for the outbound-email footer's
// reason clause (src/mail/reasons.ts). Every `renderEmailHtml(` call site
// under non-test src/ must pass a call into that module as its `reason:`
// value -- never a hand-typed string or template literal -- and every
// exported builder must produce a whole, period-terminated sentence (the
// frame's four worked `why` values in Chautauqua Comms.dc.html are all
// complete sentences ending in a full stop and naming the sending event).
//
// POPULATION: every `renderEmailHtml(` call site found by walking src/
// from disk (readdirSync, never a hand-listed manifest -- DEC-180, "a
// hand-listed population is not a population"), excluding test files and
// src/mail/shell.ts itself (the callee, not a caller) and src/mail/reasons.ts
// (the composer, not a caller). A vacuous-population tripwire pins the exact
// site count so a refactor that silently drops call sites out of the walk
// (or adds a new one nobody pointed at the composer) is loud, not silent.
//
// Two of the measured sites (src/routes/comms/send.ts and
// src/routes/comms/preview.ts) don't spell `reason:` themselves -- they
// pass composeEmailShellOptions(event)'s return value straight through
// (DEC-037: "a preview renders exactly the shell the send call wraps every
// body in -- not a separately hand-typed reason string that can drift from
// it"). Those two are compliant iff composeEmailShellOptions itself (in
// src/routes/comms/compose-core.ts) calls a src/mail/reasons.ts builder;
// checked directly below rather than assuming the delegation is honoured.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import * as reasons from "../src/mail/reasons";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const COMPOSE_CORE_ABS = join(SRC_ROOT, "routes", "comms", "compose-core.ts");

// Exact measured population: every file under src/ (excluding shell.ts and
// reasons.ts) whose text contains a `renderEmailHtml(` call. Any change
// that adds or removes a call site must update this number in the same
// commit -- that's the tripwire.
const EXPECTED_SITE_COUNT = 12;

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

interface CallSite {
  file: string;
  rel: string;
  source: string;
}

function findRenderEmailHtmlCallSites(): CallSite[] {
  const files = walk(SRC_ROOT).filter(
    (f) => f !== join(SRC_ROOT, "mail", "shell.ts") && f !== join(SRC_ROOT, "mail", "reasons.ts"),
  );
  const sites: CallSite[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (source.includes("renderEmailHtml(")) {
      sites.push({ file, rel: relative(ROOT, file), source });
    }
  }
  return sites;
}

// The value bound to `reason:` inside a renderEmailHtml options object
// literal: everything up to the next top-level comma or closing brace on
// the same logical span. Matched loosely (across the object literal, not a
// single line) so multi-line call sites still resolve.
function reasonValueFor(source: string): string[] {
  const values: string[] = [];
  const re = /reason:\s*([^\n,][^\n]*?)(?:,\s*$|,\s*\n|\n\s*\})/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    values.push(m[1]!.trim());
  }
  return values;
}

const REASON_BUILDER_NAMES = Object.entries(reasons)
  .filter(([, v]) => typeof v === "function")
  .map(([k]) => k);

describe("mail reason vocabulary (DEC-441 wave 48)", () => {
  const sites = findRenderEmailHtmlCallSites();

  it("vacuous-population tripwire: the walk finds the expected number of renderEmailHtml call sites", () => {
    expect(sites.length).toBe(EXPECTED_SITE_COUNT);
  });

  it("src/mail/reasons.ts exports at least one reason builder", () => {
    expect(REASON_BUILDER_NAMES.length).toBeGreaterThan(0);
  });

  it("composeEmailShellOptions itself calls a src/mail/reasons.ts builder for its reason: value", () => {
    const source = readFileSync(COMPOSE_CORE_ABS, "utf8");
    const values = reasonValueFor(source);
    expect(values.length).toBe(1);
    const callsBuilder = REASON_BUILDER_NAMES.some((name) => values[0]!.startsWith(`${name}(`));
    expect(callsBuilder).toBe(true);
  });

  it("every call site's reason: value is a call into src/mail/reasons.ts, never a string or template literal (delegation via composeEmailShellOptions counts as compliant)", () => {
    const offenders: string[] = [];
    for (const site of sites) {
      if (site.source.includes("composeEmailShellOptions(")) {
        // Delegates to compose-core.ts's composeEmailShellOptions, checked
        // by the dedicated test above -- no bare reason: value expected here.
        continue;
      }
      const values = reasonValueFor(site.source);
      if (values.length === 0) {
        offenders.push(`${site.rel}: no reason: value found`);
        continue;
      }
      for (const value of values) {
        const isStringOrTemplateLiteral = /^["'`]/.test(value);
        const callsBuilder = REASON_BUILDER_NAMES.some((name) => value.startsWith(`${name}(`));
        if (isStringOrTemplateLiteral || !callsBuilder) {
          offenders.push(`${site.rel}: reason: ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every exported builder produces a whole sentence ending in a full stop", () => {
    const sample: Record<string, unknown[]> = {
      outstandingTasksReason: ["DevFlow Conf 2027"],
      submissionNoteReason: ["DevFlow Conf 2027", true],
      portalInviteReason: ["DevFlow Conf 2027"],
      participantReason: ["DevFlow Conf 2027"],
      submissionConfirmedReason: ["DevFlow Conf 2027"],
      reviewerOutstandingReason: ["DevFlow Conf 2027", "Track A"],
      passwordResetReason: ["DevFlow Conf 2027"],
      accountCreatedReason: ["DevFlow Conf 2027"],
      bulkEmailReason: ["DevFlow Conf 2027"],
      portalNewItemsReason: ["DevFlow Conf 2027"],
      invitationToSpeakReason: ["DevFlow Conf 2027"],
      sponsorReason: ["DevFlow Conf 2027", "Latticework Systems"],
    };
    // Every exported function must have a sample entry above -- a builder
    // added to the module with no sample here would silently skip this
    // assertion, so fail loudly if the two lists diverge.
    expect(Object.keys(sample).sort()).toEqual([...REASON_BUILDER_NAMES].sort());

    for (const name of REASON_BUILDER_NAMES) {
      const fn = (reasons as unknown as Record<string, (...args: unknown[]) => string>)[name]!;
      const result = fn(...sample[name]!);
      expect(typeof result).toBe("string");
      expect(result.endsWith(".")).toBe(true);
      // "one sentence": exactly one full stop, and it's the last character.
      expect(result.indexOf(".")).toBe(result.length - 1);
      expect(result.length).toBeGreaterThan(1);
    }
  });

  it("every builder also produces a whole sentence when the event name is unavailable (null-safe paths only)", () => {
    const nullableSamples: Record<string, unknown[]> = {
      submissionNoteReason: [null, false],
      reviewerOutstandingReason: [null, "Track A"],
      accountCreatedReason: [null],
    };
    for (const [name, args] of Object.entries(nullableSamples)) {
      const fn = (reasons as unknown as Record<string, (...args: unknown[]) => string>)[name]!;
      const result = fn(...args);
      expect(result.endsWith(".")).toBe(true);
      expect(result.trim().length).toBeGreaterThan(1);
    }
  });
});
