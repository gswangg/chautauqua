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
import { CHROME_CSS } from "./css/chrome.css";
import { CARDS_CSS } from "./css/cards.css";
import { AGENDA_CSS } from "./css/agenda.css";
import { RAIL_CSS } from "./css/rail.css";
import { EMPTY_CSS } from "./css/empty.css";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_838;
void DEC_851;

export { ACCENT_BOUND_CLASSES };

export const PUBLIC_CSS = `${CHROME_CSS}${CARDS_CSS}${AGENDA_CSS}${RAIL_CSS}${EMPTY_CSS}`;
