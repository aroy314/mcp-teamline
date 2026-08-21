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

## Tools (M0, M2, M3)

| Tool | Input | Description |
| --- | --- | --- |
| teamline_auth_test | none | Calls Teamline auth.test and returns the authenticated user as JSON (id, name, email). |
| teamline_tasks_list | optional: limit (number), channel (#name or slackId), list (~name or id; channel required if list is set), user (@name, email, or slackId), complete (boolean; true = only completed) | Calls Teamline tasks.list. If channel and user are omitted, the API defaults to yourself. Returns the task array as JSON. |
| teamline_tasks_create | name (required); optional: description, assign (string[] of @name/email/slackId), channel, list (channel required if set), personal (boolean), due (ISO8601 or human string), notify (string[]) | Calls Teamline tasks.create. Returns the created task as JSON. |
| teamline_tasks_complete | task (required, id string) | Calls Teamline tasks.complete. Returns the completed task as JSON. |
| teamline_webhooks_create | event (required, currently only `tasks_completed`), url (required), name (optional) | Calls Teamline webhooks.create to register a user-provided URL. This server registers the URL; it does not receive webhook POSTs. Returns the hook as JSON. |
| teamline_webhooks_remove | hook (required, id string) | Calls Teamline webhooks.remove. Returns the removed hook as JSON. |

If TEAMLINE_API_KEY is missing, tools return a clear error without calling the network.

## License

MIT (c) 2026 Alexandre Roy. Teamline ToS apply to use of the Teamline API.
