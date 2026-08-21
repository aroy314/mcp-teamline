#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { TeamlineClient, TeamlineError } from "./client.js";

export const SERVER_NAME = "mcp-teamline";
export const SERVER_VERSION = "0.1.0";

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "teamline_auth_test",
    {
      title: "Test Teamline authentication",
      description:
        "Verify TEAMLINE_API_KEY against Teamline auth.test and return the authenticated user (id, name, email). Takes no arguments; the API token is read only from the environment.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const client = new TeamlineClient();
        const user = await client.authTest();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(user, null, 2) }],
        };
      } catch (err) {
        const message =
          err instanceof TeamlineError || err instanceof Error
            ? err.message
            : "Unknown error";
        // Never log the token; messages from TeamlineClient are already redacted.
        console.error(`teamline_auth_test failed: ${message}`);
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    },
  );

  return server;
}

void serveStdio(createServer);
console.error("mcp-teamline listening on stdio");
