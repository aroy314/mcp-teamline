# mcp-teamline

MCP stdio server that wraps the Teamline API so MCP hosts (Cursor, Claude, etc.) can call Teamline.

API docs: https://support.teamline.app/article/64-integrating-using-the-teamline-api

This repository is MIT-licensed. The Teamline API itself is governed by Teamline Terms of Service; using this server against Teamline means those terms apply to the API traffic.

## Prerequisites

- Node.js 20 or later

## Environment

Set TEAMLINE_API_KEY in the environment. Create a key at https://my.teamline.app/settings/api

The token is read only from the environment. It is never a tool argument and is never logged.

Optional: TEAMLINE_HTTP_ENCODING=json or form (default json). The official article does not document the HTTP method or encoding; this server POSTs JSON { token, ...params } by default, with form-urlencoded as a fallback.

## Cursor (mcp.json)

Using the GitHub package:

```json
{
  "mcpServers": {
    "teamline": {
      "command": "npx",
      "args": ["-y", "github:aroy314/mcp-teamline"],
      "env": {
        "TEAMLINE_API_KEY": ""
      }
    }
  }
}
```

Fill TEAMLINE_API_KEY from your local secret store or OS environment. Do not commit a real key.

## Local run

Install dependencies and compile TypeScript, then start with: node dist/index.js

Provide TEAMLINE_API_KEY in the environment when launching. After install, the bin name is mcp-teamline.

## Tools (M0)

| Tool | Input | Description |
| --- | --- | --- |
| teamline_auth_test | none | Calls Teamline auth.test and returns the authenticated user as JSON (id, name, email). |

If TEAMLINE_API_KEY is missing, the tool returns a clear error without calling the network.

## License

MIT (c) 2026 Alexandre Roy. Teamline ToS apply to use of the Teamline API.
