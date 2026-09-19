#!/usr/bin/env bash
# verification/capture.sh
#
# Captures fetch.txt: evidence that the live GitHub Pages URL actually serves
# this site, not just that localhost does. Run it from anywhere; it writes
# verification/fetch.txt next to itself.
#
# Usage:
#   verification/capture.sh
#   verification/capture.sh > verification/fetch-before-merge.txt   (to save under a different name)

set -euo pipefail

SITE="https://hateandlovemodding.github.io"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== verification capture ==="
echo "Captured: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Site: $SITE"
echo

echo "--- curl -sS -D - $SITE (headers, body discarded) ---"
curl -sS -D - "$SITE" -o /dev/null
echo

echo "--- curl -s $SITE | head (sample of the real markup) ---"
curl -s "$SITE" | head -n 30
echo

echo "--- curl -sI $SITE/css/site.css (confirms the relative stylesheet path resolves live) ---"
curl -sI "$SITE/css/site.css"
echo

echo "--- curl -sI $SITE/resume.md (confirms a relative content path resolves live) ---"
curl -sI "$SITE/resume.md"
echo

echo "=== end capture ==="
