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

set -eu

LOCK_DIR="${CHQ_TEST_LOCK_DIR:-/tmp/chq-test.lock}"
STALE_MINUTES=45
STALE_SECONDS=$((STALE_MINUTES * 60))
POLL_SECONDS=2

if [ "$#" -eq 0 ]; then
  echo "with-test-lock.sh: no command given" >&2
  exit 2
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
    lock_mtime=$(
      stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR" 2>/dev/null || echo "$now"
    )
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
