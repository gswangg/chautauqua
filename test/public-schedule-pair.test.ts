// task-w5-a (DEC-555 amendment): /schedule joins the PUBLIC PAIR -- same
// 1fr 300px / 60px-gap layout tokens as .chq-pub-sessions-layout and
// .chq-pub-agenda-layout, and the WIDE measure (shell.tsx's
// measureClassForSurface), rather than being the one remaining READING
// column. A CSS-contract test on the raw stylesheet source (not a rendered
// DOM) so it stays independent of any single surface's markup.

import { describe, expect, it } from "vitest";
import { RAIL_CSS } from "../src/routes/public/css/rail.css";
import { measureClassForSurface } from "../src/routes/public/shell";

function layoutTokens(css: string, className: string): { columns: string; gap: string } {
  const re = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`no rule found for .${className}`);
  const body = m[1]!;
  const columns = body.match(/grid-template-columns:\s*([^;]+);/)?.[1]?.trim();
  const gap = body.match(/gap:\s*([^;]+);/)?.[1]?.trim();
  if (!columns || !gap) throw new Error(`.${className} is missing grid-template-columns/gap`);
  return { columns, gap };
}

describe("task-w5-a (DEC-555 amendment): /schedule joins the public pair", () => {
  it(".chq-pub-schedule-layout's grid tokens equal .chq-pub-sessions-layout's (and .chq-pub-agenda-layout's)", () => {
    const schedule = layoutTokens(RAIL_CSS, "chq-pub-schedule-layout");
    const sessions = layoutTokens(RAIL_CSS, "chq-pub-sessions-layout");
    const agenda = layoutTokens(RAIL_CSS, "chq-pub-agenda-layout");
    expect(schedule).toEqual(sessions);
    expect(schedule).toEqual(agenda);
    expect(schedule.gap).toBe("60px");
  });

  it("measureClassForSurface('schedule') is now 'wide', same as sessions/agenda/speakers/gallery", () => {
    expect(measureClassForSurface("schedule")).toBe("wide");
    expect(measureClassForSurface("sessions")).toBe("wide");
    expect(measureClassForSurface("agenda")).toBe("wide");
    expect(measureClassForSurface("speakers")).toBe("wide");
    expect(measureClassForSurface("gallery")).toBe("wide");
  });
});
