// DEC-797: test isolation is a harness guarantee, not a per-file habit.
// Without a global setup file, DOM cleanup between render tests depended on
// each *.render.test.tsx file remembering its own `afterEach(cleanup)` --
// a habit that a single forgetful neighbour file breaks for the whole
// jsdom-environment run. This file registers that cleanup once, globally,
// for every DOM-environment suite. Node-environment suites (the majority of
// the tree) must never import "@testing-library/react" -- jsdom-only APIs
// like `document` don't exist there -- so the import is guarded behind a
// `typeof document !== 'undefined'` check and only runs for suites vitest
// has already put in the jsdom environment (see environmentMatchGlobs in
// vitest.config.ts / vitest.fast.config.ts).
//
// Deliberately does NOT enable restoreMocks/clearMocks here: several
// existing suites manage their own mock lifecycle (module-level vi.mock
// state that must survive across tests within a file) and a global reset
// would break them.
if (typeof document !== "undefined") {
  const { afterEach } = await import("vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}

export {};
