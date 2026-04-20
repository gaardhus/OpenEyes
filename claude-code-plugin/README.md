# OpenEyes Claude Code channel

A [Claude Code channel](https://code.claude.com/docs/en/channels) that lets the
OpenEyes browser extension push a selected page element — HTML, CSS selector,
and a cropped screenshot — into your running Claude Code session.

## Requirements

- [Bun](https://bun.sh)
- Claude Code v2.1.80+
- Logged in with a claude.ai account (channels don't work with API-key auth)

## Install

```bash
cd claude-code-plugin
bun install
```

Register the server with Claude Code by adding it to your user-level
`~/.claude.json` (use an absolute path) or a project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "openeyes": {
      "command": "bun",
      "args": ["/absolute/path/to/claude-code-plugin/server.ts"]
    }
  }
}
```

The first run generates an auth token at `~/.claude/openeyes/token`. Copy it
into the extension popup under **Auth token**.

## Run

Channels are still in research preview, so a custom one needs the development
flag:

```bash
claude --dangerously-load-development-channels server:openeyes
```

The server listens on `127.0.0.1:4097`. Point the OpenEyes extension at
`http://127.0.0.1:4097`, select **Backend: Claude Code**, paste the token, and
send. The event arrives in your session as:

```
<channel source="openeyes" url="..." selector="..." file_path="/tmp/openeyes-xxx.png">
## Your instruction
...
</channel>
```

## Security

Only requests presenting the token in `X-OpenEyes-Token` (or `Authorization:
Bearer`) are forwarded. The server binds to `127.0.0.1` so nothing outside the
machine can reach it.
