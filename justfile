ext_firefox_dir := "firefox-extension"
ext_chrome_dir := "chrome-extension"
out_dir := "dist"

[private]
default:
    just -l

# Package the Firefox extension into a zip
[group("build")]
build-firefox: manifests
    mkdir -p {{ out_dir }}
    cd {{ ext_firefox_dir }} && zip -r ../{{ out_dir }}/openeyes-firefox.zip .
    @echo "Built dist/openeyes-firefox.zip"

# Package the Chrome extension into a zip
[group("build")]
build-chrome: manifests
    mkdir -p {{ out_dir }}
    cd {{ ext_chrome_dir }} && zip -r ../{{ out_dir }}/openeyes-chrome.zip .
    @echo "Built dist/openeyes-chrome.zip"

# Generate browser manifests from shared base
[group("build")]
manifests:
    python3 "scripts/generate_manifests.py"
    @echo "Manifests built"

# Package both extensions
[group("build")]
build-all: build-firefox build-chrome

# Regenerate Chrome extension PNG icons from SVG
[group("assets")]
icons-chrome:
    magick -background none -density 384 "assets/icon.svg" -resize 16x16 "{{ ext_chrome_dir }}/icons/icon-16.png"
    magick -background none -density 384 "assets/icon.svg" -resize 32x32 "{{ ext_chrome_dir }}/icons/icon-32.png"
    magick -background none -density 384 "assets/icon.svg" -resize 48x48 "{{ ext_chrome_dir }}/icons/icon-48.png"
    magick -background none -density 384 "assets/icon.svg" -resize 128x128 "{{ ext_chrome_dir }}/icons/icon-128.png"
    cp "{{ ext_chrome_dir }}/icons/icon-128.png" "assets/"

# Run the extension in Firefox for development (requires web-ext)
[group("Firefox")]
dev: manifests
    bunx web-ext run --source-dir {{ ext_firefox_dir }}

# Lint the extension (requires web-ext)
[group("Firefox")]
lint: manifests
    bunx web-ext lint --source-dir {{ ext_firefox_dir }}

# Build a signed/unsigned .xpi using web-ext (requires web-ext)
[group("Firefox")]
xpi:
    just manifests
    mkdir -p {{ out_dir }}
    bunx web-ext build --source-dir {{ ext_firefox_dir }} --artifacts-dir {{ out_dir }} --overwrite-dest

# Bump shared manifest version (major, minor, patch)
[group("build")]
bump-version bump="patch":
    #!/usr/bin/env bash
    set -euo pipefail
    # Update manifests
    new_version="$(python3 scripts/bump_version.py {{ bump }})"
    just manifests

    if git rev-parse --verify --quiet "refs/tags/v${new_version}" >/dev/null; then
      echo "Tag already exists: v${new_version}"
      exit 1
    fi

    git add manifests/shared.json
    git add "{{ ext_firefox_dir }}/manifest.json"
    git add "{{ ext_chrome_dir }}/manifest.json"
    git commit -m "chore: bump manifest version to ${new_version}"
    git tag -a "v${new_version}" -m "v${new_version}"
    echo "Bumped manifests/shared.json to ${new_version}, committed, and tagged v${new_version}"

    just build-all

# Clean build output
[group("build")]
clean:
    rm -rf {{ out_dir }}
