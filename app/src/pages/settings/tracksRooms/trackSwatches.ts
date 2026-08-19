import { DEC_888 } from '../../../../../src/decisions';

// DEC-888: ONE enumeration supplies the swatch picker buttons, the new-
// track default (its first entry), and the .chq-color-swatch preview --
// so the palette a track can be given and the palette the picker offers
// can never desync. Colors drawn from the product palette, never an
// off-palette literal like the old raw <input type="color"> default.
// USER-FILED + frame 09--12 (v12): the redesigned track palette is the
// SYSTEM'S OWN tokens used categorically — the frame's three drawn swatches
// pixel-sample to exactly #4E5C31 / #1B1D17 / #8E8A7A (README §Colour rows
// Brand olive / Ink / the stone grey); two more README tokens extend the set
// for events with more tracks. Never a Tailwind stock colour, never a red.
export const TRACK_SWATCHES = [
  { value: '#4E5C31', label: 'Olive' },
  { value: '#1B1D17', label: 'Ink' },
  { value: '#8E8A7A', label: 'Stone' },
  { value: '#565A4B', label: 'Moss' },
  { value: '#BAB6A6', label: 'Sand' },
] as const;
void DEC_888;

// Cycle helpers for the swatch-as-control (frame 09--12): advance to the
// next palette entry; an unknown stored colour re-enters the palette at
// its first entry rather than throwing — the next save then persists a
// palette member.
export function nextSwatch(current: string): string {
  const i = TRACK_SWATCHES.findIndex((s) => s.value === current);
  return TRACK_SWATCHES[(i + 1) % TRACK_SWATCHES.length]!.value;
}

export function swatchLabel(current: string): string {
  return TRACK_SWATCHES.find((s) => s.value === current)?.label ?? 'Custom';
}
