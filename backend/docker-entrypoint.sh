#!/bin/sh
set -e

mkdir -p /app/storage
chown -R app:app /app/storage

exec gosu app "$@"
