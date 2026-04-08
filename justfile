ext_dir := "extension"
out_dir := "dist"

# Package the extension into a zip for distribution
build:
    mkdir -p {{ out_dir }}
    cd {{ ext_dir }} && zip -r ../{{ out_dir }}/openeyes.zip .
    @echo "Built dist/openeyes.zip"

# Run the extension in Firefox for development (requires web-ext)
run:
    bunx web-ext run --source-dir {{ ext_dir }}

# Lint the extension (requires web-ext)
lint:
    bunx web-ext lint --source-dir {{ ext_dir }}

# Build a signed/unsigned .xpi using web-ext (requires web-ext)
xpi:
    mkdir -p {{ out_dir }}
    bunx web-ext build --source-dir {{ ext_dir }} --artifacts-dir {{ out_dir }} --overwrite-dest

# Clean build output
clean:
    rm -rf {{ out_dir }}
