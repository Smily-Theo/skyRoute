#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
python3 app/server.py --host 127.0.0.1 --port 8000
