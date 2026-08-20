// DEC-373: co-located SSR surface stylesheet for the public event family
// (sessions/speakers/agenda/schedule/gallery + drill-in detail pages).
// Tokens live only in THEME_CSS (src/views/theme.ts) -- this file only adds
// .chq-pub-* component classes layered on top of the shared reset/tokens.
//
// PUBLIC_CSS is a fixed, value-free module constant (DEC-374) -- never
// interpolated with request/user data. BaseStyles (shell.tsx) inlines it via
// `<style dangerouslySetInnerHTML={{ __html: PUBLIC_CSS }} />`, exactly like
// ThemeStyles() inlines THEME_CSS, so hono/jsx never HTML-escapes it (no
// stray &#39;/&quot;/&gt; entities in the rendered <style> text).
//
// STRUCTURE (contention decomposition, wave 68): this file used to carry
// all 920 lines of CSS text inline and was a standing merge-conflict
// hotspot -- every lane adding a public-surface rule touched the same
// giant template literal. The CSS text now lives in cohesive fragments
// under ./css/ (chrome.css.ts/cards.css.ts/agenda.css.ts/rail.css.ts, plus
// the shared ACCENT_BOUND_CLASSES array in ./css/accent-classes.ts),
// concatenated back into PUBLIC_CSS below in their original order --
// PUBLIC_CSS's runtime value, and every existing import of
// PUBLIC_CSS/ACCENT_BOUND_CLASSES from "./public.css", are unchanged.
// Mirrors the src/decisions.ts barrel + src/decisions-data/part*.ts split
// already established in this codebase for the same reason. The four
// css/*.css.ts fragments are themselves independent SSR stylesheet modules
// (test/ssr-css-contract.scan.test.ts enumerates every *.css.ts file), so
// each is checked for dead rules/undeclared tokens on its own in addition
// to as part of the composed PUBLIC_CSS below.

import { DEC_367, DEC_373, DEC_374, DEC_838, DEC_851 } from "../../decisions";
import { ACCENT_BOUND_CLASSES } from "./css/accent-classes";
import { CHROME_CSS, CHROME_PHONE_CSS } from "./css/chrome.css";
import { CARDS_CSS, CARDS_PHONE_CSS } from "./css/cards.css";
import { AGENDA_CSS, AGENDA_PHONE_CSS } from "./css/agenda.css";
import { RAIL_CSS, RAIL_PHONE_CSS } from "./css/rail.css";
import { EMPTY_CSS, EMPTY_PHONE_CSS } from "./css/empty.css";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_838;
void DEC_851;

export { ACCENT_BOUND_CLASSES };

// DEC-385 wave-143 amendment (task w18-f): each of the five fragments above
// used to carry its OWN terminal @media (max-width: 700px) block, which
// made every fragment but the last (EMPTY_CSS) non-terminal in the
// composed PUBLIC_CSS output -- see docs/design/audit/
// terminal-phone-block-v12.md and test/phone-terminal-block.scan.test.ts
// (which grades composed output, not each fragment's own on-disk text).
// Every fragment's phone block is now its own *_PHONE_CSS export
// (mirroring src/views/error-states.css.ts's ERROR_STATES_CSS/
// ERROR_STATES_PHONE_CSS split, task w16-bb) and all five are concatenated
// here, in the SAME ascending order the fragments themselves compose in
// above, so the trailing region is contiguous and nothing is reordered or
// reworded.
export const PUBLIC_CSS = `${CHROME_CSS}${CARDS_CSS}${AGENDA_CSS}${RAIL_CSS}${EMPTY_CSS}${CHROME_PHONE_CSS}${CARDS_PHONE_CSS}${AGENDA_PHONE_CSS}${RAIL_PHONE_CSS}${EMPTY_PHONE_CSS}`;
