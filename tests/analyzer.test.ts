import test from "node:test";
import assert from "node:assert/strict";
import { Octokit } from "@octokit/rest";
import { collectRepositoryContext } from "../src/lib/repository-context";
import { generateOverview, generateStructuredJson, geminiConfig, validateOverview } from "../src/lib/gemini";
import { analyzeRepository } from "../src/lib/analyzer";
import { POST } from "../src/app/api/overview/route";
import type { RepositoryContext } from "../src/types/repository";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const repoUrl = "https://github.com/example/demo";
const fixture = { "README.md": "# Demo\nRun npm start", "package.json": '{"dependencies":{"next":"16"},"scripts":{"start":"next start"}}', "src/index.ts": 'export const message = "hello";' };
function github(files: Record<string, string> = fixture, options: { empty?: boolean; truncated?: boolean; missingBlob?: boolean; oversizedMetadata?: boolean } = {}) {
  const calls: string[] = [];
  const blobs = Object.entries(files);
  const api = new Octokit({ log: { debug() {}, info() {}, warn() {}, error() {} }, request: { fetch: async (input: string) => {
    const path = new URL(input).pathname;
    calls.push(path);
    if (path.endsWith('/commits/main')) return options.empty ? json({}, 409) : json({ sha: "commit-sha", commit: { tree: { sha: "tree-sha" } } });
    if (path.endsWith('/git/trees/tree-sha')) return json({ truncated: options.truncated ?? false, tree: [
      { path: "src", type: "tree", sha: "folder" },
      ...blobs.map(([path, content], index) => ({ path, type: "blob", mode: "100644", sha: String(index), size: options.oversizedMetadata ? 60_000 : Buffer.byteLength(content) })),
    ] });
    if (path.includes('/git/blobs/')) {
      if (options.missingBlob) return json({}, 404);
      const content = blobs[Number(path.split('/').pop())][1];
      return json({ encoding: "base64", size: Buffer.byteLength(content), content: Buffer.from(content).toString('base64') });
    }
    if (path === '/repos/example/demo') return json({ name: "demo", owner: { login: "example" }, default_branch: "main", private: false });
    throw new Error(`Unexpected request: ${path}`);
  } } });
  return { api, calls };
}
const explanation = { title: "Demo", explanation: "A small demo.", sources: ["README.md"] };
const output = () => ({ summary: explanation, architecture: explanation, technologies: [explanation], directories: [], importantFiles: [explanation], gettingStarted: [explanation], readingOrder: [explanation], limitations: [] });
const envelope = (value: unknown = output(), finishReason = "STOP") => json({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] });
const config = { apiKey: "test-key", model: "gemini-test" };
async function context() { return collectRepositoryContext(repoUrl, github().api); }

test("collects tree, README, manifests, source files pinned to commit", async () => {
  const mock = github();
  const result = await collectRepositoryContext(repoUrl, mock.api);
  assert.equal(result.commitSha, "commit-sha");
  assert.equal(result.readme, "README.md");
  assert.deepEqual(result.manifests, ["package.json"]);
  assert.deepEqual(result.files.map(f => f.path), Object.keys(fixture));
  assert.equal(result.truncated, false);
  assert.ok(mock.calls.includes('/repos/example/demo/git/trees/tree-sha'));
  assert.equal(mock.calls.filter(p => p.includes('/git/blobs/')).length, 3);
});
test("excludes secret-like files and vendored directories", async () => {
  const result = await collectRepositoryContext(repoUrl, github({ ...fixture, '.env': 'secret', 'credentials.json': 'secret', 'node_modules/pkg/index.js': 'vendor' }).api);
  assert.equal(result.files.length, 3);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test("reports missing README and manifests", async () => {
  const result = await collectRepositoryContext(repoUrl, github({ 'main.py': 'print(1)' }).api);
  assert.equal(result.readme, null);
  assert.equal(result.manifests.length, 0);
  assert.equal(result.warnings.length, 2);
});
test("empty repository returns explicit 422", async () => {
  await assert.rejects(collectRepositoryContext(repoUrl, github({}, { empty: true }).api), { status: 422, code: "EMPTY_REPOSITORY" });
});
test("oversized files are skipped before fetching", async () => {
  const mock = github(fixture, { oversizedMetadata: true });
  const result = await collectRepositoryContext(repoUrl, mock.api);
  assert.equal(result.files.length, 0);
  assert.equal(result.truncated, true);
  assert.ok(!mock.calls.some(path => path.includes('/git/blobs/')));
});
test("respects file count and prioritizes manifests over source files", async () => {
  const result = await collectRepositoryContext(repoUrl, github({ ...Object.fromEntries(Array.from({length: 25}, (_, i) => [`src/file${i}.ts`, 'a'])), ...fixture }).api);
  assert.equal(result.files.length, 20);
  assert.equal(result.files[0].path, "README.md");
  assert.equal(result.files[1].path, "package.json");
  assert.equal(result.truncated, true);
});
test("respects aggregate byte limit", async () => {
  const result = await collectRepositoryContext(repoUrl, github(Object.fromEntries(Array.from({length: 10}, (_, i) => [`src/file${i}.ts`, 'a'.repeat(40_000)]))).api);
  assert.equal(result.files.length, 5);
  assert.ok(result.files.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0) <= 200_000);
});
test("records truncated tree and unavailable blobs", async () => {
  const result = await collectRepositoryContext(repoUrl, github(fixture, { truncated: true, missingBlob: true }).api);
  assert.equal(result.truncated, true);
  assert.ok(result.warnings.some(w => w.includes('incomplete repository tree')));
  assert.equal(result.files.length, 0);
});
test("skips binary content despite source extension", async () => {
  const result = await collectRepositoryContext(repoUrl, github({ 'binary.ts': '\u0000abc' }).api);
  assert.equal(result.files.length, 0);
  assert.equal(result.truncated, true);
});
test("mocked analysis requests structured JSON and validates result", async () => {
  const ctx = await context();
  let called = false;
  const result = await generateOverview(ctx, config, async (url, init) => {
    called = true;
    assert.ok(String(url).includes('/models/gemini-test:generateContent'));
    assert.ok(!String(url).includes(config.apiKey));
    const request = JSON.parse(init!.body as string);
    assert.equal(request.generationConfig.responseMimeType, 'application/json');
    assert.ok(request.systemInstruction.parts[0].text.includes('untrusted'));
    assert.equal(JSON.parse(request.contents[0].parts[0].text).commitSha, 'commit-sha');
    return envelope();
  });
  assert.equal(called, true);
  assert.deepEqual(result, output());
});
test("Gemma configuration is accepted and receives prompt-guided JSON instead of constrained decoding", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  try {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemma-4-31b-it";
    assert.deepEqual(geminiConfig(), { apiKey: "test-key", model: "gemma-4-31b-it" });
    const schema = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] };
    const result = await generateStructuredJson("question", "Answer from evidence.", schema, geminiConfig(), async (url, init) => {
      assert.ok(String(url).includes("/models/gemma-4-31b-it:generateContent"));
      const request = JSON.parse(init!.body as string);
      assert.equal(request.generationConfig.responseMimeType, undefined);
      assert.equal(request.generationConfig.responseJsonSchema, undefined);
      assert.equal(request.generationConfig.thinkingConfig.thinkingLevel, "minimal");
      assert.equal(request.generationConfig.maxOutputTokens, 8192);
      assert.match(request.systemInstruction.parts[0].text, /matching this schema/);
      assert.match(request.systemInstruction.parts[0].text, /\"answer\"/);
      return envelope({ answer: "A grounded answer." });
    });
    assert.deepEqual(result, { answer: "A grounded answer." });
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
  }
});
test("rejects fabricated source paths", async () => {
  const result = output();
  result.summary = { ...explanation, sources: ['does-not-exist.ts'] };
  assert.throws(() => validateOverview(result, { files: [], tree: [] } as unknown as RepositoryContext), { code: 'INVALID_AI_OUTPUT' });
});
test("rejects malformed output fields", async () => {
  const ctx = await context();
  assert.throws(() => validateOverview({ ...output(), technologies: 'not an array' }, ctx), { code: 'INVALID_AI_OUTPUT' });
});
for (const [status, code] of [[429, 'AI_RATE_LIMIT'], [403, 'AI_AUTH_ERROR'], [500, 'AI_PROVIDER_ERROR']] as const) {
  test(`sanitizes provider ${status}`, async () => {
    await assert.rejects(generateOverview(await context(), config, async () => json({ secret: 'provider details' }, status)), { code });
  });
}
test("handles provider timeout", async () => {
  await assert.rejects(generateOverview(await context(), config, async () => { throw new DOMException('timeout', 'TimeoutError'); }), { code: 'AI_TIMEOUT' });
});
test("handles incomplete output", async () => {
  await assert.rejects(generateOverview(await context(), config, async () => envelope(output(), 'MAX_TOKENS')), { code: 'INCOMPLETE_AI_OUTPUT' });
});
test("handles non-JSON model text", async () => {
  await assert.rejects(generateOverview(await context(), config, async () => json({ candidates: [{finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] }}] })), { code: 'INVALID_AI_OUTPUT' });
});
test("fails before network calls if AI is unconfigured", async () => {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    await assert.rejects(analyzeRepository(repoUrl), { code: 'AI_NOT_CONFIGURED' });
  } finally {
    if (key !== undefined) process.env.GEMINI_API_KEY = key;
    if (model !== undefined) process.env.GEMINI_MODEL = model;
  }
});

test("overview route rejects malformed JSON and invalid URL", async () => {
  for (const body of ['{', JSON.stringify({ repoUrl: 'https://evil.example/repo' })]) {
    const response = await POST(new Request('http://localhost/api/overview', { method: 'POST', body }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
  }
});
