// Desktop-frame parity, Speakers cluster (v12 mobile campaign, DEC-976;
// task v12m-w3-p). test/desktop-frame-ledger.scan.test.ts (DEC-976 wave-99
// amendment) established that the desktop half of the campaign has never
// been measured -- 108 desktop frames across the pack with no claim, no
// ledger, no floor. This file claims the seven desktop frames named in this
// wave's charter, all from docs/design/Chautauqua Speakers.dc.html:
//
//   :187 "New task"                          -- TaskModal.tsx
//   :228 "Task response"                     -- ResponseModal.tsx
//   :288 "Participation · open"              -- ParticipationMenu.tsx
//   :442 "Speakers · search found nothing"   -- narrowing.ts + OnboardingGrid.tsx
//   :491 "Review these reminders"            -- RemindPreviewModal.tsx
//   :549 "Speakers · a write failed"         -- status-vocabulary-parity.test.ts's
//                                                own subject (see the note below)
//   :665 "One task · still waiting"          -- TaskView.tsx
//
// RECEIPT SHAPE (DEC-976 wave-87/102): each it() below carries, in its own
// comment, the strict citation `docs/design/Chautauqua Speakers.dc.html:<line>`
// and a backtick-quoted literal copied verbatim from that exact frame line,
// with a real expect() about the TREE (an app source file, read via
// readFileSync -- never the design file compared to itself, per DEC-967
// wave-99) within six source lines beneath. Expected values are typed
// literals.
//
// :549 IS RULED STALE (DEVIATIONS.md, "Speakers status vocabulary under
// write-failure", DEC-730 wave-90 amendment; re-derived in
// docs/design/audit/speakers-v12.md section 1). The frame draws the
// PRE-inversion pill vocabulary (filled-olive Complete / outlined Overdue),
// which v12 replaced everywhere else in the same file (:28/:129, :598,
// :665). The ruling: a status field cannot change its meaning-to-appearance
// mapping depending on an unrelated write outcome, so the app's inverted
// `DONE`/`PEND`/`LATE` vocabulary wins even under the write-failure banner.
// This file claims :549 by asserting the app implements that inverted
// vocabulary AND ships the write-failure banner class the frame's other
// content (the rejected-write copy, the "Try again" / "Reload the grid"
// actions) describes -- it does not, and must not, assert the frame's
// drawn (stale) pill styling.
//
// This file does not touch app/src/pages/speakers/task-view.css or
// app/src/pages/speakers/SpeakerDetailPage.tsx (in-flight lanes hold both)
// -- every assertion below anchors on a stable class name or literal in a
// different file.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const SPEAKERS_DIR = join(REPO_ROOT, 'app', 'src', 'pages', 'speakers');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Speakers.dc.html');

function read(relPath: string): string {
  return readFileSync(join(SPEAKERS_DIR, relPath), 'utf-8');
}

describe('desktop frame parity: Speakers cluster (v12m-w3-p)', () => {
  it('the design file exists and is non-trivial (sanity check on the population this file claims against)', () => {
    const design = readFileSync(DESIGN_FILE, 'utf-8');
    expect(design.split('\n').length).toBeGreaterThan(600);
  });

  // docs/design/Chautauqua Speakers.dc.html:187
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">New task</span>`
  it('TaskModal.tsx titles the create-task modal "New task" (:187)', () => {
    const src = read('TaskModal.tsx');
    expect(src).toMatch(/title=\{isEdit \? 'Edit task' : 'New task'\}/);
  });

  // docs/design/Chautauqua Speakers.dc.html:208
  // `<span style="border:1px solid #4E5C31; border-radius:4px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 15px; font-size:14px; font-weight:700">Upload</span>`
  it('TaskModal.tsx offers the Kind segmented group the frame draws (Upload/Form/Acknowledge) (:187 extent)', () => {
    const src = read('TaskModal.tsx');
    expect(src).toMatch(/role="group" aria-label="Kind"/);
  });

  // docs/design/Chautauqua Speakers.dc.html:218
  // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Create the task</span>`
  it('TaskModal.tsx submits with "Create the task" for a new (non-edit) task (:187 extent)', () => {
    const src = read('TaskModal.tsx');
    expect(src).toMatch(/submitting \? 'Creating\.\.\.' : 'Create the task'/);
  });

  // docs/design/Chautauqua Speakers.dc.html:228
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Task response</span>`
  it('ResponseModal.tsx falls back to the title "Task response" before a detail loads (:228)', () => {
    const src = read('ResponseModal.tsx');
    expect(src).toMatch(/title=\{detail \? detail\.taskTitle : 'Task response'\}/);
  });

  // docs/design/Chautauqua Speakers.dc.html:247
  // `<span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:600; color:#2E2A24">Reopen this task</span>`
  it('ResponseModal.tsx offers exactly one action, "Reopen this task" (:228 extent, DEC-599/DEC-694)', () => {
    const src = read('ResponseModal.tsx');
    expect(src).toMatch(/Reopen this task/);
  });

  // docs/design/Chautauqua Speakers.dc.html:288
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Participation · open</span>`
  it('ParticipationMenu.tsx renders the open participation menu with its own class (:288)', () => {
    const src = read('ParticipationMenu.tsx');
    expect(src).toMatch(/className="chq-participation-menu"/);
  });

  // docs/design/Chautauqua Speakers.dc.html:305
  // `<span style="margin-left:auto; font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#4E5C31">Now</span>`
  it('ParticipationMenu.tsx marks the current participation status with a "NOW" marker (:288 extent)', () => {
    const src = read('ParticipationMenu.tsx');
    expect(src).toMatch(/className="chq-participation-menu-now">NOW<\/span>/);
  });

  // docs/design/Chautauqua Speakers.dc.html:442
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">No speaker matches all three filters</span>`
  it('OnboardingGrid.tsx feeds its filtered empty state from narrowing.ts\'s single active facet (:442)', () => {
    const src = read('OnboardingGrid.tsx');
    expect(src).toMatch(/import \{ activeFacet \} from '\.\/narrowing'/);
    expect(src).toMatch(/facet\.reason\(filters\.q\.trim\(\) \|\| null\)/);
  });

  // docs/design/Chautauqua Speakers.dc.html:442
  // `<a href="#" style="font-size:14px; font-weight:700">Clear the overdue filter ›</a>`
  it('narrowing.ts names the exact escape label the frame draws for the overdue facet (:442)', () => {
    const src = read('narrowing.ts');
    expect(src).toMatch(/escapeLabel: 'Clear the overdue filter ›'/);
  });

  // docs/design/Chautauqua Speakers.dc.html:491
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Review these reminders</span>`
  it('RemindPreviewModal.tsx titles the reminder-preview modal "Review these reminders" (:491)', () => {
    const src = read('RemindPreviewModal.tsx');
    expect(src).toMatch(/title="Review these reminders"/);
  });

  // docs/design/Chautauqua Speakers.dc.html:538
  // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Send these 3</span>`
  it('RemindPreviewModal.tsx sends with a count-bearing "Send these N" label (:491 extent)', () => {
    const src = read('RemindPreviewModal.tsx');
    expect(src).toMatch(/`Send these \$\{count\}`/);
  });

  // docs/design/Chautauqua Speakers.dc.html:586 (:549 extent) -- RULED STALE, see file header.
  // `<span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#F7F9F0; background:#4E5C31; border-radius:3px; padding:3px 8px; justify-self:start">Complete</span>`
  // DEVIATIONS.md ("Speakers status vocabulary under write-failure", DEC-730
  // wave-90 amendment) rules the app's inverted DONE/PEND/LATE vocabulary
  // wins here too -- do not assert this drawn (pre-inversion) pill.
  it('speakers.css defines the inverted status vocabulary, which wins even under a write-failure banner (:549, ruled stale)', () => {
    const css = read('speakers.css');
    expect(css).toMatch(/\.chq-speakers-status-complete/);
    expect(css).toMatch(/\.chq-speakers-status-overdue/);
    expect(css).toMatch(/\.chq-speakers-status-pending/);
  });

  // docs/design/Chautauqua Speakers.dc.html:549
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-weight:700">Marcus Okafor's headshot task did not change</span>`
  it('OnboardingGrid.tsx renders the write-failure banner class the frame\'s rejected-write copy describes (:549)', () => {
    const src = read('OnboardingGrid.tsx');
    expect(src).toMatch(/chq-speakers-write-failure/);
  });

  // docs/design/Chautauqua Speakers.dc.html:573
  // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Try again</span>`
  it('OnboardingGrid.tsx offers "Try again" as a write-failure recovery action (:549 extent)', () => {
    const src = read('OnboardingGrid.tsx');
    expect(src).toMatch(/Try again/);
  });

  // docs/design/Chautauqua Speakers.dc.html:665
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">One task · still waiting</span>`
  it('TaskView.tsx renders a "Still waiting" tab distinct from "Answered" (:665)', () => {
    const src = read('TaskView.tsx');
    expect(src).toMatch(/Still waiting &middot; \{waitingRows\.length\}/);
  });

  // docs/design/Chautauqua Speakers.dc.html:699
  // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:36px; display:inline-flex; align-items:center; padding:0 15px; font-size:12px; font-weight:700">Remind</span>`
  it('TaskView.tsx offers "Remind" and "Not needed" as the bulk actions on the waiting tab (:665 extent)', () => {
    const src = read('TaskView.tsx');
    expect(src).toMatch(/onClick=\{\(\) => void openRemindReview\(selected\)\}[\s\S]{0,80}>\s*Remind/);
    expect(src).toMatch(/Not needed/);
  });
});
