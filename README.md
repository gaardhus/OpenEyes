# OpenEyes

<img src="firefox-extension/icons/icon.svg" alt="OpenEyes icon" width="96" />

OpenEyes is a browser extension that allows you to select any element on a web page and send it—along with its HTML source and a cropped screenshot—directly to a running **OpenCode** session.

It's designed to bridge the gap between your browser and your development environment, making it easy to share UI components, bug reports, or layout snippets with your AI-assisted coding tools.

## Features

- **Visual Element Picker:** Click any element on the page to select it.
- **Contextual Capture:** Automatically captures the element's HTML, CSS selector, and page metadata.
- **Smart Screenshots:** Captures a precise, cropped screenshot of the selected element.
- **Direct Integration:** Sends captured data to the OpenCode API (defaults to `http://127.0.0.1:4096`).
- **Flexible Controls:** Toggle whether to include the source code or the screenshot before sending.

## Installation

### For Developers

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/openeyes.git
    cd openeyes
    ```

2.  **Install dependencies:**
    The project uses `web-ext` for development and `just` as a command runner.

    ```bash
    # Ensure you have 'just' installed (https://just.systems/man/en/installation.html)
    # Ensure you have 'bun' or 'npm' for running web-ext
    ```

3.  **Run in Development Mode:**
    This will launch Firefox with the extension loaded.
    ```bash
    just run
    ```

### Manual Installation (Firefox/Chrome)

1.  Open your browser's extension management page (`about:debugging` in Firefox, `chrome://extensions` in Chrome).
2.  Enable "Developer mode" if required.
3.  Click "Load Temporary Add-on" (Firefox) or "Load unpacked" (Chrome).
4.  Select the `extension/` directory in this project.

## Usage

1.  **Start OpenCode:** Ensure your OpenCode server is running (usually on port `4096`).
2.  **Configure:** Click the OpenEyes icon in your browser toolbar to set your Server URL and Auth Password (if applicable).
3.  **Pick an Element:**
    - Click the **Pick Element** button in the popup.
    - Hover over the page to highlight elements.
    - Click to select an element.
4.  **Send to OpenCode:**
    - Add an instruction (e.g., "Explain this component" or "Refactor this button").
    - Toggle **Source** or **Screenshot** options.
    - Press **Send** or `Ctrl+Enter`.

## Development Commands

The project includes a `justfile` for common tasks:

- `just run`: Launches the extension in Firefox for testing.
- `just lint`: Lints the extension code using `web-ext`.
- `just build`: Packages the extension into `dist/openeyes.zip`.
- `just xpi`: Builds a signed or unsigned `.xpi` file for distribution.
- `just clean`: Removes the `dist/` directory.

## Configuration

Settings are persisted in local storage:

- **Server URL:** The base URL of your OpenCode instance (default: `http://127.0.0.1:4096`).
- **Session ID:** Which session to send messages to. "Auto" picks the most recently updated session.
- **Auth Password:** Used for Basic Auth if your OpenCode instance requires it.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.
