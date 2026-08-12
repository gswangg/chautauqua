// Minimal ambient typings for the `jsdom` package (no @types/jsdom on this
// stage's dependency tree, and published @types/jsdom is stale relative to
// jsdom v25's actual API, e.g. it lacks ResourceLoader). Only the surface
// test/embed-element.test.ts actually uses is declared here.
declare module "jsdom" {
  // This root tsconfig has no DOM lib (it's a Workers/server codebase), so
  // this shim deliberately types the jsdom window/document loosely rather
  // than re-declaring the DOM -- the test's own assertions still narrow
  // specific values (e.g. `iframe.style.height`) with explicit casts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type DOMWindow = any;

  export class JSDOM {
    constructor(html?: string, options?: Record<string, unknown>);
    window: DOMWindow;
  }

  export class VirtualConsole {
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export class ResourceLoader {
    fetch(url: string, options?: Record<string, unknown>): Promise<Buffer> | null;
  }
}
