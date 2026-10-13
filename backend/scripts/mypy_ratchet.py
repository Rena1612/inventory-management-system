"""Fail if mypy error count rises above the recorded baseline.

mypy is not clean (see the baseline file). Rather than ignore it and let the
count drift upward unnoticed, CI enforces a ceiling: new type errors fail the
build, pre-existing ones are tolerated. Lower baseline/mypy-baseline.txt only
when the debt is actually paid off.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys

BASELINE_FILE = pathlib.Path(__file__).resolve().parent.parent / "baseline" / "mypy-baseline.txt"
ERROR_RE = re.compile(r"^.+:\d+:\s+error:", re.MULTILINE)


def read_baseline() -> int:
    if not BASELINE_FILE.exists():
        raise SystemExit(f"missing baseline file: {BASELINE_FILE}")
    return int(BASELINE_FILE.read_text(encoding="utf-8").strip())


def count_mypy_errors(targets: list[str]) -> int:
    result = subprocess.run(
        [sys.executable, "-m", "mypy", *targets],
        capture_output=True,
        text=True,
        check=False,
    )
    # mypy writes findings to stdout and its summary to stderr.
    return len(ERROR_RE.findall(result.stdout + result.stderr))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("targets", nargs="*", default=["app", "main.py", "scripts"])
    args = parser.parse_args()
    targets = args.targets or ["app", "main.py", "scripts"]

    baseline = read_baseline()
    actual = count_mypy_errors(targets)

    print(f"mypy errors: {actual} (baseline {baseline})")
    if actual > baseline:
        print(
            f"FAIL: mypy error count grew by {actual - baseline}. "
            "Fix the new errors, or if the debt genuinely shrank, "
            "update baseline/mypy-baseline.txt in the same commit.",
            file=sys.stderr,
        )
        return 1
    if actual < baseline:
        print("baseline is stale; lower baseline/mypy-baseline.txt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())