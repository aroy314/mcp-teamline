import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import {
  TEAMLINE_API_BASE,
  TeamlineClient,
  TeamlineError,
} from "../src/client.ts";

const TEST_KEY = "tl_test_secret_value";

type FetchMock = ReturnType<typeof mock.fn<typeof fetch>>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Official webhooks.create sample: data.hook with id. */
const sampleCreatedHook = {
  id: "p2bwNn3yz3RHuEbKk",
};

/** Official webhooks.remove sample: data.hook object. */
const sampleRemovedHook = {
  id: "nfstBhtYvSYKt7Pq5",
  event: "tasks_completed",
  url: "https://batman.com/notify",
  name: "Tasks Completed",
};

function lastCall(fetchMock: FetchMock) {
  assert.ok(fetchMock.mock.calls.length >= 1);
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1].arguments;
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

test("webhooks.create: POST URL ends with webhooks.create and body has token, event, url", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.webhooksCreate({
    event: "tasks_completed",
    url: "https://batman.com/notify",
  });

  assert.equal(fetchMock.mock.calls.length, 1);
  const [input, init] = lastCall(fetchMock);
  const url = String(input);
  assert.ok(url.endsWith("webhooks.create"), `expected URL to end with webhooks.create, got ${url}`);
  assert.equal(url, `${TEAMLINE_API_BASE}webhooks.create`);
  assert.equal(init?.method, "POST");
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("Content-Type"), "application/json");
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(body.token, TEST_KEY);
  assert.equal(body.event, "tasks_completed");
  assert.equal(body.url, "https://batman.com/notify");
});

test("webhooks.create: missing event fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.webhooksCreate({ event: "", url: "https://batman.com/notify" }),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /event is required/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("webhooks.create: missing url fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.webhooksCreate({ event: "tasks_completed", url: "" }),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /url is required/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("webhooks.create: event other than tasks_completed fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.webhooksCreate({ event: "tasks_created", url: "https://batman.com/notify" }),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /event must be tasks_completed/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("webhooks.create: returns data.hook", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const hook = await client.webhooksCreate({
    event: "tasks_completed",
    url: "https://batman.com/notify",
  });
  assert.deepEqual(hook, sampleCreatedHook);
});

test("webhooks.create: optional name omitted when unset", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.webhooksCreate({
    event: "tasks_completed",
    url: "https://batman.com/notify",
  });

  const body = JSON.parse(String(lastCall(fetchMock)[1]?.body)) as Record<string, unknown>;
  assert.equal(body.token, TEST_KEY);
  assert.equal(body.event, "tasks_completed");
  assert.equal(body.url, "https://batman.com/notify");
  assert.equal("name" in body, false);
});

test("webhooks.create: name is sent when set", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.webhooksCreate({
    event: "tasks_completed",
    url: "https://batman.com/notify",
    name: "mcp-teamline M3 smoke",
  });

  const body = JSON.parse(String(lastCall(fetchMock)[1]?.body)) as Record<string, unknown>;
  assert.equal(body.name, "mcp-teamline M3 smoke");
});

test("webhooks.create: live-key fallback accepts data.webhook object", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { webhook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const hook = await client.webhooksCreate({
    event: "tasks_completed",
    url: "https://batman.com/notify",
  });
  assert.deepEqual(hook, sampleCreatedHook);
});

test("webhooks.create: live-key fallback accepts data.hooks object", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hooks: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const hook = await client.webhooksCreate({
    event: "tasks_completed",
    url: "https://batman.com/notify",
  });
  assert.deepEqual(hook, sampleCreatedHook);
});

test("webhooks.create: data.hooks array is rejected", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hooks: [sampleCreatedHook] } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () =>
      client.webhooksCreate({
        event: "tasks_completed",
        url: "https://batman.com/notify",
      }),
    /data\.hook was missing or not an object/,
  );
});

test("webhooks.remove: missing hook id fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleRemovedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.webhooksRemove(""),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /hook is required/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("webhooks.remove: POST webhooks.remove with hook id, returns data.hook object", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleRemovedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const hook = await client.webhooksRemove("nfstBhtYvSYKt7Pq5");

  const [input, init] = lastCall(fetchMock);
  assert.ok(String(input).endsWith("webhooks.remove"));
  assert.equal(String(input), `${TEAMLINE_API_BASE}webhooks.remove`);
  assert.equal(init?.method, "POST");
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(body.token, TEST_KEY);
  assert.equal(body.hook, "nfstBhtYvSYKt7Pq5");
  assert.equal(Array.isArray(hook), false);
  assert.deepEqual(hook, sampleRemovedHook);
});

test("webhooks.remove: live-key fallback accepts data.webhook object", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { webhook: sampleRemovedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const hook = await client.webhooksRemove("nfstBhtYvSYKt7Pq5");
  assert.deepEqual(hook, sampleRemovedHook);
});

test("webhooks.create: ok:false error message does not include the key", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({
      ok: false,
      error: "invalid_auth",
      errorText: `Token ${TEST_KEY} is not valid`,
    }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () =>
      client.webhooksCreate({
        event: "tasks_completed",
        url: "https://batman.com/notify",
      }),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /invalid_auth/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
});

test("webhooks.create: form encoding still works", async () => {
  process.env.TEAMLINE_HTTP_ENCODING = "form";
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { hook: sampleCreatedHook } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.webhooksCreate({
    event: "tasks_completed",
    url: "https://batman.com/notify",
    name: "Tasks Completed",
  });

  const init = lastCall(fetchMock)[1];
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("Content-Type"), "application/x-www-form-urlencoded");
  const params = new URLSearchParams(String(init?.body));
  assert.equal(params.get("token"), TEST_KEY);
  assert.equal(params.get("event"), "tasks_completed");
  assert.equal(params.get("url"), "https://batman.com/notify");
  assert.equal(params.get("name"), "Tasks Completed");
});
