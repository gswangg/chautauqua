// J6 onboarding tasks repo (DEC-023): barrel re-export over the tasks/
// submodules (ownership, response-detail, grid, crud, reminders). Repo
// functions are the only code touching drizzle row types (DEC-012);
// handlers in src/routes/tasks.ts stay thin. Decomposed from a single
// 800+ line file to reduce merge contention; behavior and public import
// paths (`repo/tasks`) are unchanged -- callers should not need to change
// their imports.

export * from "./tasks/ownership";
export * from "./tasks/response-detail";
export * from "./tasks/grid";
export * from "./tasks/crud";
export * from "./tasks/reminders";
export * from "./tasks/speaker-detail";
export * from "./tasks/task-view";
