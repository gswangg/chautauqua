import { describe, expect, it } from 'vitest';
import { buildEmbedUrl, buildSnippet, EMBED_FIELDS, type EmbedField } from './embedSnippet';
import { ALL_CARD_FIELDS } from '../../lib/embed-fields';

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

  it('appends .xml as a path suffix, not a query param, for xml format (DEC-775)', () => {
    expect(buildEmbedUrl(ORIGIN, SLUG, 'agenda', { format: 'xml' })).toBe(
      `${ORIGIN}/embed/${SLUG}/agenda.xml`,
    );
  });

  it('routes ics to the fixed /e/:slug/agenda.ics path regardless of surface', () => {
    expect(buildEmbedUrl(ORIGIN, SLUG, 'schedule', { format: 'ics' })).toBe(
      `${ORIGIN}/e/${SLUG}/agenda.ics`,
    );
  });

  it('throws loudly on an unknown format', () => {
    expect(() => buildEmbedUrl(ORIGIN, SLUG, 'sessions', { format: 'yaml' as never })).toThrow(
      /Unknown embed format/,
    );
  });

  it('omits default knobs (full fields set, no track/day/q/limit/accent)', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', {
      format: 'iframe',
      fields: ['track', 'time', 'room', 'speaker', 'description', 'format'],
    });
    expect(url).toBe(`${ORIGIN}/embed/${SLUG}/sessions`);
  });

  it('omits fields when empty (absent-or-empty == all six per DEC-289/DEC-673)', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', { format: 'iframe', fields: [] });
    expect(url).toBe(`${ORIGIN}/embed/${SLUG}/sessions`);
  });

  it('serializes only the non-default knobs in the stable order trackId, day, q, limit, fields, accent (sessions honors all of them)', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', {
      format: 'json',
      accent: '#4f46e5',
      limit: 10,
      day: '2026-09-02',
      q: 'ai',
      trackId: 'trk1',
      fields: ['track', 'time'],
    });
    // DEC-634/DEC-673: sessions honors day and q too, so both appear, in the
    // stable order trackId, day, q, limit, fields, accent.
    expect(url).toBe(
      `${ORIGIN}/embed/${SLUG}/sessions.json?trackId=trk1&day=2026-09-02&q=ai&limit=10&fields=track%2Ctime&accent=4f46e5`,
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

// DEC-490/DEC-489: a surface's URL must never carry a knob the server
// doesn't honor for it, even when the caller passes every option.
describe('buildEmbedUrl knob table (DEC-489/DEC-490)', () => {
  const ALL_OPTS = {
    format: 'iframe' as const,
    trackId: 'trk1',
    day: '2026-09-02',
    q: 'ai',
    limit: 10,
    fields: ['speaker'] as EmbedField[],
    accent: '#4f46e5',
  };

  it('sessions honors trackId, day, q, limit, fields, accent (all of them)', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'sessions', ALL_OPTS);
    expect(url).toContain('trackId=trk1');
    expect(url).toContain('day=2026-09-02');
    expect(url).toContain('q=ai');
    expect(url).toContain('limit=10');
    expect(url).toContain('fields=speaker');
    expect(url).toContain('accent=4f46e5');
  });

  // DEC-990 (wave-67 amendment): speakers/gallery join trackId as a real
  // SQL-level predicate on getPublicSpeakers (mirrors dispatch.tsx's HTML
  // case, which has honored it since wave 64) — track is not sessions-only.
  it('speakers honors trackId, q, limit and accent, dropping day, fields', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'speakers', ALL_OPTS);
    expect(url).toContain('trackId=trk1');
    expect(url).toContain('q=ai');
    expect(url).toContain('limit=10');
    expect(url).toContain('accent=4f46e5');
    expect(url).not.toContain('day=');
    expect(url).not.toContain('fields=');
  });

  it('gallery honors trackId, q, limit and accent, dropping day, fields', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'gallery', ALL_OPTS);
    expect(url).toContain('trackId=trk1');
    expect(url).toContain('q=ai');
    expect(url).toContain('limit=10');
    expect(url).toContain('accent=4f46e5');
    expect(url).not.toContain('day=');
    expect(url).not.toContain('fields=');
  });

  // DEC-489 (wave-12 amendment): agenda/schedule honor trackId (a
  // render-level HIGHLIGHT per DEC-851, never a filter), day, q, accent —
  // no format (dispatch.tsx parses no `format` on these surfaces at all),
  // no roomId (the grid renders rooms as columns), no limit (dispatch.tsx
  // fetches no perPage for these surfaces) and no fields (no card-field
  // allowlist on a time grid).
  it('agenda honors trackId, day, q, accent, dropping format/roomId/limit/fields', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'agenda', ALL_OPTS);
    expect(url).toContain('trackId=trk1');
    expect(url).toContain('day=2026-09-02');
    expect(url).toContain('q=ai');
    expect(url).toContain('accent=4f46e5');
    expect(url).not.toContain('limit=');
    expect(url).not.toContain('fields=');
  });

  // DEC-851 (wave-55 amendment): schedule dropped trackId entirely -- no
  // reader honors it (ScheduleContent never read the highlight prop, the
  // .json/.xml feed twin never threaded it into getPublicAgenda).
  it('schedule honors day, q, accent only, dropping trackId/format/roomId/limit/fields', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'schedule', ALL_OPTS);
    expect(url).not.toContain('trackId=');
    expect(url).toContain('day=2026-09-02');
    expect(url).toContain('q=ai');
    expect(url).toContain('accent=4f46e5');
    expect(url).not.toContain('limit=');
    expect(url).not.toContain('fields=');
  });

  it('agenda/schedule never serialize the session-format knob (it is not an agenda facet at all)', () => {
    const opts = { ...ALL_OPTS, sessionFormat: 'talk' };
    expect(buildEmbedUrl(ORIGIN, SLUG, 'agenda', opts)).not.toContain('format=talk');
    expect(buildEmbedUrl(ORIGIN, SLUG, 'schedule', opts)).not.toContain('format=talk');
  });

  it('ics drops every knob, including accent', () => {
    const url = buildEmbedUrl(ORIGIN, SLUG, 'schedule', { ...ALL_OPTS, format: 'ics' });
    expect(url).toBe(`${ORIGIN}/e/${SLUG}/agenda.ics`);
  });
});

// DEC-673: EMBED_FIELDS is derived from the server's own card-field
// vocabulary, not hand-copied — a copy that can drift must be pinned by a
// test that compares it to its source.
describe('EMBED_FIELDS (DEC-673 subset-vocabulary pin)', () => {
  it('equals the server card-field vocabulary', () => {
    expect([...EMBED_FIELDS].sort()).toEqual([...ALL_CARD_FIELDS].sort());
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

  it('returns the bare url for xml format (DEC-775)', () => {
    expect(buildSnippet(`${url}.xml`, 'sessions', 'xml')).toBe(`${url}.xml`);
  });

  it('returns the bare url for ics format', () => {
    const icsUrl = `${ORIGIN}/e/${SLUG}/agenda.ics`;
    expect(buildSnippet(icsUrl, 'agenda', 'ics')).toBe(icsUrl);
  });

  it('throws loudly on an unknown format', () => {
    expect(() => buildSnippet(url, 'sessions', 'yaml' as never)).toThrow(/Unknown embed format/);
  });
});
