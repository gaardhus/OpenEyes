ext_firefox_dir := "firefox-extension"
ext_chrome_dir := "extension-chrome"
out_dir := "dist"

[private]
default:
    just -l

# Package the Firefox extension into a zip
[group("build")]
build-firefox:
    mkdir -p {{ out_dir }}
    cd {{ ext_firefox_dir }} && zip -r ../{{ out_dir }}/openeyes-firefox.zip .
    @echo "Built dist/openeyes-firefox.zip"

# Package the Chrome extension into a zip
[group("build")]
build-chrome:
    mkdir -p {{ out_dir }}
    cd {{ ext_chrome_dir }} && zip -r ../{{ out_dir }}/openeyes-chrome.zip .
    @echo "Built dist/openeyes-chrome.zip"

# Package both extensions
[group("build")]
build-all: build-firefox build-chrome

# Run the extension in Firefox for development (requires web-ext)
[group("Firefox")]
run:
    bunx web-ext run --source-dir {{ ext_firefox_dir }}

# Lint the extension (requires web-ext)
[group("Firefox")]
lint:
    bunx web-ext lint --source-dir {{ ext_firefox_dir }}

# Build a signed/unsigned .xpi using web-ext (requires web-ext)
[group("Firefox")]
xpi:
    mkdir -p {{ out_dir }}
    bunx web-ext build --source-dir {{ ext_firefox_dir }} --artifacts-dir {{ out_dir }} --overwrite-dest

# Clean build output
[group("build")]
clean:
    rm -rf {{ out_dir }}
