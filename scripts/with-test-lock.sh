#!/bin/sh
# Serializes full-suite test runs across concurrent workers/processes.
#
# Acquires a spinlock via atomic `mkdir` on LOCK_DIR, polling every ~2s
# until the lock is free. If the lock is found to be older than
# STALE_MINUTES (45), it is loudly declared stale and stolen. The lock is
# always released on exit (normal, INT, or TERM) via `rmdir`. Once the
# lock is held, this script runs its arguments as a child process and
# forwards the wrapped command's exit code verbatim (see the note below
# on why it does not `exec`).
#
# Usage: sh scripts/with-test-lock.sh <command> [args...]
#
# Re-entrancy (DEC-644 wave-41 amendment): package.json:27,29 define both
# `test` and `test:full` AS this wrapper (`sh scripts/with-test-lock.sh
# vitest run`). If a gate lane wraps `npm test`/`npm run test:full` inside
# ANOTHER invocation of this script (e.g. `sh scripts/with-test-lock.sh sh
# -c 'npm test'`), the inner invocation would acquire-spin against the
# outer invocation's own lock for up to the 45-minute stale window. To
# make correct use inferable from the interface rather than from a memo,
# this script exports CHQ_TEST_LOCK_HELD=1 once it holds the lock; if a
# nested invocation finds that marker already set, it runs the wrapped
# command inline WITHOUT acquiring and WITHOUT installing the release
# trap. It must not install the trap in this case: an inner release would
# free the lock while the outer heavy phase is still running, which is
# worse than the deadlock this guard fixes.

set -eu

LOCK_DIR="${CHQ_TEST_LOCK_DIR:-/tmp/chq-test.lock}"
STALE_MINUTES=45
STALE_SECONDS=$((STALE_MINUTES * 60))
POLL_SECONDS=2

if [ "$#" -eq 0 ]; then
  echo "with-test-lock.sh: no command given" >&2
  exit 2
fi

if [ "${CHQ_TEST_LOCK_HELD:-}" = "1" ]; then
  echo "with-test-lock.sh: WARNING: lock already held by this process tree (CHQ_TEST_LOCK_HELD=1); running inline without re-acquiring" >&2
  set +e
  "$@"
  status=$?
  set -e
  exit "$status"
fi

acquired=0
while [ "$acquired" -eq 0 ]; do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    acquired=1
    break
  fi

  # Lock is held by someone else. Check its age; steal if stale.
  if [ -d "$LOCK_DIR" ]; then
    now=$(date +%s)
    # GNU stat FIRST, BSD stat second. `stat -f` means two different things:
    # on BSD/macOS it is the format flag (so `stat -f %m` prints the mtime),
    # but on GNU/Linux it is --file-system and `%m` is the MOUNT POINT — it
    # SUCCEEDS and prints "/", so a BSD-first chain never falls through on
    # Linux and feeds a non-numeric value into the arithmetic below (dash
    # then exits 2 under `set -e`, killing the waiter). `stat -c` has no BSD
    # meaning at all and simply fails there, so this order is safe on both.
    lock_mtime=$(
      stat -c %Y "$LOCK_DIR" 2>/dev/null || stat -f %m "$LOCK_DIR" 2>/dev/null || echo "$now"
    )
    # Neither stat spelling produced a plain integer (or the lock vanished
    # mid-check): fail loudly rather than silently skipping the staleness
    # check for the rest of the 45-minute window.
    case "$lock_mtime" in
      '' | *[!0-9]*)
        echo "with-test-lock.sh: cannot read mtime of $LOCK_DIR (stat returned '$lock_mtime')" >&2
        exit 1
        ;;
    esac
    age=$((now - lock_mtime))
    if [ "$age" -gt "$STALE_SECONDS" ]; then
      echo "with-test-lock.sh: WARNING: stealing stale lock at $LOCK_DIR (age ${age}s > ${STALE_SECONDS}s)" >&2
      rmdir "$LOCK_DIR" 2>/dev/null || true
      continue
    fi
  fi

  sleep "$POLL_SECONDS"
done

trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

CHQ_TEST_LOCK_HELD=1
export CHQ_TEST_LOCK_HELD

# Note: we deliberately do NOT `exec` the wrapped command here, since
# `exec` replaces this shell's process image and would discard the EXIT
# trap above before the lock could be released. Instead we run the
# command as a child, capture its exit status, and forward it verbatim
# after the trap has released the lock on script exit.
set +e
"$@"
status=$?
set -e
exit "$status"
