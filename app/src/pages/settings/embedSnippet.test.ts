import { describe, expect, it } from 'vitest';
import { buildEmbedUrl, buildSnippet } from './embedSnippet';

const ORIGIN = 'https://example.org';
const SLUG = 'devcon-2026';

describe('buildEmbedUrl', () => {
  it('builds the bare surface path for iframe with no options', () => {
    expect(buildEmbedUrl(ORIGIN, SLUG, 'sessions', { format: 'iframe' })).toBe(
      `${ORIGIN}/embed/${SLUG}/sessions`,
    );
  });

  it('builds the same bare path for link format', () => {
    expect(buildEmbedUrl(ORIGIN, SLUG, 'speakers', { format: 'link' })).toBe(
      `${ORIGIN}/embed/${SLUG}/speakers`,
    );
  });

  it('appends .json as a path suffix, not a query param, for json format', () => {
    expect(buildEmbedUrl(ORIGIN, SLUG, 'agenda', { format: 'json' })).toBe(
      `${ORIGIN}/embed/${SLUG}/agenda.json`,
    );
  });

  it('routes ics to the fixed /e/:slug/agenda.ics path regardless of surface', () => {
    expect(buildEmbedUrl(ORIGIN, SLUG, 'schedule', { format: 'ics' })).toBe(
      `${ORIGIN}/e/${SLUG}/agenda.ics`,
    );
  });

  it('throws loudly on an unknown format', () => {
    expect(() => buildEmbedUrl(ORIGIN, SLUG, 'sessions', { format: 'xml' as never })).toThrow(
      /Unknown embed format/,
    );
  });

  it('omits default knobs (full fields set, no track/day/limit/accent)', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', {
      format: 'iframe',
      fields: ['track', 'time', 'room', 'speaker', 'description'],
    });
    expect(url).toBe(`${ORIGIN}/embed/${SLUG}/sessions`);
  });

  it('omits fields when empty (absent-or-empty == all five per DEC-289)', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', { format: 'iframe', fields: [] });
    expect(url).toBe(`${ORIGIN}/embed/${SLUG}/sessions`);
  });

  it('serializes only the non-default knobs in the stable order trackId, day, limit, fields, accent', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'agenda', {
      format: 'json',
      accent: '#4f46e5',
      limit: 10,
      day: '2026-09-02',
      trackId: 'trk1',
      fields: ['track', 'time'],
    });
    expect(url).toBe(
      `${ORIGIN}/embed/${SLUG}/agenda.json?trackId=trk1&day=2026-09-02&limit=10&fields=track%2Ctime&accent=4f46e5`,
    );
  });

  it('strips a leading # from accent before serializing', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', { format: 'iframe', accent: '#abc' });
    expect(url).toContain('accent=abc');
    expect(url).not.toContain('%23');
  });

  it('serializes a partial field subset', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', { format: 'iframe', fields: ['speaker'] });
    expect(url).toBe(`${ORIGIN}/embed/${SLUG}/sessions?fields=speaker`);
  });
});

describe('buildSnippet', () => {
  const url = `${ORIGIN}/embed/${SLUG}/sessions`;

  it('builds an <iframe> tag with style/loading/title attributes for iframe format', () => {
    const snippet = buildSnippet(url, 'sessions', 'iframe');
    expect(snippet).toBe(
      `<iframe src="${url}" style="width:100%;min-height:600px;border:0" loading="lazy" title="sessions"></iframe>`,
    );
  });

  it('builds an <a> tag for link format', () => {
    expect(buildSnippet(url, 'sessions', 'link')).toBe(`<a href="${url}">sessions</a>`);
  });

  it('returns the bare url for json format', () => {
    expect(buildSnippet(`${url}.json`, 'sessions', 'json')).toBe(`${url}.json`);
  });

  it('returns the bare url for ics format', () => {
    const icsUrl = `${ORIGIN}/e/${SLUG}/agenda.ics`;
    expect(buildSnippet(icsUrl, 'agenda', 'ics')).toBe(icsUrl);
  });

  it('throws loudly on an unknown format', () => {
    expect(() => buildSnippet(url, 'sessions', 'xml' as never)).toThrow(/Unknown embed format/);
  });
});
