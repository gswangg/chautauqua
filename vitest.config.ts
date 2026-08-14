import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// DEC-144 layer-2 harness: component-render smoke tests. Files matching
// app/src/**/*.render.test.tsx run under jsdom (real DOM, testing-library);
// every other existing test keeps the default "node" environment untouched.
// DEC-378: useEscapeKey.test.ts also needs a real `window` (renderHook +
// dispatchEvent), so it gets the same jsdom treatment despite its plain
// .test.ts name.
// w6-a/w16-d: useNavExceptions.test.tsx needs the same (renderHook +
// window.fetch stubbing + localStorage + MemoryRouter/JSX), so it moved to
// a .test.tsx name (DEC-700).
// w29-e (DEC-969): useMenu.test.tsx needs the same (render + fireEvent +
// pointerdown/keydown against document, JSX harness), same treatment.
// w19-a (DEC-024 amendment): api.unauthorized.render.test.ts needs a real
// `window.location` to stub/assert against despite its plain .test.ts name
// (no JSX in this one, just window stubbing), same treatment.
export default defineConfig({
  plugins: [react()],
  test: {
    // DEC-797: harness-level DOM cleanup between render tests -- see
    // app/src/test-setup.ts. Guarded so node-environment suites (which must
    // never import testing-library) are unaffected.
    setupFiles: ["app/src/test-setup.ts"],
    // Machine-protection caps (mandate item 72/73): the full suite spawned 6+
    // multi-GB workers and swamped the 16GB host twice. maxWorkers alone does
    // not bind the forks pool (vitest's default pool) -- poolOptions.forks
    // and poolOptions.threads must be capped explicitly too, or a run that
    // falls back to threads/forks ignores the top-level maxWorkers.
    maxWorkers: 2,
    minWorkers: 1,
    poolOptions: {
      forks: { maxForks: 2 },
      threads: { maxThreads: 2 },
    },
    environment: "node",
    environmentMatchGlobs: [
      ["app/src/**/*.render.test.tsx", "jsdom"],
      ["app/src/lib/useEscapeKey.test.ts", "jsdom"],
      ["app/src/lib/useNavExceptions.test.tsx", "jsdom"],
      ["app/src/lib/useMenu.test.tsx", "jsdom"],
      ["app/src/lib/api.unauthorized.render.test.ts", "jsdom"],
    ],
    include: [
      "test/**/*.test.ts",
      "app/src/**/*.test.ts",
      "app/src/**/*.render.test.tsx",
      "app/src/lib/useNavExceptions.test.tsx",
      "app/src/lib/useMenu.test.tsx",
    ],
  },
});
