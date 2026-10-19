// Multi-portal decision 78: the DevFlow demo's duplicate items, folded into
// the item each one repeats. Three generations of demo data each made their
// own version of the same ask (the pre-portal seed, the judges' Aug 19 visit,
// the multi-portal demo); this keeps one of each and carries people's work
// onto it:
//
//   Upload your slide deck, Upload Session Presentation -> Final slides
//     (a deck lands on the Final slides row for the session the file
//     belongs to; the newest upload wins)
//   Finalize bio + headshot, Upload Final Headshot (print quality)
//     -> the built-in Bio and Headshot (their status is the profile's)
//   Travel form -> the Hotel and Flight forms, which now also sit in the
//     CFP and Invited speakers portals (scripts/portal-demo-lib.ts)
//
// Idempotent and scoped to the demo event by slug: once the duplicates are
// gone every statement matches nothing. It carries work only onto rows that
// already exist, so in a fresh seed (no portal rows yet) it simply removes
// the duplicates. Applied to production by scripts/demo-fold.ts and at the
// end of scripts/seed.ts.

import { DEMO_EVENT_SLUG } from "./portal-demo-lib";

const E = `(SELECT id FROM event WHERE slug = '${DEMO_EVENT_SLUG}')`;

const DECK_TASKS = ["Upload your slide deck", "Upload Session Presentation"];
const TRAVEL_FORMS = ["Hotel stay requirement form", "Flight reimbursement form"];
export const FOLDED_TITLES = [...DECK_TASKS, "Finalize bio + headshot", "Upload Final Headshot (print quality)", "Travel form"];

const list = (titles: string[]) => titles.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ");

// the newest deck this person uploaded for the session a Final slides row is about
function deckFor(column: string): string {
  return `(SELECT ${column} FROM task_assignment sa
    JOIN task st ON st.id = sa.task_id
    JOIN file f ON f.id = sa.file_id
    JOIN participant p ON p.submission_id = f.submission_id AND p.contact_id = sa.contact_id
    WHERE st.event_id = ${E} AND st.title IN (${list(DECK_TASKS)})
      AND sa.contact_id = task_assignment.contact_id AND task_assignment.scope_key = 'p:' || p.id
    ORDER BY f.created_at DESC, f.id DESC LIMIT 1)`;
}

export function demoFoldStatements(nowMs: number): string[] {
  const finalSlides = `(SELECT id FROM task WHERE event_id = ${E} AND title = 'Final slides')`;
  const folded = `(SELECT id FROM task WHERE event_id = ${E} AND title IN (${list(FOLDED_TITLES)}))`;
  const travelForms = `(SELECT id FROM task WHERE event_id = ${E} AND title IN (${list(TRAVEL_FORMS)}))`;
  return [
    // 1. decks onto their session's Final slides row
    `UPDATE task_assignment SET status = 'complete', file_id = ${deckFor("sa.file_id")}, completed_at = ${deckFor("coalesce(sa.completed_at, f.created_at)")}, completed_by = ${deckFor("sa.completed_by")}, updated_at = ${nowMs}
  WHERE task_id = ${finalSlides} AND file_id IS NULL AND status <> 'complete' AND ${deckFor("sa.id")} IS NOT NULL;`,
    // 2. the Hotel and Flight forms are portal items now: a hand-picked row
    // for someone a listing portal covers becomes that portal's row
    `UPDATE task SET audience = 'portal', updated_at = ${nowMs} WHERE id IN ${travelForms} AND audience <> 'portal';`,
    `UPDATE task_assignment SET source = 'portal', updated_at = ${nowMs}
  WHERE source = 'direct' AND scope_key = '' AND task_id IN ${travelForms}
    AND EXISTS (SELECT 1 FROM portal_item pi
      JOIN portal_membership pm ON pm.portal_id = pi.portal_id
      JOIN participant p ON pm.participation_key = 'p:' || p.id
      WHERE pi.task_id = task_assignment.task_id AND p.contact_id = task_assignment.contact_id);`,
    // 3. Invited speakers' order with the two forms where the Travel form was
    `UPDATE portal_item SET position = 4 WHERE id = 'demo_mp_item_inv_prep' AND position <> 4;`,
    `UPDATE portal_item SET position = 5 WHERE id = 'demo_mp_item_inv_slides' AND position <> 5;`,
    // 4. the duplicates themselves
    `DELETE FROM portal_item WHERE task_id IN ${folded};`,
    `DELETE FROM task_assignment WHERE task_id IN ${folded};`,
    `DELETE FROM task WHERE id IN ${folded};`,
  ];
}
