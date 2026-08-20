// DEC-576 (wave-128, task w3-l): TaskFormPage was the last portal drill page
// whose primary rendered only inline -- docs/design/Chautauqua Public and
// Portal.dc.html:518-521 ("Portal · Hotel stay form · 390") draws a docked
// footer holding the primary submit. This test copies edit.tsx's own idiom
// (test/portal-w6-h-dock.test.ts's CSS-scan pattern for the geometry half,
// the render-pure-component idiom test/portal-session-phone-frames.test.ts
// already uses for TaskFormPage) and asserts:
//   (a) the rendered page carries a .chq-portal-dock containing a submit
//       bound to the form's id;
//   (b) both the docked copy and the inline copy target ONE form (never a
//       second <form>, never a duplicated action);
//   (c) the CSS declares exactly one visible copy per width.

import { describe, expect, it } from "vitest";
import { PORTAL_CSS } from "../src/routes/portal/portal.css";
import { TaskFormPage } from "../src/routes/portal/tasks/views";
import type { FormFieldRow } from "../src/server/repo/forms";
import type { PortalTaskAssignment } from "../src/server/repo/portal/tasks";

function extract700Blocks(src: string): string[] {
  const blocks: string[] = [];
  const marker = "@media (max-width: 700px)";
  let searchFrom = 0;
  for (;;) {
    const idx = src.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const openBrace = src.indexOf("{", idx);
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(src.slice(openBrace + 1, i));
    searchFrom = i + 1;
  }
  return blocks;
}

function desktopLayer(css: string): string {
  const idx = css.indexOf("@media (max-width: 700px)");
  expect(idx, "no phone media block found").toBeGreaterThan(-1);
  return css.slice(0, idx);
}

const PHONE_BLOCK = extract700Blocks(PORTAL_CSS).join("\n");
const DESKTOP = desktopLayer(PORTAL_CSS);

const assignment: PortalTaskAssignment = {
  id: "assign-1",
  taskId: "task-1",
  eventId: "evt-1",
  kind: "form",
  title: "Hotel stay form",
  description: null,
  instructions: null,
  dueDate: null,
  assignedAt: 0,
  required: true,
  status: "pending",
  formId: "form-1",
  deliverableKind: null,
  fileId: null,
  responseJson: null,
  timezone: "UTC",
  completedAt: null,
};

const fields: FormFieldRow[] = [
  { id: "f1", formId: "form-1", locked: false, section: "session", kind: "text", label: "Do you need a hotel room?", required: true, position: 0 },
];

const html = TaskFormPage({
  branding: { eventName: "Event", welcomeMessage: null, accentColor: null, logoUrl: null },
  assignment,
  fields,
  answers: {},
  csrfToken: "tok",
  speakerName: "Speaker Name",
}).toString();

describe("TaskFormPage adopts the portal dock band (DEC-576 wave-128)", () => {
  it("carries exactly one task form, id'd, and the docked submit binds to it via the form= attribute", () => {
    // the header/footer each render their own Sign out <form> (DEC-154) --
    // scope to forms posting to THIS task's own action, never a bare count
    // of every <form> in the shared portal chrome.
    const formOpenTags = (html.match(/<form\b[^>]*>/g) ?? []).filter((tag) =>
      tag.includes('action="/portal/tasks/assign-1/form"'),
    );
    expect(formOpenTags).toHaveLength(1);
    expect(formOpenTags[0]).toMatch(/\bid="chq-portal-task-form"/);
    expect(formOpenTags[0]).toMatch(/action="\/portal\/tasks\/assign-1\/form"/);

    const dockIdx = html.indexOf('class="chq-portal-dock"');
    expect(dockIdx).toBeGreaterThan(-1);
    const dockBlock = html.slice(dockIdx, html.indexOf("</div>", dockIdx) + "</div>".length);
    // the dock's own inner wrapper + submit
    expect(dockBlock).toContain('class="chq-portal-taskform-dock"');
    const dockSubmit = html.slice(html.indexOf('class="chq-portal-taskform-dock"'));
    const dockButtonTag = dockSubmit.match(/<button[^>]*>/)?.[0];
    expect(dockButtonTag).toBeDefined();
    expect(dockButtonTag).toMatch(/type="submit"/);
    expect(dockButtonTag).toMatch(/form="chq-portal-task-form"/);
    expect(dockButtonTag).toMatch(/chq-btn-primary/);
  });

  it("the inline copy inside the form is a second submit of the SAME form -- no duplicated action", () => {
    const formOpenIdx = html.indexOf('id="chq-portal-task-form"');
    expect(formOpenIdx).toBeGreaterThan(-1);
    const inlineIdx = html.indexOf('class="chq-portal-taskform-submit"');
    expect(inlineIdx).toBeGreaterThan(-1);
    const formCloseIdx = html.indexOf("</form>", formOpenIdx);
    expect(inlineIdx).toBeGreaterThan(formOpenIdx);
    expect(inlineIdx).toBeLessThan(formCloseIdx);
    const inlineButtonTag = html.slice(inlineIdx).match(/<button[^>]*>/)?.[0];
    expect(inlineButtonTag).toBeDefined();
    expect(inlineButtonTag).toMatch(/type="submit"/);
    expect(inlineButtonTag).toMatch(/chq-btn-primary/);
    // this copy relies on being INSIDE the form element (no explicit
    // form= attribute needed, and none present) -- confirmed above that
    // there is exactly one <form> on the page and this button sits before
    // its close tag.
    expect(inlineButtonTag).not.toMatch(/\bform="/);

    // never a second <form>, never a second/duplicated action -- the whole
    // document only ever posts to the one assignment/form endpoint.
    const actionOccurrences = (html.match(/action="\/portal\/tasks\/assign-1\/form"/g) ?? []).length;
    expect(actionOccurrences).toBe(1);
  });

  it("does NOT build the frame's bordered 'Save draft' secondary (DEVIATIONS.md §6 defers it)", () => {
    expect(html).not.toMatch(/Save draft/);
  });

  it("does not change the primary's copy or the back link (out of this task's scope)", () => {
    expect(html).toContain('<a href="/portal/tasks" class="chq-portal-back">');
    expect(html).toContain(">Submit<");
  });

  it("the docked copy is hidden at the TOP LEVEL -- desktop stays byte-identical to the inline-only original", () => {
    expect(DESKTOP).toMatch(/\.chq-portal-taskform-dock\s*\{[^}]*display:\s*none/);
    // and the desktop layer never hides the in-flow inline copy
    expect(DESKTOP).not.toMatch(/\.chq-portal-taskform-submit\s*\{[^}]*display:\s*none/);
  });

  it("the phone block reveals the dock copy and hides the inline copy -- exactly one visible per width", () => {
    expect(PHONE_BLOCK).toMatch(/\.chq-portal-taskform-dock\s*\{[^}]*display:\s*flex/);
    expect(PHONE_BLOCK).toMatch(/\.chq-portal-taskform-submit\s*\{[^}]*display:\s*none/);
  });
});
