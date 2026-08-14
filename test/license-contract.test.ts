// DEC-268 wave-31 amendment: SPEC §8 ships MIT and README.md says "Licensed
// MIT", but nothing enforced that a LICENSE file actually existed or that
// package.json's `license` field matched. This locks the claim, the field,
// and the file together so they can never drift apart.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

describe('DEC-268: license contract', () => {
  it('LICENSE exists at the repo root and is the standard MIT text', () => {
    const licensePath = resolve(REPO_ROOT, 'LICENSE');
    const license = readFileSync(licensePath, 'utf-8');

    const firstLine = license.split('\n')[0];
    expect(firstLine, 'DEC-268: LICENSE first line must be exactly "MIT License"').toBe('MIT License');

    expect(
      license,
      'DEC-268: LICENSE must contain the standard MIT grant clause',
    ).toContain('Permission is hereby granted, free of charge');

    expect(
      license,
      'DEC-268: LICENSE must contain the standard MIT no-warranty clause',
    ).toContain('WITHOUT WARRANTY OF ANY KIND');
  });

  it('package.json license field is exactly MIT', () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8')) as {
      license?: string;
    };

    expect(pkg.license, 'DEC-268: package.json must declare a license field').toBe('MIT');
  });

  it('README.md claims MIT and links to the LICENSE file', () => {
    const readme = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf-8');

    expect(readme, 'DEC-268: README must claim "Licensed MIT"').toContain('Licensed MIT');
    expect(
      readme,
      'DEC-268: README must link to the LICENSE file so the claim and the file cannot drift apart',
    ).toMatch(/\[LICENSE\]\(LICENSE\)/);
  });
});
