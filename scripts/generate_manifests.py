#!/usr/bin/env python3

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MANIFESTS_DIR = ROOT / "manifests"


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, content: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(content, handle, indent=2)
        handle.write("\n")


def merge_shared(browser: str, output_dir: str) -> None:
    shared_manifest = load_json(MANIFESTS_DIR / "shared.json")
    browser_manifest = load_json(MANIFESTS_DIR / f"{browser}.json")

    merged_manifest = {**shared_manifest, **browser_manifest}
    write_json(ROOT / output_dir / "manifest.json", merged_manifest)


def main() -> None:
    merge_shared("firefox", "firefox-extension")
    merge_shared("chrome", "chrome-extension")


if __name__ == "__main__":
    main()
