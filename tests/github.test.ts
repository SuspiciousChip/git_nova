import test from "node:test";
import assert from "node:assert/strict";
import { Octokit } from "@octokit/rest";
import { createGithubService, parseRepoUrl } from "../src/lib/github";
import { handle, readBody } from "../src/lib/api";

const metadata = { name: "demo", owner: { login: "user" }, private: false, stargazers_count: 42, open_issues_count: 3, default_branch: "main" };
function service(respond: (path: string) => Response) {
  return createGithubService(new Octokit({ request: { fetch: async (url: string) => respond(new URL(url).pathname) } }));
}
const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

test("accepts repository URL and .git suffix", () => {
  assert.deepEqual(parseRepoUrl(" https://github.com/user/demo.git/ "), { owner: "user", repo: "demo" });
});
for (const value of [null, 12, "https://evil.com/user/demo", "http://github.com/user/demo", "https://github.com/user/demo/tree/main", "https://a@github.com/user/demo", "https://github.com/user/demo?q=x", "https://github.com/user/.git", "https://github.com:444/user/demo"]) {
  test(`rejects invalid URL ${value}`, () => assert.throws(() => parseRepoUrl(value)));
}
test("maps repository metadata", async () => {
  const result = await service(() => json(metadata)).repository("https://github.com/user/demo");
  assert.equal(result.stars, 42);
  assert.equal(result.owner, "user");
});
test("blocks private repository even when token can access it", async () => {
  await assert.rejects(service(() => json({ ...metadata, private: true })).repository("https://github.com/user/demo"), { code: "PUBLIC_REPOSITORIES_ONLY" });
});
test("decodes Unicode README", async () => {
  const api = service(path => json(path.endsWith("/readme") ? { encoding: "base64", content: Buffer.from("# Hello 🚀").toString("base64"), path: "README.md" } : metadata));
  assert.equal((await api.readme("https://github.com/user/demo"))?.content, "# Hello 🚀");
});
test("missing README returns null", async () => {
  const api = service(path => path.endsWith("/readme") ? json({}, 404) : json(metadata));
  assert.equal(await api.readme("https://github.com/user/demo"), null);
});
test("missing repository is not mistaken for missing README", async () => {
  await assert.rejects(service(() => json({}, 404)).readme("https://github.com/user/demo"), { status: 404 });
});
test("filters pull requests and preserves GitHub pagination", async () => {
  const api = service(path => path.endsWith("/issues") ? json([
    { number: 1, title: "bug", labels: [{ name: "bug" }], body: null },
    { number: 2, pull_request: {}, labels: [] },
  ], 200, { link: '<https://api.github.com/repos/user/demo/issues?page=2>; rel="next"' }) : json(metadata));
  const result = await api.issues("https://github.com/user/demo");
  assert.equal(result.issues.length, 1);
  assert.deepEqual(result.issues[0].labels, ["bug"]);
  assert.equal(result.nextPage, 2);
});
test("rejects invalid pagination before network call", async () => {
  await assert.rejects(service(() => { throw new Error("must not fetch"); }).issues("https://github.com/user/demo", 1.5), { code: "INVALID_PAGE" });
});
for (const [status, expected] of [[401, 502], [403, 503], [429, 503], [500, 502]]) {
  test(`sanitizes GitHub ${status} error`, async () => {
    const response = await handle(() => service(() => json({ message: "secret upstream detail" }, status)).repository("https://github.com/user/demo"));
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes("secret upstream detail"));
  });
}
test("malformed body produces 400", async () => {
  const response = await handle(() => readBody(new Request("http://localhost", { method: "POST", body: "{" })));
  assert.equal(response.status, 400);
});
test("unexpected errors do not leak details", async () => {
  const response = await handle(async () => { throw new Error("secret"); });
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("secret"));
});
