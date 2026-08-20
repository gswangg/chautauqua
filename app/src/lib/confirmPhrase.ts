// DEC-941: the ONE comparator for a typed-phrase arming gate -- trim +
// case-insensitive equality. ConfirmDialog.tsx's irreversible weight used
// this rule inline; DeleteSubmissionsPage.tsx's own footer arming field
// (wave 134 amendment) reuses it verbatim rather than inventing a second
// rule for the same guarantee (DEC-613: a second copy of a vocabulary is a
// trap with a delay fuse).
export function confirmPhraseMatches(typed: string, phrase: string): boolean {
  return typed.trim().toLowerCase() === phrase.trim().toLowerCase();
}
