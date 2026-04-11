ext_firefox_dir := "firefox-extension"
ext_chrome_dir := "chrome-extension"
out_dir := "dist"
manifest_generator := "scripts/generate_manifests.py"

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
    python3 {{ manifest_generator }}
    @echo "Manifests built"

# Package both extensions
[group("build")]
build-all: build-firefox build-chrome

# Regenerate Chrome extension PNG icons from SVG
[group("assets")]
icons-chrome:
    magick -background none "{{ ext_firefox_dir }}/icons/icon.svg" -resize 16x16 "{{ ext_chrome_dir }}/icons/icon-16.png"
    magick -background none "{{ ext_firefox_dir }}/icons/icon.svg" -resize 32x32 "{{ ext_chrome_dir }}/icons/icon-32.png"
    magick -background none "{{ ext_firefox_dir }}/icons/icon.svg" -resize 48x48 "{{ ext_chrome_dir }}/icons/icon-48.png"
    magick -background none "{{ ext_firefox_dir }}/icons/icon.svg" -resize 128x128 "{{ ext_chrome_dir }}/icons/icon-128.png"
    cp "{{ ext_chrome_dir }}/icons/icon-128.png" "assets/"

# Run the extension in Firefox for development (requires web-ext)
[group("Firefox")]
dev:
    python3 {{ manifest_generator }}
    bunx web-ext run --source-dir {{ ext_firefox_dir }}

# Lint the extension (requires web-ext)
[group("Firefox")]
lint:
    python3 {{ manifest_generator }}
    bunx web-ext lint --source-dir {{ ext_firefox_dir }}

# Build a signed/unsigned .xpi using web-ext (requires web-ext)
[group("Firefox")]
xpi:
    python3 {{ manifest_generator }}
    mkdir -p {{ out_dir }}
    bunx web-ext build --source-dir {{ ext_firefox_dir }} --artifacts-dir {{ out_dir }} --overwrite-dest

# Clean build output
[group("build")]
clean:
    rm -rf {{ out_dir }}
