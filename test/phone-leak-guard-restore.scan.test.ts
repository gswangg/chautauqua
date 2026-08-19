// Phone leak-guard restore parity (meta-fidelity probe C, mandate item 2).
//
// DEC-385/w6-h gave the phone agenda a "single 700px phone switch": every
// .chq-phone-* class is hidden by ONE top-level `display: none` rule -- the
// LEAK-GUARD -- so the desktop DayGrid/UnscheduledTray markup can never have
// phone-only blocks leaking underneath it, JS-mount (useIsPhone) or not. The
// `@media (max-width: 700px)` block below it is then the sole place the
// phone markup comes back.
//
// That idiom has one failure mode and the probe found it live: a class that
// is in the guard but whose phone-width rule only sets type/colour/spacing
// never gets its display back, because the guard's `display: none` is the
// last declaration standing at equal specificity. The rule LOOKS present,
// the class LOOKS styled, and the element renders at zero height. Fourteen
// of the guard's thirty classes were in that state at 390px --
// -slot-time, -slot-card-title, -slot-card-meta, -slot-clash,
// -slot-free-label, -slot-free-length, -room-chip, -sheet,
// -footer-armed-title, -footer-armed-ref, -agenda-wordmark, -agenda-counts,
// -agenda-h1, -footer-btn -- which is to say the phone agenda's day
// selector, its slot cards, its room chips and its whole armed footer.
//
// So this scan asserts SET EQUALITY, not "some rule mentions the class":
// every class hidden by a leak-guard MUST be restored by a rule inside a
// phone-width media block IN THE SAME FILE that actually declares `display`.
// A restore is only credited when the class is the SUBJECT of the selector
// (its rightmost compound) -- `.chq-phone-slot-clash .chq-phone-slot-card-title`
// restores the title, not the clash panel, and a descendant rule that names
// the class only as an ancestor proves nothing about the class's own box.
//
// DEC-808: the population is DERIVED, never hand-listed. Every *.css under
// app/src/ is walked (readdirSync, no file list), and a leak-guard is
// recognised structurally -- a rule whose entire body is `display: none` and
// whose every selector is a bare `.chq-phone-*` class. A hand-written list
// of guarded classes is exactly the ledger that would go stale the first
// time someone adds a class to the guard and forgets the restore, which is
// the regression this pin exists to catch. A vacuous-population tripwire
// guards the derivation itself: the structural match must find at least one
// guard, covering at least 30 classes, or the scan is passing over nothing.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");

/** Tripwires: the structural match must not silently match nothing (or
 * something else) and pass green over an empty set. Raise these when a
 * second guard lands; never lower them to paper over a deletion. */
const MIN_GUARDS = 1;
const MIN_GUARDED_CLASSES = 30;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every .css file under app/src/, derived by walk -- never a file list. */
function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...cssFiles(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out.sort();
}

/** Every `selector { body }` rule in `css`, flat -- at-rule preludes are
 * dropped by the same pass, so a rule nested in `@media` is returned on its
 * own terms. Comments are stripped first so a literal brace inside one
 * cannot desynchronise the scan. */
function rules(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" });
  }
  return out;
}

/** The rightmost compound of a selector -- the element the rule is ABOUT. */
function subjectOf(selector: string): string {
  const parts = selector.split(/[\s>+~]+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** A leak-guard: a rule whose whole body is `display: none` and whose every
 * comma-separated selector is a bare `.chq-phone-*` class (no descendant, no
 * state qualifier). Returns the class names it hides, unprefixed. */
function guardedClasses(css: string): string[][] {
  const out: string[][] = [];
  for (const rule of rules(css)) {
    if (!/^\s*display\s*:\s*none\s*;?\s*$/.test(rule.body)) continue;
    const sels = rule.selector
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (sels.length < 2) continue;
    if (!sels.every((s) => /^\.chq-phone-[a-z0-9-]+$/.test(s))) continue;
    out.push(sels.map((s) => s.slice(1)));
  }
  return out;
}

/** Every class whose OWN display is (re)declared inside a phone-width
 * (`max-width: <=700px`) media block. */
function restoredClasses(css: string): Set<string> {
  const out = new Set<string>();
  const mediaRe = /@media[^{]*max-width:\s*(\d+)px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(css)) !== null) {
    if (Number(mm[1]) > 700) continue;
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    for (const rule of rules(css.slice(bodyStart, i - 1))) {
      if (!/(^|;)\s*display\s*:/.test(rule.body)) continue;
      if (/display\s*:\s*none/.test(rule.body)) continue;
      for (const sel of rule.selector.split(",")) {
        for (const cls of subjectOf(sel.trim()).match(/\.chq-phone-[a-z0-9-]+/g) ?? []) {
          out.add(cls.slice(1));
        }
      }
    }
  }
  return out;
}

const FILES = cssFiles(APP_SRC).map((path) => {
  const css = stripComments(readFileSync(path, "utf-8"));
  return { path, rel: path.slice(REPO_ROOT.length + 1), guards: guardedClasses(css), restored: restoredClasses(css) };
});
const WITH_GUARDS = FILES.filter((f) => f.guards.length > 0);

describe("phone leak-guard restore parity", () => {
  it("finds the leak-guards it scans (vacuous-population tripwire)", () => {
    const guardCount = WITH_GUARDS.reduce((n, f) => n + f.guards.length, 0);
    const classCount = WITH_GUARDS.reduce((n, f) => n + f.guards.reduce((k, g) => k + g.length, 0), 0);
    expect(guardCount).toBeGreaterThanOrEqual(MIN_GUARDS);
    expect(classCount).toBeGreaterThanOrEqual(MIN_GUARDED_CLASSES);
  });

  it("restores EVERY class its leak-guard hides, inside the phone-width block, with a real display", () => {
    const stranded: string[] = [];
    for (const file of WITH_GUARDS) {
      for (const guard of file.guards) {
        for (const cls of guard) {
          if (!file.restored.has(cls)) stranded.push(`${file.rel}: .${cls}`);
        }
      }
    }
    expect(
      stranded,
      `these classes are hidden by a top-level phone leak-guard and never get their display back at <=700px, ` +
        `so they render at zero height on a phone:\n  ${stranded.join("\n  ")}`,
    ).toEqual([]);
  });

  it("never restores a class the guard does not hide (the guard is the whole population)", () => {
    for (const file of WITH_GUARDS) {
      const guarded = new Set(file.guards.flat());
      const orphans = [...file.restored].filter((c) => !guarded.has(c));
      expect(orphans, `${file.rel}: restored at <=700px but absent from the leak-guard: ${orphans.join(", ")}`).toEqual(
        [],
      );
    }
  });
});
