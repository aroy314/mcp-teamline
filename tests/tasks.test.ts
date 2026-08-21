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

/** Official tasks.list sample item (subset kept; extra fields are allowed). */
const sampleListTask = {
  id: "ih9KKwhfbEudPPSco",
  name: "NaNaNaNa",
  isComplete: false,
  isPersonal: false,
  created: "2017-03-17T13:30:56.914Z",
  updated: "2017-03-17T17:24:15.719Z",
};

/** Official tasks.create sample: data.task (singular). */
const sampleCreatedTask = {
  id: "ih9KKwhfbEudPPSco",
  name: "NaNaNaNa",
  isComplete: false,
  isPersonal: false,
  created: "2017-03-17T13:30:56.914Z",
  updated: "2017-03-17T17:24:15.719Z",
};

/**
 * Official tasks.complete sample: data.tasks is an OBJECT, not an array.
 * https://support.teamline.app/article/64-integrating-using-the-teamline-api
 */
const sampleCompletedTask = {
  id: "ih9KKwhfbEudPPSco",
  team: {
    id: "T0L8CR3RB",
    name: "batman",
    domain: "batman",
  },
  name: "NaNaNaNa",
  commentCount: 0,
  fileCount: 0,
  checklistTotal: 0,
  checklistComplete: 0,
  isComplete: true,
  isPersonal: false,
  completed: "2017-03-20T12:05:52.812Z",
  created: "2017-03-17T13:30:56.914Z",
  updated: "2017-03-17T17:24:15.719Z",
  channel: {
    id: "G0UE3BGAK",
    name: "NaNaNaNa",
  },
  list: {
    id: "wcrsPuHitrgiNGAXt",
    name: "Bam!",
  },
  creator: {
    id: "U0L8G1LTB",
    name: "alfred",
    email: "alfred@batman.com",
  },
  assigned: [
    {
      id: "U0L8G1LTB",
      name: "alfred",
      email: "alfred@batman.com",
    },
  ],
  due: {
    timestamp: "2017-03-21T01:00:00.000Z",
    date: "2017-03-21",
    tz: "America/Gotham",
    time: "09:00",
  },
  labels: [
    {
      id: 0,
      color: "red",
      name: "important",
    },
  ],
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

test("tasks.list: POST URL ends with tasks.list and body has token", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { tasks: [sampleListTask] } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const tasks = await client.tasksList();

  assert.equal(fetchMock.mock.calls.length, 1);
  const [input, init] = lastCall(fetchMock);
  const url = String(input);
  assert.ok(url.endsWith("tasks.list"), `expected URL to end with tasks.list, got ${url}`);
  assert.equal(url, `${TEAMLINE_API_BASE}tasks.list`);
  assert.equal(init?.method, "POST");
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("Content-Type"), "application/json");
  const body = JSON.parse(String(init?.body)) as { token: string };
  assert.equal(body.token, TEST_KEY);
  assert.deepEqual(tasks, [sampleListTask]);
});

test("tasks.list: optional params are passed in the JSON body", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { tasks: [sampleListTask] } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.tasksList({
    limit: 10,
    channel: "#general",
    list: "~inbox",
    user: "@batman",
    complete: true,
  });

  const init = lastCall(fetchMock)[1];
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(body.token, TEST_KEY);
  assert.equal(body.limit, 10);
  assert.equal(body.channel, "#general");
  assert.equal(body.list, "~inbox");
  assert.equal(body.user, "@batman");
  assert.equal(body.complete, true);
});

test("tasks.list: list without channel fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { tasks: [sampleListTask] } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.tasksList({ list: "~inbox" }),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /channel is required if list is present/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("tasks.create: name required fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { task: sampleCreatedTask } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.tasksCreate({ name: "" }),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /name is required/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("tasks.create: POST tasks.create and returns data.task", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { task: sampleCreatedTask } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const task = await client.tasksCreate({ name: "NaNaNaNa" });

  const [input, init] = lastCall(fetchMock);
  assert.ok(String(input).endsWith("tasks.create"));
  assert.equal(String(input), `${TEAMLINE_API_BASE}tasks.create`);
  assert.equal(init?.method, "POST");
  assert.deepEqual(task, sampleCreatedTask);
});

test("tasks.create: optional fields omitted when unset", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { task: sampleCreatedTask } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.tasksCreate({ name: "Buy milk" });

  const body = JSON.parse(String(lastCall(fetchMock)[1]?.body)) as Record<string, unknown>;
  assert.equal(body.token, TEST_KEY);
  assert.equal(body.name, "Buy milk");
  assert.equal("description" in body, false);
  assert.equal("assign" in body, false);
  assert.equal("channel" in body, false);
  assert.equal("list" in body, false);
  assert.equal("personal" in body, false);
  assert.equal("due" in body, false);
  assert.equal("notify" in body, false);
});

test("tasks.create: list without channel fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { task: sampleCreatedTask } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.tasksCreate({ name: "Buy milk", list: "~inbox" }),
    /channel is required if list is present/,
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("tasks.create: JSON encoding sends assign/notify as arrays", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { task: sampleCreatedTask } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.tasksCreate({
    name: "Buy milk",
    assign: ["@alfred", "alfred@batman.com"],
    notify: ["U0L8G1LTB"],
    personal: false,
  });

  const body = JSON.parse(String(lastCall(fetchMock)[1]?.body)) as Record<string, unknown>;
  assert.deepEqual(body.assign, ["@alfred", "alfred@batman.com"]);
  assert.deepEqual(body.notify, ["U0L8G1LTB"]);
  assert.equal(body.personal, false);
});

test("tasks.create: form encoding appends each assign/notify value", async () => {
  process.env.TEAMLINE_HTTP_ENCODING = "form";
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { task: sampleCreatedTask } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  await client.tasksCreate({
    name: "Buy milk",
    assign: ["@alfred", "alfred@batman.com"],
    notify: ["U0L8G1LTB"],
  });

  const init = lastCall(fetchMock)[1];
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("Content-Type"), "application/x-www-form-urlencoded");
  const params = new URLSearchParams(String(init?.body));
  assert.equal(params.get("token"), TEST_KEY);
  assert.equal(params.get("name"), "Buy milk");
  assert.deepEqual(params.getAll("assign"), ["@alfred", "alfred@batman.com"]);
  assert.deepEqual(params.getAll("notify"), ["U0L8G1LTB"]);
  assert.equal(params.has("description"), false);
});

test("tasks.complete: task id required fails before fetch", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({ ok: true, data: { tasks: sampleCompletedTask } }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.tasksComplete(""),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /task is required/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("tasks.complete: POST tasks.complete and parses data.tasks object", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({
      ok: true,
      data: { tasks: sampleCompletedTask },
    }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const task = await client.tasksComplete("ih9KKwhfbEudPPSco");

  const [input, init] = lastCall(fetchMock);
  assert.ok(String(input).endsWith("tasks.complete"));
  assert.equal(String(input), `${TEAMLINE_API_BASE}tasks.complete`);
  assert.equal(init?.method, "POST");
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(body.token, TEST_KEY);
  assert.equal(body.task, "ih9KKwhfbEudPPSco");
  assert.equal(Array.isArray(task), false);
  assert.equal(task.isComplete, true);
  assert.equal(task.id, "ih9KKwhfbEudPPSco");
  assert.deepEqual(task, sampleCompletedTask);
});

test("tasks.complete: live API data.task object is accepted", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({
      ok: true,
      data: { task: sampleCompletedTask },
    }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });
  const task = await client.tasksComplete("ih9KKwhfbEudPPSco");
  assert.equal(task.isComplete, true);
  assert.equal(task.id, "ih9KKwhfbEudPPSco");
});

test("tasks.complete: data.tasks array is rejected (official sample is an object)", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({
      ok: true,
      data: { tasks: [sampleCompletedTask] },
    }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.tasksComplete("ih9KKwhfbEudPPSco"),
    /data\.task\/data\.tasks was missing or not an object/,
  );
});

test("tasks.complete: ok:false error message does not include the key", async () => {
  const fetchMock = mock.fn(async () =>
    jsonResponse({
      ok: false,
      error: "invalid_auth",
      errorText: `Token ${TEST_KEY} is not valid`,
    }),
  );
  const client = new TeamlineClient({ fetch: fetchMock as unknown as typeof fetch });

  await assert.rejects(
    () => client.tasksComplete("ih9KKwhfbEudPPSco"),
    (err: unknown) => {
      assert.ok(err instanceof TeamlineError);
      assert.match(err.message, /invalid_auth/);
      assert.equal(err.message.includes(TEST_KEY), false);
      return true;
    },
  );
});
