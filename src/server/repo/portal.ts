// Speaker portal repo — barrel re-export.
//
// This module used to hold every /portal repo function in one 848-line file
// (a merge-conflict hotspot). It's now decomposed into cohesive submodules
// under ./portal/ — this file exists only so every existing call site
// (`import { ... } from "../../server/repo/portal"`) keeps working unchanged.
// No behavior lives here; add new portal reads/writes to the appropriate
// submodule, not to this barrel.
//
//   portal/shared.ts      — pure status/ownership helpers (no IO)
//   portal/data.ts        — /portal shell data + submission detail
//   portal/tasks.ts       — task_assignment reads/writes + DEC-240 linkage
//   portal/invitations.ts — invite accept/decline
//   portal/sessions.ts    — scheduled sessions + latest deliverable
//   portal/resources.ts   — event resources + download authz
//   portal/submissions.ts — DEC-729: every submission the speaker owns
//
// See DEC-005 (/portal SSR), DEC-012 (repo layer owns drizzle row types),
// DEC-016 (locked fields live on submission/contact columns).
import { DEC_699, DEC_729 } from "../../decisions";
void DEC_699;
void DEC_729;

export * from "./portal/shared";
export * from "./portal/data";
export * from "./portal/tasks";
export * from "./portal/invitations";
export * from "./portal/sessions";
export * from "./portal/resources";
export * from "./portal/submissions";
