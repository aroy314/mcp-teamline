import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import {
  TEAMLINE_API_BASE,
  TeamlineClient,
  TeamlineError,
  formatTeamlineApiError,
  redactSecret,
} from "../src/client.ts";

const TEST_KEY = "tl_test_secret_value";

const sampleUser = {
  id: "U0L8G1LTB",
  name: "batman",
  email: "alfred@batman.com",
};

type FetchMock = ReturnType<typeof mock.fn<typeof fetch>>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchOk(): FetchMock {
  return mock.fn(async () =>
    jsonResponse({
      ok: true,
      data: { user: sampleUser },
    }),
  );
}

beforeEach(() => {
  process.env.TEAMLINE_API_KEY = TEST_KEY;
  delete process.env.TEAMLINE_HTTP_ENCODING;
});

afterEach(() => {
  delete process.env.TEAMLINE_API_KEY;
  delete process.env.TEAMLINE_HTTP_ENCODING;
  mock.restoreAll();
});

test("ok:true parses user", async () => {
  const fetchMock = mockFetchOk();
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const user = await client.authTest();
  assert.deepEqual(user, sampleUser);
});

test("ok:false error message uses error/errorText and does not include the key", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({
      ok: false,
      error: "invalid_auth",
      errorText: `Token ${TEST_KEY} is not valid`,
    }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.authTest(),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /invalid_auth/);
      assert.match(err.message, /is not valid/);
      assert.equal(err.message.includes(TEST_KEY), false);
      assert.equal(err.code, "invalid_auth");
      return true;
    },
  );
});

test("ok:false with only error field still surfaces the machine-readable error", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({
      ok: false,
      error: "not_authed",
    }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(() => client.authTest(), (err: unknown) => {
    assert.ok(err instanceof TeamlineError);
    assert.equal(err.message, "not_authed");
    assert.equal(err.message.includes(TEST_KEY), false);
    return true;
  });
});

test("missing key fails before fetch", async () => {
  delete process.env.TEAMLINE_API_KEY;
  const fetchMock = mock.fn(async () => jsonResponse({ ok: true, data: { user: sampleUser } }));
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(() => client.authTest(), (err: unknown) => {
    assert.ok(err instanceof TeamlineError);
    assert.match(err.message, /TEAMLINE_API_KEY/);
    return true;
  });
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("empty key fails before fetch", async () => {
  process.env.TEAMLINE_API_KEY = "   ";
  const fetchMock = mock.fn(async () => jsonResponse({ ok: true, data: { user: sampleUser } }));
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(() => client.authTest(), /TEAMLINE_API_KEY/);
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("fetch called with URL ending in auth.test and POST", async () => {
  const fetchMock = mockFetchOk();
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.authTest();

  assert.equal(fetchMock.mock.calls.length, 1);
  const [input, init] = fetchMock.mock.calls[0].arguments;
  const url = String(input);
  assert.ok(url.endsWith("auth.test"), `expected URL to end with auth.test, got ${url}`);
  assert.equal(url, `${TEAMLINE_API_BASE}auth.test`);
  assert.equal(init?.method, "POST");
});

test("default encoding is JSON body with token from env", async () => {
  const fetchMock = mockFetchOk();
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.authTest();

  const init = fetchMock.mock.calls[0].arguments[1];
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("Content-Type"), "application/json");
  const body = String(init?.body);
  const parsed = JSON.parse(body) as { token: string };
  assert.equal(parsed.token, TEST_KEY);
});

test("TEAMLINE_HTTP_ENCODING=form sends form-urlencoded body", async () => {
  process.env.TEAMLINE_HTTP_ENCODING = "form";
  const fetchMock = mockFetchOk();
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.authTest();

  const init = fetchMock.mock.calls[0].arguments[1];
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("Content-Type"), "application/x-www-form-urlencoded");
  const params = new URLSearchParams(String(init?.body));
  assert.equal(params.get("token"), TEST_KEY);
});

test("formatTeamlineApiError prefers combined error and errorText", () => {
  assert.equal(formatTeamlineApiError("invalid_auth", "nope"), "invalid_auth: nope");
  assert.equal(formatTeamlineApiError("invalid_auth"), "invalid_auth");
  assert.equal(formatTeamlineApiError(undefined, "nope"), "nope");
});

test("redactSecret never leaves the key in the message", () => {
  assert.equal(redactSecret(`bad ${TEST_KEY} token`, TEST_KEY), "bad [redacted] token");
});
