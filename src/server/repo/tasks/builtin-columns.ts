// Decision 75: the Speakers grid's built-in profile columns. Bio and Headshot
// are portal items with no task row behind them -- the portal home works
// out whether each is done from the person's profile
// (src/server/repo/portals/view.ts) -- so the grid adds them the same way:
// a column for each built-in a portal in scope lists, a cell for each person
// that portal covers, Complete when the profile has it and Pending when it
// doesn't. The cells are read-only (done means the profile has it); the
// task-assignment filters (a task, a status, overdue only) don't reach them.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { SYSTEM_ITEM_LABELS } from "../../../domain/portals/items";
import { rosterParticipantConditions } from "./crud";
import { participantInPortal } from "./portal-scope";
import type { GridCell, GridTask, OnboardingGrid } from "./grid";

export const BUILT_IN_COLUMN_KINDS = ["bio", "headshot"] as const;
export type BuiltInColumnKind = (typeof BUILT_IN_COLUMN_KINDS)[number];

/** The grid task id a built-in column carries -- never a real task id. */
export function builtInColumnId(kind: BuiltInColumnKind): string {
  return `built-in:${kind}`;
}

/** A contact (joined as `contact`) a portal in scope gives this built-in. */
function builtInApplies(eventId: string, kind: BuiltInColumnKind, portalId: string | null) {
  const onePortal = portalId ? sql` and ${schema.portalMembership.portalId} = ${portalId}` : sql``;
  return sql`exists (select 1 from ${schema.portalMembership} inner join ${schema.portalItem} on ${schema.portalItem.portalId} = ${schema.portalMembership.portalId} where ${schema.portalMembership.contactId} = ${schema.contact.id} and ${schema.portalMembership.eventId} = ${eventId} and ${schema.portalItem.systemKind} = ${kind}${onePortal})`;
}

function builtInDone(kind: BuiltInColumnKind) {
  return kind === "bio"
    ? sql`trim(coalesce(${schema.contact.bio}, '')) <> ''`
    : sql`(coalesce(${schema.contact.headshotUrl}, '') <> '' or ${schema.contact.headshotFileId} is not null)`;
}

export async function withBuiltInColumns(
  db: Db,
  eventId: string,
  grid: OnboardingGrid,
  scope: { portalId: string | null; direct: boolean },
): Promise<OnboardingGrid> {
  if (scope.direct) return grid;
  const items = await db
    .select({ kind: schema.portalItem.systemKind, required: schema.portalItem.required })
    .from(schema.portalItem)
    .innerJoin(schema.portal, eq(schema.portal.id, schema.portalItem.portalId))
    .where(
      and(
        eq(schema.portal.eventId, eventId),
        inArray(schema.portalItem.systemKind, [...BUILT_IN_COLUMN_KINDS]),
        scope.portalId ? eq(schema.portalItem.portalId, scope.portalId) : undefined,
      ),
    );
  const kinds = BUILT_IN_COLUMN_KINDS.filter((k) => items.some((i) => i.kind === k));
  if (kinds.length === 0) return grid;

  const applies = (k: BuiltInColumnKind) => builtInApplies(eventId, k, scope.portalId);

  // column heads: "N of M done" over the whole roster in scope, never the
  // filtered page (the same rule the task columns follow)
  const [totals] = await db
    .select({
      bioAssigned: sql<number>`count(distinct case when ${applies("bio")} then ${schema.contact.id} end)`,
      bioComplete: sql<number>`count(distinct case when ${applies("bio")} and ${builtInDone("bio")} then ${schema.contact.id} end)`,
      headshotAssigned: sql<number>`count(distinct case when ${applies("headshot")} then ${schema.contact.id} end)`,
      headshotComplete: sql<number>`count(distinct case when ${applies("headshot")} and ${builtInDone("headshot")} then ${schema.contact.id} end)`,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
    .where(and(rosterParticipantConditions(eventId), scope.portalId ? participantInPortal(scope.portalId) : undefined));
  const assigned = (k: BuiltInColumnKind) => Number((k === "bio" ? totals?.bioAssigned : totals?.headshotAssigned) ?? 0);
  const complete = (k: BuiltInColumnKind) => Number((k === "bio" ? totals?.bioComplete : totals?.headshotComplete) ?? 0);

  const columns: GridTask[] = kinds.map((k) => ({
    id: builtInColumnId(k),
    kind: "built_in",
    title: SYSTEM_ITEM_LABELS[k],
    dueDate: null,
    required: items.some((i) => i.kind === k && i.required),
    instructions: null,
    assigned: assigned(k),
    complete: complete(k),
  }));

  // cells for exactly the page's people
  const pageIds = grid.rows.map((r) => r.contact.id);
  const cellsByContact = new Map<string, GridCell[]>();
  for (const batch of chunkIds(pageIds)) {
    const rows = await db
      .select({
        id: schema.contact.id,
        bioApplies: sql<number>`case when ${applies("bio")} then 1 else 0 end`,
        bioDone: sql<number>`case when ${builtInDone("bio")} then 1 else 0 end`,
        headshotApplies: sql<number>`case when ${applies("headshot")} then 1 else 0 end`,
        headshotDone: sql<number>`case when ${builtInDone("headshot")} then 1 else 0 end`,
      })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const row of rows) {
      const cells: GridCell[] = [];
      for (const k of kinds) {
        const appliesHere = Number(k === "bio" ? row.bioApplies : row.headshotApplies) === 1;
        if (!appliesHere) continue;
        const done = Number(k === "bio" ? row.bioDone : row.headshotDone) === 1;
        cells.push({
          taskId: builtInColumnId(k),
          assignmentId: "",
          status: done ? "complete" : "pending",
          completedAt: null,
          fileId: null,
          fileName: null,
          assignedAt: 0,
        });
      }
      cellsByContact.set(row.id, cells);
    }
  }

  return {
    ...grid,
    // the profile comes first, as it does on the participant's home
    tasks: [...columns, ...grid.tasks],
    rows: grid.rows.map((r) => ({ ...r, cells: [...(cellsByContact.get(r.contact.id) ?? []), ...r.cells] })),
  };
}
