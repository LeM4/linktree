#!/bin/sh
set -e

# Older images ran as root, so an existing volume may be root-owned.
# Fix ownership once, then drop privileges to the unprivileged "bun" user.
if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DATA_DIR"
    chown -R bun:bun "$DATA_DIR"
    exec setpriv --reuid=bun --regid=bun --init-groups "$@"
fi

exec "$@"
