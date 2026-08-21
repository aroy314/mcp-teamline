#!/usr/bin/env node
import { McpServer, fromJsonSchema } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  TeamlineClient,
  TeamlineError,
  type TasksCreateParams,
  type TasksListParams,
} from "./client.js";

export const SERVER_NAME = "mcp-teamline";
export const SERVER_VERSION = "0.1.0";

function successJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(toolName: string, err: unknown) {
  const message =
    err instanceof TeamlineError || err instanceof Error ? err.message : "Unknown error";
  // Never log the token; messages from TeamlineClient are already redacted.
  console.error(`${toolName} failed: ${message}`);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

const tasksListInput = fromJsonSchema<TasksListParams>({
  type: "object",
  properties: {
    limit: {
      type: "number",
      description: "Maximum number of tasks to return",
    },
    channel: {
      type: "string",
      description: "#channel-name or slackId. Required if list is present.",
    },
    list: {
      type: "string",
      description: "~list-name or id. Channel is required if this is present.",
    },
    user: {
      type: "string",
      description:
        "@name, email address, or slackId. If channel and user are omitted, the API defaults to yourself.",
    },
    complete: {
      type: "boolean",
      description: "If true, only completed tasks are returned",
    },
  },
});

const tasksCreateInput = fromJsonSchema<TasksCreateParams>({
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Name of the task",
    },
    description: {
      type: "string",
      description: "Task description",
    },
    assign: {
      type: "array",
      items: { type: "string" },
      description: "@name, email address, or slackId of members to assign",
    },
    channel: {
      type: "string",
      description: "#channel-name or slackId. Required if list is present.",
    },
    list: {
      type: "string",
      description: "~list-name or id. Channel is required if this is present.",
    },
    personal: {
      type: "boolean",
      description: "Overrides the default privacy setting",
    },
    due: {
      type: "string",
      description: 'ISO8601 timestamp, or a human string such as "next wednesday at 3:30pm"',
    },
    notify: {
      type: "array",
      items: { type: "string" },
      description:
        "@name, email address, or slackId of members to notify. Assigned members won't be notified twice.",
    },
  },
  required: ["name"],
});

const tasksCompleteInput = fromJsonSchema<{ task: string }>({
  type: "object",
  properties: {
    task: {
      type: "string",
      description: "Id of the task to complete",
    },
  },
  required: ["task"],
});

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
        return successJson(user);
      } catch (err) {
        return errorResult("teamline_auth_test", err);
      }
    },
  );

  server.registerTool(
    "teamline_tasks_list",
    {
      title: "List Teamline tasks",
      description:
        "List Teamline tasks via tasks.list. Optional filters: limit, channel (#name or slackId), list (~name or id; channel required if list is set), user (@name, email, or slackId), complete (true = only completed). If channel and user are omitted, the API defaults to yourself. Token is read only from TEAMLINE_API_KEY.",
      inputSchema: tasksListInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const client = new TeamlineClient();
        const tasks = await client.tasksList(args);
        return successJson(tasks);
      } catch (err) {
        return errorResult("teamline_tasks_list", err);
      }
    },
  );

  server.registerTool(
    "teamline_tasks_create",
    {
      title: "Create a Teamline task",
      description:
        "Create a Teamline task via tasks.create. name is required. Optional: description, assign (string[] of @name/email/slackId), channel (#name or slackId), list (~name or id; channel required if list is set), personal (boolean), due (ISO8601 or human string), notify (string[]). Token is read only from TEAMLINE_API_KEY.",
      inputSchema: tasksCreateInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const client = new TeamlineClient();
        const task = await client.tasksCreate(args);
        return successJson(task);
      } catch (err) {
        return errorResult("teamline_tasks_create", err);
      }
    },
  );

  server.registerTool(
    "teamline_tasks_complete",
    {
      title: "Complete a Teamline task",
      description:
        "Mark a Teamline task complete via tasks.complete. Requires task (id string). Token is read only from TEAMLINE_API_KEY.",
      inputSchema: tasksCompleteInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const client = new TeamlineClient();
        const task = await client.tasksComplete(args.task);
        return successJson(task);
      } catch (err) {
        return errorResult("teamline_tasks_complete", err);
      }
    },
  );

  return server;
}

void serveStdio(createServer);
console.error("mcp-teamline listening on stdio");
