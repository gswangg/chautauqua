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
// w64-a (DEC-958 amendment): planEditor-refusal-shapes.test.ts renders
// PlanEditor via React.createElement (no JSX, plain .test.ts name to mirror
// compose-refusal-shapes.test.ts) but still needs a real DOM/window for its
// render assertions, same treatment.
// w53-e (DEC-700 amendment): api-mutation-bump.scan.test.ts's behavioural
// half uses renderHook(useMutationVersion) to prove apiUpload's bump reaches
// a subscriber, which needs a real `document`, same treatment.
// w6-d: modal-frame-phone.test.ts renders ModalFrame via React.createElement
// (no JSX, plain .test.ts name to mirror planEditor-refusal-shapes.test.ts)
// but still needs a real DOM/window for its render assertions, same
// treatment.
// v12m-w7-e (DEC-919 amendment): submissions-landing-phone-frame.test.ts
// renders SubmissionsTable via React.createElement (no JSX, plain .test.ts
// name, same mirror as planEditor-refusal-shapes.test.ts) alongside its
// CSS-source-scan pins, and needs a real `window`/`document` for the render
// half's localStorage + testing-library assertions, same treatment.
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
      ["app/src/pages/review/planEditor-refusal-shapes.test.ts", "jsdom"],
      ["app/src/lib/api-mutation-bump.scan.test.ts", "jsdom"],
      ["app/src/components/modal-frame-phone.test.ts", "jsdom"],
      // w6-e (DEC-976 citation form): comms-drill-phone-frames.test.ts
      // renders TemplatesTab/HistoryTab via React.createElement (no JSX,
      // plain .test.ts name, same idiom as planEditor-refusal-shapes.test.ts
      // above) but still needs a real DOM/window for its render assertions.
      ["app/src/pages/comms/comms-drill-phone-frames.test.ts", "jsdom"],
      ["app/src/pages/submissions/submissions-landing-phone-frame.test.ts", "jsdom"],
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
