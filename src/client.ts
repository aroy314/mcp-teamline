/**
 * Teamline HTTP client (M0: auth.test; M2: tasks.list / tasks.create / tasks.complete).
 *
 * Official API: https://support.teamline.app/article/64-integrating-using-the-teamline-api
 * Base URL: https://integration.teamline.app/api/
 *
 * Token is always read from TEAMLINE_API_KEY. It is never accepted as a
 * tool argument and is never written to logs.
 */

export const TEAMLINE_API_BASE = "https://integration.teamline.app/api/";

export type HttpEncoding = "json" | "form";

export interface TeamlineUser {
  id: string;
  name: string;
  email: string;
}

/** Input for tasks.list (token is injected from TEAMLINE_API_KEY). */
export interface TasksListParams {
  limit?: number;
  channel?: string;
  list?: string;
  user?: string;
  complete?: boolean;
}

/** Input for tasks.create (token is injected from TEAMLINE_API_KEY). */
export interface TasksCreateParams {
  name: string;
  description?: string;
  assign?: string[];
  channel?: string;
  list?: string;
  personal?: boolean;
  due?: string;
  notify?: string[];
}

export class TeamlineError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "TeamlineError";
    this.code = code;
  }
}

export interface TeamlineClientOptions {
  /** Injected fetch for tests. Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Override TEAMLINE_HTTP_ENCODING. */
  encoding?: HttpEncoding;
  /** Override API base URL (must include trailing slash). */
  baseUrl?: string;
}

export function requireApiKey(): string {
  const key = process.env.TEAMLINE_API_KEY;
  if (key === undefined || key.trim() === "") {
    throw new TeamlineError(
      "TEAMLINE_API_KEY is not set. Create a key at https://my.teamline.app/settings/api and export it in the environment before calling this tool.",
    );
  }
  return key;
}

export function readHttpEncoding(): HttpEncoding {
  const raw = process.env.TEAMLINE_HTTP_ENCODING?.trim().toLowerCase();
  if (raw === "form") {
    return "form";
  }
  return "json";
}

export function formatTeamlineApiError(error?: string, errorText?: string): string {
  if (error && errorText) {
    return `${error}: ${errorText}`;
  }
  if (errorText) {
    return errorText;
  }
  if (error) {
    return error;
  }
  return "Teamline API request failed";
}

/** Strip a secret from a string without using it as a regex (keys may contain regex metacharacters). */
export function redactSecret(text: string, secret: string): string {
  if (!secret) {
    return text;
  }
  return text.split(secret).join("[redacted]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Official doc: channel is required if list is present. Fail before fetch. */
function assertChannelIfList(params: { list?: string; channel?: string }): void {
  if (isPresent(params.list) && !isPresent(params.channel)) {
    throw new TeamlineError("channel is required if list is present");
  }
}

function omitUndefinedNull(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function encodeBody(
  payload: Record<string, unknown>,
  encoding: HttpEncoding,
): { body: string; contentType: string } {
  if (encoding === "form") {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item === undefined || item === null) {
            continue;
          }
          form.append(key, String(item));
        }
      } else {
        form.append(key, String(value));
      }
    }
    return { body: form.toString(), contentType: "application/x-www-form-urlencoded" };
  }

  return {
    body: JSON.stringify(omitUndefinedNull(payload)),
    contentType: "application/json",
  };
}

export class TeamlineClient {
  private readonly fetchImpl: typeof fetch;
  private readonly encodingOverride: HttpEncoding | undefined;
  private readonly baseUrl: string;

  constructor(options: TeamlineClientOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.encodingOverride = options.encoding;
    this.baseUrl = options.baseUrl ?? TEAMLINE_API_BASE;
  }

  /**
   * POST auth.test and return data.user.
   * Fails before fetch when TEAMLINE_API_KEY is missing.
   */
  async authTest(): Promise<TeamlineUser> {
    const data = await this.post("auth.test", {});
    const user = data.user;
    if (!isRecord(user)) {
      throw new TeamlineError("Teamline auth.test succeeded but data.user was missing");
    }
    const id = user.id;
    const name = user.name;
    const email = user.email;
    if (typeof id !== "string" || typeof name !== "string" || typeof email !== "string") {
      throw new TeamlineError("Teamline auth.test returned an unexpected user shape");
    }
    return { id, name, email };
  }

  /**
   * POST tasks.list and return data.tasks (array).
   * If `list` is set without `channel`, throws before fetch.
   */
  async tasksList(params: TasksListParams = {}): Promise<unknown[]> {
    assertChannelIfList(params);
    const data = await this.post("tasks.list", {
      limit: params.limit,
      channel: params.channel,
      list: params.list,
      user: params.user,
      complete: params.complete,
    });
    const tasks = data.tasks;
    if (!Array.isArray(tasks)) {
      throw new TeamlineError(
        "Teamline tasks.list succeeded but data.tasks was missing or not an array",
      );
    }
    return tasks;
  }

  /**
   * POST tasks.create and return data.task (object).
   * Official create output key is `data.task` (singular), unlike complete.
   */
  async tasksCreate(params: TasksCreateParams): Promise<Record<string, unknown>> {
    if (!isNonEmptyString(params.name)) {
      throw new TeamlineError("name is required");
    }
    assertChannelIfList(params);
    const data = await this.post("tasks.create", {
      name: params.name,
      description: params.description,
      assign: params.assign,
      channel: params.channel,
      list: params.list,
      personal: params.personal,
      due: params.due,
      notify: params.notify,
    });
    const task = data.task;
    if (!isRecord(task)) {
      throw new TeamlineError("Teamline tasks.create succeeded but data.task was missing");
    }
    return task;
  }

  /**
   * POST tasks.complete and return the completed task object.
   * Live API uses data.task; 2019 doc sample used data.tasks (object, not array).
   */
  async tasksComplete(taskId: string): Promise<Record<string, unknown>> {
    if (!isNonEmptyString(taskId)) {
      throw new TeamlineError("task is required");
    }
    const data = await this.post("tasks.complete", { task: taskId });
    // Live API returns data.task (same as create). 2019 doc sample used data.tasks (object).
    const task = isRecord(data.task) ? data.task : data.tasks;
    if (!isRecord(task)) {
      throw new TeamlineError(
        "Teamline tasks.complete succeeded but data.task/data.tasks was missing or not an object",
      );
    }
    return task;
  }

  /**
   * POST JSON (default) or form-urlencoded body to an official endpoint.
   * Always includes `token` from TEAMLINE_API_KEY; omits undefined/null optionals.
   */
  private async post(endpoint: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = requireApiKey();
    const encoding = this.encodingOverride ?? readHttpEncoding();
    const url = `${this.baseUrl}${endpoint}`;
    const payload: Record<string, unknown> = { token, ...omitUndefinedNull(params) };
    const { body, contentType } = encodeBody(payload, encoding);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "network error";
      throw new TeamlineError(redactSecret(`Teamline API request failed: ${message}`, token));
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      throw new TeamlineError(
        `Teamline API returned non-JSON response (HTTP ${response.status})`,
      );
    }

    if (!isRecord(parsed)) {
      throw new TeamlineError(`Unexpected Teamline API response (HTTP ${response.status})`);
    }

    if (parsed.ok === false) {
      const error = typeof parsed.error === "string" ? parsed.error : undefined;
      const errorText = typeof parsed.errorText === "string" ? parsed.errorText : undefined;
      const message = formatTeamlineApiError(error, errorText);
      throw new TeamlineError(redactSecret(message, token), error);
    }

    if (parsed.ok !== true) {
      throw new TeamlineError(`Unexpected Teamline API response (HTTP ${response.status})`);
    }

    if (!isRecord(parsed.data)) {
      throw new TeamlineError("Teamline API response was missing data");
    }

    return parsed.data;
  }
}
