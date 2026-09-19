#!/usr/bin/env python3
"""
scripts/generate-commits.py

Regenerates content/commits.json from real git history, for terminal mode's
`git log` command. There is no backend, so this is a build-time step: run it,
commit the result. Fields are kept minimal on purpose: short hash, ISO date,
subject line. No author, no body, nothing that was not already public in the
commit itself.

Usage, from the repo root:
    python3 scripts/generate-commits.py

Run this again any time you want content/commits.json to catch up with new
commits, then commit both the script (already tracked) and the regenerated
file.
"""
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "content" / "commits.json"

# %h  = abbreviated commit hash
# %aI = author date, strict ISO 8601
# %s  = subject line
LOG_FORMAT = "%h\x1f%aI\x1f%s"
RECORD_SEP = "\x1e"


def main():
    try:
        result = subprocess.run(
            ["git", "log", "--pretty=format:" + LOG_FORMAT + RECORD_SEP],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as err:
        print("Could not run git log: {}".format(err), file=sys.stderr)
        sys.exit(1)

    commits = []
    for record in result.stdout.split(RECORD_SEP):
        record = record.strip("\n")
        if not record:
            continue
        parts = record.split("\x1f")
        if len(parts) != 3:
            continue
        short_hash, iso_date, subject = parts
        commits.append({
            "hash": short_hash,
            "date": iso_date,
            "subject": subject,
        })

    OUTPUT_PATH.write_text(json.dumps({"commits": commits}, indent=2) + "\n")
    print("Wrote {} commits to {}".format(len(commits), OUTPUT_PATH))


if __name__ == "__main__":
    main()
