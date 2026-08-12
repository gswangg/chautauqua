// DEC-607 (EMB-8/EMB-15): one clipboard helper that cannot fail silently.
// The Clipboard API write is a genuine outside-world boundary (permissions,
// browser support, insecure context) — this is the ONE place that boundary
// is crossed. Every call site must surface the boolean result to the user
// via a role="status" live region; never swallow the rejection.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
