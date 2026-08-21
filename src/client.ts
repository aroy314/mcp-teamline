/**
 * Teamline HTTP client (M0: auth.test only).
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

  private async post(endpoint: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = requireApiKey();
    const encoding = this.encodingOverride ?? readHttpEncoding();
    const url = `${this.baseUrl}${endpoint}`;
    const payload: Record<string, unknown> = { token, ...params };

    let body: string;
    let contentType: string;
    if (encoding === "form") {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null) {
          continue;
        }
        form.set(key, String(value));
      }
      body = form.toString();
      contentType = "application/x-www-form-urlencoded";
    } else {
      body = JSON.stringify(payload);
      contentType = "application/json";
    }

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
