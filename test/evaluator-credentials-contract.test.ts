// DEC-513: contract-test README's evaluator credentials against the vendored
// fixture (docs/fixtures/sample-data.json), which is the authoritative source
// (seeded verbatim by scripts/seed.ts). README hard-codes the same facts in
// two markdown tables — the "Live demo" summary table and the "For
// evaluators" persona table — with nothing tying them to the fixture, so a
// stale README can hand a judge a password that fails at the login form.
//
// docs/ is vendored source and the fixture is authoritative: if this test
// finds drift, fix README.md, never docs/fixtures/sample-data.json or
// scripts/seed.ts.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

const readme = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf-8');
const fixture = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'docs/fixtures/sample-data.json'), 'utf-8'),
) as {
  event: { name: string };
  identities: Record<string, { name: string; email: string; password: string }>;
};

const EMAIL_RE = /^[^\s@`]+@[^\s@`]+\.[^\s@`]+$/;

interface CredRow {
  label: string;
  email: string;
  password: string;
  line: string;
}

/**
 * Parse the markdown table starting at `headerIdx` (a line matching a
 * `| ... |` header row) into credential rows. Cells are matched by CONTENT,
 * not column position: a backticked cell shaped like an email is the email,
 * a backticked cell that isn't an email and isn't a route (doesn't start
 * with `/`) is the password. This survives a column reorder or an added
 * column.
 */
function parseCredTable(lines: string[], headerIdx: number): CredRow[] {
  const rows: CredRow[] = [];
  // Data rows start two lines after the header (the line immediately after
  // the header is the `|---|---|` separator row).
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || !line.trim().startsWith('|')) break;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length === 0 || cells[0] === undefined) break;

    const label = cells[0].replace(/`/g, '');
    const backticked = [...line.matchAll(/`([^`]+)`/g)]
      .map((m) => m[1])
      .filter((c): c is string => c !== undefined);
    const email = backticked.find((c) => EMAIL_RE.test(c));
    const password = backticked.find(
      (c) => c !== email && !EMAIL_RE.test(c) && !c.startsWith('/'),
    );

    if (!email || !password) {
      throw new Error(
        `DEC-513: README credential row for "${label}" is missing a parseable email/password cell pair: ${line}`,
      );
    }

    rows.push({ label, email, password, line });
  }
  return rows;
}

function findCredTableHeaderIndex(lines: string[], mustContainTokens: string[]): number {
  const idx = lines.findIndex((l) => {
    if (!l.trim().startsWith('|')) return false;
    return mustContainTokens.every((token) => l.toLowerCase().includes(token.toLowerCase()));
  });
  if (idx === -1) {
    throw new Error(
      `DEC-513: README.md is missing the expected credential table header containing [${mustContainTokens.join(', ')}]`,
    );
  }
  return idx;
}

const lines = readme.split('\n');

describe('DEC-513: README evaluator credentials match docs/fixtures/sample-data.json', () => {
  const summaryHeaderIdx = findCredTableHeaderIndex(lines, ['Role', 'Email', 'Password']);
  const evaluatorsHeaderIdx = findCredTableHeaderIndex(lines, ['Persona', 'Email', 'Password']);

  const summaryRows = parseCredTable(lines, summaryHeaderIdx);
  const evaluatorRows = parseCredTable(lines, evaluatorsHeaderIdx);

  const fixtureIdentities = Object.entries(fixture.identities).map(([key, identity]) => ({
    key,
    email: identity.email,
    password: identity.password,
  }));

  it('the fixture actually has identities to check against (sanity)', () => {
    expect(fixtureIdentities.length).toBeGreaterThan(0);
  });

  it("every fixture identity is documented in the 'For evaluators' table with an exactly matching password", () => {
    for (const identity of fixtureIdentities) {
      const row = evaluatorRows.find((r) => r.email === identity.email);
      expect(
        row,
        `DEC-513: fixture identity "${identity.key}" (${identity.email}) is not documented in README's 'For evaluators' persona table`,
      ).toBeDefined();
      expect(
        row!.password,
        `DEC-513: README 'For evaluators' password for "${identity.key}" (${identity.email}) is "${row!.password}" but the fixture password is "${identity.password}"`,
      ).toBe(identity.password);
    }
  });

  it("the 'For evaluators' table is EXACTLY equal to the fixture identities (no ghost accounts, none undocumented)", () => {
    expect(
      evaluatorRows.length,
      `DEC-513: README 'For evaluators' table has ${evaluatorRows.length} rows but the fixture has ${fixtureIdentities.length} identities`,
    ).toBe(fixtureIdentities.length);

    for (const row of evaluatorRows) {
      const identity = fixtureIdentities.find((i) => i.email === row.email);
      expect(
        identity,
        `DEC-513: README 'For evaluators' table documents "${row.label}" (${row.email}), which does not exist in docs/fixtures/sample-data.json identities`,
      ).toBeDefined();
      expect(row.password).toBe(identity!.password);
    }
  });

  it("the 'Live demo' summary table is a SUBSET of the fixture identities with matching passwords", () => {
    for (const row of summaryRows) {
      const identity = fixtureIdentities.find((i) => i.email === row.email);
      expect(
        identity,
        `DEC-513: README summary table documents "${row.label}" (${row.email}), which does not exist in docs/fixtures/sample-data.json identities`,
      ).toBeDefined();
      expect(
        row.password,
        `DEC-513: README summary table password for "${row.label}" (${row.email}) is "${row.password}" but the fixture password is "${identity!.password}"`,
      ).toBe(identity!.password);
    }
  });

  it('every email/password pair in either README table exists in the fixture with the same password (no ghost accounts)', () => {
    for (const row of [...summaryRows, ...evaluatorRows]) {
      const identity = fixtureIdentities.find((i) => i.email === row.email);
      expect(
        identity,
        `DEC-513: README documents an email/password pair for "${row.label}" (${row.email}) with no matching identity in docs/fixtures/sample-data.json`,
      ).toBeDefined();
      expect(
        row.password,
        `DEC-513: README password for "${row.label}" (${row.email}) is "${row.password}" but the fixture password is "${identity!.password}"`,
      ).toBe(identity!.password);
    }
  });

  it("README's /e/<slug> public-surface URL references match the fixture's derived event slug", () => {
    const expectedSlug = fixture.event.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const slugMatches = [...readme.matchAll(/\/e\/([a-z0-9-]+)\//g)]
      .map((m) => m[1])
      .filter((s): s is string => s !== undefined);
    expect(
      slugMatches.length,
      'DEC-513: README has no /e/<slug>/ public-surface URL references to check against the fixture',
    ).toBeGreaterThan(0);

    const distinctSlugs = [...new Set(slugMatches)];
    expect(
      distinctSlugs,
      `DEC-513: README's /e/<slug> references are inconsistent or drifted from the fixture's derived event slug "${expectedSlug}" (found: ${JSON.stringify(distinctSlugs)})`,
    ).toEqual([expectedSlug]);
  });
});
