import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// DEC-144 layer-2 harness: component-render smoke tests. Files matching
// app/src/**/*.render.test.tsx run under jsdom (real DOM, testing-library);
// every other existing test keeps the default "node" environment untouched.
// DEC-378: useEscapeKey.test.ts also needs a real `window` (renderHook +
// dispatchEvent), so it gets the same jsdom treatment despite its plain
// .test.ts name.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["app/src/**/*.render.test.tsx", "jsdom"],
      ["app/src/lib/useEscapeKey.test.ts", "jsdom"],
    ],
    include: ["test/**/*.test.ts", "app/src/**/*.test.ts", "app/src/**/*.render.test.tsx"],
  },
});
