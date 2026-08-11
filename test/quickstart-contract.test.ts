// DEC-268 regression lock: the documented zero-setup paths (`npm run dev` and
// `npm run gate:render-sweep`) must generate the admin SPA bundle themselves,
// so a fresh clone's /admin route works without a prior manual `npm run
// build`. This asserts the wiring rather than the runtime behavior (which is
// covered by render-sweep itself).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

describe('DEC-268: quickstart contract', () => {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8')) as {
    scripts: Record<string, string>;
  };

  it('predev builds the admin SPA bundle via vite (DEC-268)', () => {
    const predev = pkg.scripts.predev;
    expect(predev, 'DEC-268: package.json scripts.predev must exist').toBeDefined();
    expect(predev, 'DEC-268: predev must still run ensure-dev-vars').toContain('ensure-dev-vars');
    expect(predev, 'DEC-268: predev must run a vite build so /admin works on a fresh clone').toContain(
      'vite build',
    );
    expect(predev, 'DEC-268: predev must build the admin app config').toContain('app/vite.config.ts');
  });

  it('render-sweep builds the SPA bundle before starting wrangler dev (DEC-268)', () => {
    const sweep = readFileSync(resolve(REPO_ROOT, 'scripts/render-sweep.ts'), 'utf-8');
    const buildIdx = sweep.indexOf('vite');
    expect(buildIdx, 'DEC-268: render-sweep.ts must invoke a vite build').toBeGreaterThan(-1);
    expect(sweep.slice(buildIdx, buildIdx + 200), 'DEC-268: render-sweep vite invocation must build app/vite.config.ts').toContain(
      'app/vite.config.ts',
    );

    const wranglerDevIdx = sweep.indexOf('spawn("npx", ["wrangler", "dev"');
    expect(
      wranglerDevIdx,
      'DEC-268: render-sweep.ts must spawn wrangler dev',
    ).toBeGreaterThan(-1);

    expect(
      buildIdx,
      'DEC-268: render-sweep must build the SPA bundle BEFORE spawning wrangler dev, or a fresh worktree serves a stale/missing admin bundle',
    ).toBeLessThan(wranglerDevIdx);
  });

  it('every `npm run <script>` command in the README Quickstart block names a real package.json script', () => {
    const readme = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf-8');
    const quickstartMatch = readme.match(/## Quickstart[\s\S]*?```sh\n([\s\S]*?)```/);
    expect(quickstartMatch, 'DEC-268: README Quickstart fenced sh block must exist').not.toBeNull();

    const block = quickstartMatch![1]!;
    const npmRunCommands = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('npm run '));

    expect(npmRunCommands.length, 'DEC-268: expected at least one npm run command in Quickstart').toBeGreaterThan(0);

    for (const line of npmRunCommands) {
      const scriptName = line.replace('npm run ', '').trim();
      expect(
        pkg.scripts[scriptName],
        `DEC-268: README Quickstart references npm run ${scriptName}, which is not in package.json scripts`,
      ).toBeDefined();
    }
  });
});
