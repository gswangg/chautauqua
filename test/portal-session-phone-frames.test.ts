// w3-b (V12 MOBILE CAMPAIGN, DEC-385): "Portal · Hotel stay form",
// "Portal · Your session" and "Portal · Edit your session" at 390 --
// docs/design/Chautauqua Public and Portal.dc.html:505-527
// `width:390px; height:844px` -- v9-f (DEC-976 wave-91) receipt below.
it("v9-f receipt: frame container (:505) is the standard 390x844 phone card", () => {
  expect(PORTAL_CSS).toMatch(/@media \(max-width: 700px\)/);
});
// / :563-596 /
// :600-679. jsdom never evaluates @media rules (this repo has no layout
// engine), so geometry is pinned by scanning PORTAL_CSS's own
// `@media (max-width: 700px)` block text -- the same idiom
// test/portal-phone-fit.test.ts and test/account-docs-phone-frames.test.ts
// already use. Markup facts the frame dictates (field order, DOM order,
// which register a class carries) are pinned by rendering the pure
// components (EditPage/TaskFormPage) to a string via hono/jsx's
// `.toString()`, the same pattern test/portal-edit-track-vocabulary.test.ts
// uses.
//
// Only "Hotel stay form" and "Edit your session" are rendered by files this
// task owns (src/routes/portal/tasks/views.tsx, src/routes/portal/edit.tsx).
// "Your session" (the read-only detail) renders from src/routes/portal/
// index.tsx, owned by a different lane -- its describe block below only
// pins the SHARED classes (.chq-portal-actions, PORTAL_CSS) that page also
// consumes, never that file's own markup.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PORTAL_CSS } from "../src/routes/portal/portal.css";
import { EditPage } from "../src/routes/portal/edit";
import { TaskFormPage } from "../src/routes/portal/tasks/views";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { FormFieldRow } from "../src/server/repo/forms";
import type { PortalTaskAssignment } from "../src/server/repo/portal/tasks";

const REPO_ROOT = join(__dirname, "..");
const THEME_TS = readFileSync(join(REPO_ROOT, "src/views/theme.ts"), "utf8");

/** Extracts the contents of every `@media (max-width: 700px) { ... }` block
 * via balanced-brace scanning -- identical helper to portal-phone-fit.test.ts
 * / account-docs-phone-frames.test.ts, so all three tests agree on what
 * "inside the 700px block" means. */
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

const phoneBlock = extract700Blocks(PORTAL_CSS).join("\n");

describe('"Portal · Hotel stay form" 390 (docs/design/Chautauqua Public and Portal.dc.html:505-527)', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:508
  // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Hotel stay form</h1>`
  it("H1 takes the 25px back-linked drill-in register, not the 27px cluster-landing size (DEC-643)", () => {
    expect(phoneBlock).toMatch(/\.chq-portal-hero-drill\s*\{[^}]*font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
    expect(THEME_TS).toMatch(/--chq-type-page-title-phone-drill:\s*25px/);

    const fields: FormFieldRow[] = [
      { id: "f1", formId: "form-1", locked: false, section: "session", kind: "text", label: "Do you need a hotel room?", required: true, position: 0 },
    ];
    const assignment: PortalTaskAssignment = {
      id: "a1",
      taskId: "t1",
      eventId: "e1",
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
    const html = TaskFormPage({
      branding: { eventName: "Event", welcomeMessage: null, accentColor: null, logoUrl: null },
      assignment,
      fields,
      answers: {},
      csrfToken: "tok",
      speakerName: "Speaker Name",
    }).toString();
    expect(html).toContain('<h1 class="chq-portal-hero chq-portal-hero-drill">Hotel stay form</h1>');
  });

  // docs/design/Chautauqua Public and Portal.dc.html:510
  // `<div style="flex:1; min-height:0; overflow-y:auto; padding:14px 16px 16px">`
  it("the body is the phone shell's own scroll region (flex:1, min-height:0, overflow-y:auto), not the page", () => {
    const rule = phoneBlock.match(/\.chq-portal-shell\s*>\s*\.chq-measure\s*\{([^}]*)\}/);
    expect(rule, "expected .chq-portal-shell > .chq-measure inside the phone block").not.toBeNull();
    expect(rule![1]).toMatch(/flex:\s*1;/);
    expect(rule![1]).toMatch(/min-height:\s*0;/);
    expect(rule![1]).toMatch(/overflow-y:\s*auto;/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:514
  // `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">{{ q.label }}</span>`
  it("every field is one full-measure row, min-width:0 so no field can re-impose the desktop 560px floor", () => {
    expect(phoneBlock.length).toBeGreaterThan(0);
    // .chq-field is declared in a comma-joined selector group inside the
    // phone block (portal-phone-fit.test.ts already pins the same group).
    const groupMatch = phoneBlock.match(
      /\.chq-portal-row,\s*\n\s*\.chq-portal-row-head,\s*\n\s*\.chq-portal-field,\s*\n\s*\.chq-field,\s*\n\s*table,\s*\n\s*pre,\s*\n\s*code\s*\{([^}]*)\}/,
    );
    expect(groupMatch, "expected the shared min-width:0 group covering .chq-field").not.toBeNull();
    expect(groupMatch![1]).toMatch(/min-width:\s*0;/);
  });
});

describe('"Portal · Your session" 390 (docs/design/Chautauqua Public and Portal.dc.html:563-596) -- shared classes only, markup owned by another lane', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:585
  // `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Replace</span>`
  it("the slides row's action control (.chq-portal-actions .chq-btn, the same class src/routes/portal/index.tsx's Replace/upload link uses) hits the 44px floor on phone", () => {
    expect(phoneBlock).toMatch(/\.chq-portal-actions\s+\.chq-btn\s*\{[^}]*min-height:\s*44px/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:569
  // `<span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#4E5C31">Accepted · 14 Mar</span>`
  it("the status badge's own block-level register is unmediated (identical at every width, per DEC-385 -- no phone-only redeclaration needed)", () => {
    expect(PORTAL_CSS).toMatch(/\.chq-portal-status-badge\s*\{\s*display:\s*block;/);
  });
});

describe('"Portal · Edit your session" 390 (docs/design/Chautauqua Public and Portal.dc.html:600-679)', () => {
  // `width:390px; height:844px` -- the standard phone-frame card this
  // describe block's whole extent is drawn inside.
  it("frame container (:600) is the standard 390x844 phone card, and the tree actually gives this page phone-card treatment", () => {
    expect(readFileSync(join(REPO_ROOT, "docs/design/Chautauqua Public and Portal.dc.html"), "utf8").split("\n")[599]).toContain("width:390px; height:844px");
    // The citation is not self-proving (DEC-967) -- assert the rendered
    // page is the exact shell PORTAL_CSS's @media (max-width:700px) block
    // conditions its phone geometry on, so this frame's 390 width maps
    // onto a real, narrower-than-700 override in the tree. `html` and
    // `phoneBlock` are defined further down/above this describe block but
    // captured by closure, same as every other it() here.
    expect(html).toContain('class="chq-portal-shell"');
    expect(PORTAL_CSS).toMatch(/@media \(max-width: 700px\)/);
    expect(phoneBlock).toMatch(/\.chq-portal-shell\b/);
  });

  const DATA: EditableSubmissionData = {
    submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
    form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
    fields: [],
    answers: {},
    offeredTrackIds: [],
    allTracks: [],
    selectedTrackIds: [],
  };
  const html = EditPage({
    branding: { eventName: "Event", welcomeMessage: null, accentColor: null, logoUrl: null },
    submissionId: "s1",
    data: DATA,
    answers: {},
    selectedTrackIds: [],
    csrfToken: "tok",
    editable: true,
    tracksEditable: false,
    participants: [],
    speakerName: "Speaker Name",
  }).toString();

  // docs/design/Chautauqua Public and Portal.dc.html:603
  // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Edit your session</h1>`
  it("H1 takes the 25px back-linked drill-in register (DEC-643), matching the Hotel stay form frame", () => {
    expect(html).toContain('<h1 class="chq-portal-hero chq-portal-hero-drill">Edit your session</h1>');
  });

  // docs/design/Chautauqua Public and Portal.dc.html:645
  // `<div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:48px; display:flex; align-items:center; padding:0 13px; font-size:15px; color:#565A4B">First name</div>`
  it("First name precedes Last name in DOM order (the desktop two-up pair's own source order, which the phone single column inherits unchanged)", () => {
    const firstIdx = html.indexOf('name="firstName"');
    const lastIdx = html.indexOf('name="lastName"');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(lastIdx).toBeGreaterThan(firstIdx);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:660
  // `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Role</span>`
  it("the role select is full-measure at 390 -- the desktop-only 190px pairing is overridden inside the phone block", () => {
    expect(phoneBlock).toMatch(/\.chq-portal-copresenter-role\s*\{[^}]*flex:\s*1 1 100%;[^}]*min-width:\s*0;/);
    // the unmediated (desktop) rule keeps its 190px cap -- this is a
    // max-width-only override, never a rewrite (DEC-385).
    const withoutMedia = PORTAL_CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, "");
    expect(withoutMedia).toMatch(/\.chq-portal-copresenter-role\s*\{[^}]*flex:\s*0 1 190px;/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:669
  // `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save changes</span>`
  it("Save changes (primary) leads the footer dock row and grows to fill it, at 390 -- Cancel takes its own padded width, never the full-width stacked column DEC-989 ruling B6 gives every other portal action row", () => {
    expect(phoneBlock).toMatch(/\.chq-portal-actions-footer\s+\.chq-portal-actions\s*\{[^}]*flex-direction:\s*row;[^}]*order:\s*-1;/);
    expect(phoneBlock).toMatch(/\.chq-portal-actions-footer\s+\.chq-btn-primary\s*\{[^}]*flex:\s*1;[^}]*order:\s*-1;/);
    expect(phoneBlock).toMatch(/\.chq-portal-actions-footer\s+\.chq-portal-actions\s+\.chq-btn\s*\{[^}]*width:\s*auto;/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:672
  // `<span style="font-size:12px; color:#565A4B; line-height:1.5">Title and abstract show on the public pages · co-presenters do not</span>`
  it("the consequence note stays AFTER the button row in DOM order -- the phone-only reorder above is a visual flex `order`, never a JSX change, so desktop stays frozen", () => {
    const noteIdx = html.indexOf("Title and abstract show on the public pages");
    const actionsIdx = html.indexOf('class="chq-portal-actions"');
    expect(noteIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(-1);
    expect(noteIdx).toBeLessThan(actionsIdx);
  });
});
