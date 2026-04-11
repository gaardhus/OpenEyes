#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path


MANIFEST_PATH = Path("manifests/shared.json")


def bump_version(version: str, level: str) -> str:
    try:
        major, minor, patch = map(int, version.split("."))
    except ValueError as exc:
        raise ValueError(f"Invalid semantic version: {version}") from exc

    if level == "major":
        major, minor, patch = major + 1, 0, 0
    elif level == "minor":
        minor, patch = minor + 1, 0
    elif level == "patch":
        patch += 1
    else:
        raise ValueError("Version bump must be one of: major, minor, patch")

    return f"{major}.{minor}.{patch}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Bump manifest version")
    parser.add_argument(
        "level", choices=["major", "minor", "patch"], help="Version bump level"
    )
    args = parser.parse_args()

    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest not found: {MANIFEST_PATH}")

    data = json.loads(MANIFEST_PATH.read_text())
    current_version = data.get("version")
    if not isinstance(current_version, str):
        raise ValueError("Manifest version must be a string")

    new_version = bump_version(current_version, args.level)
    data["version"] = new_version
    MANIFEST_PATH.write_text(json.dumps(data, indent=2) + "\n")
    print(new_version)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
