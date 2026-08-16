// DEC-522 (wave-52 amendment): the walkthrough must build openDate/closeDate
// PATCH values from a whole-day offset off Date.now(), never a sub-day one —
// a day-label column is expanded event-local (dayLabelStartInstant /
// dayLabelEndInstant), and IANA timezone offsets from UTC range from -12h to
// +14h, so a sub-day offset can still resolve to TODAY's UTC calendar date
// for part of every UTC day, silently no-oping the window shift. This file
// has two parts: BEHAVIOURAL (dayLabelMs actually produces an unambiguous
// open/not-yet-open read across a 24h sweep of "now" and a spread of
// timezones) and SCAN (no scripts/walkthrough/*.ts source still contains a
// sub-day-offset openDate/closeDate expression, the exact defect shape being
// `Date.now() - 60_000`).

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { dayLabelMs } from "../scripts/walkthrough-lib";
import { formWindowState } from "../src/lib/submit-core";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WALKTHROUGH_DIR = join(REPO_ROOT, "scripts", "walkthrough");

// Spread of IANA offsets covering the -12h..+14h range plus the walkthrough's
// own America/Los_Angeles.
const TIMEZONES = ["Pacific/Midway", "America/Los_Angeles", "UTC", "Europe/Berlin", "Asia/Tokyo", "Pacific/Kiritimati"];

// One fixed UTC day, swept hour by hour (24 samples).
const DAY_START = Date.UTC(2027, 2, 15); // 2027-03-15T00:00:00Z, arbitrary "today"

describe("dayLabelMs (DEC-522) — behavioural: unambiguous across a 24h now sweep x timezone spread", () => {
  for (const tz of TIMEZONES) {
    for (let hour = 0; hour < 24; hour++) {
      const now = DAY_START + hour * 60 * 60 * 1000;

      it(`tz=${tz} hour=${hour}: -2d is 'open', +2d is 'not_yet_open', +30d is 'open'`, () => {
        const originalNow = Date.now;
        try {
          Date.now = () => now;
          const openDate = dayLabelMs(-2);
          const notYetOpenDate = dayLabelMs(2);
          const closeDate = dayLabelMs(30);

          expect(formWindowState(openDate, closeDate, now, tz)).toBe("open");
          expect(formWindowState(notYetOpenDate, closeDate, now, tz)).toBe("not_yet_open");
        } finally {
          Date.now = originalNow;
        }
      });
    }
  }
});

describe("scripts/walkthrough/*.ts — scan: no sub-day-offset openDate/closeDate expression", () => {
  const files = readdirSync(WALKTHROUGH_DIR).filter((f) => f.endsWith(".ts"));
  expect(files.length).toBeGreaterThan(0);

  // Matches `openDate: <expr>` / `closeDate: <expr>` (and the same as a
  // standalone `const openDate = <expr>` assignment) where <expr> contains a
  // `Date.now()` offset by a raw millisecond literal that is NOT a whole
  // multiple of 86_400_000 (a day). We deliberately do not try to fully
  // parse JS: we scan for the two known offending shapes literally so this
  // stays a reliable text-level defect scanner.
  const DATE_NOW_OFFSET_RE = /(?:openDate|closeDate)\s*[:=]\s*Date\.now\(\)\s*([+-])\s*([0-9_]+(?:\s*\*\s*[0-9_]+)*)/g;

  function millisFromExpr(mulChain: string): number {
    // e.g. "60_000" or "24 * 60 * 60 * 1000" -> numeric product.
    return mulChain
      .split("*")
      .map((part) => Number(part.replace(/_/g, "").trim()))
      .reduce((a, b) => a * b, 1);
  }

  for (const file of files) {
    it(`${file}: every openDate/closeDate Date.now() offset is a whole multiple of 86_400_000`, () => {
      const src = readFileSync(join(WALKTHROUGH_DIR, file), "utf8");
      const offenders: string[] = [];
      let m: RegExpExecArray | null;
      DATE_NOW_OFFSET_RE.lastIndex = 0;
      while ((m = DATE_NOW_OFFSET_RE.exec(src)) !== null) {
        const ms = millisFromExpr(m[2]!);
        if (ms % 86_400_000 !== 0) {
          offenders.push(m[0]);
        }
      }
      expect(offenders, `sub-day offset(s) found in ${file}: ${JSON.stringify(offenders)}`).toEqual([]);
    });
  }
});
