// User-filed (gate-9 cycle): three tables shipped columns with the
// AUTO-layout shrink-to-content hack (`width: 1px; white-space: nowrap`)
// inside `table-layout: fixed` tables — under fixed layout the 1px is
// taken literally, the column starves, and its nowrap content bleeds past
// the page measure (review results Accept/Decline +147px, content worklist
// Approve/Open +145px, contacts actions +19px). A fixed table's trailing
// column needs its real width. This scan bans the hack's signature from
// any stylesheet that also declares a fixed table.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "app", "src");

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFiles(p));
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

describe("no width:1px shrink-hack columns in fixed-layout stylesheets", () => {
  it("every file with table-layout:fixed is free of the 1px+nowrap column signature", () => {
    const offenders: string[] = [];
    for (const file of cssFiles(ROOT)) {
      const css = readFileSync(file, "utf8");
      if (!css.includes("table-layout: fixed")) continue;
      for (const m of css.matchAll(/([^{}]*)\{[^}]*width:\s*1px;[^}]*white-space:\s*nowrap[^}]*\}/g)) {
        // Only table COLUMN classes — 1px is legitimate for visually-hidden
        // inputs and hairline dividers, which never sit in a fixed table's
        // column set.
        if (!/-col-/.test(m[1] ?? "")) continue;
        const line = css.slice(0, (m.index ?? 0)).split("\n").length;
        offenders.push(`${file}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
