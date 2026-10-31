import test from "node:test";
import assert from "node:assert/strict";
import { Octokit } from "@octokit/rest";
import { collectRepositoryContext } from "../src/lib/repository-context";
import { validateQuestion, validateAnswer, generateAnswer, createChatHandler } from "../src/lib/explainer";
import { POST } from "../src/app/api/chat/route";
import type { RepositoryContext } from "../src/types/repository";

const context: RepositoryContext = { repository: { owner: "example", name: "demo", defaultBranch: "main", description: null }, commitSha: "abc123", readme: null, manifests: [], tree: [{ path: "unread.ts", type: "file" }], files: [{ path: "src/auth.ts", content: 'export function authenticate() { return "session"; }', truncated: false }], truncated: true, warnings: ["Selected files only."] };
const config = { apiKey: "mock", model: "gemini-test" };
const answer = { answer: "Authentication is handled in src/auth.ts.", sources: ["src/auth.ts"], insufficientEvidence: false };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const request = (body: unknown) => new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) });
for (const value of [null, 3, "", "   ", "x".repeat(2001)]) test(`rejects invalid question ${typeof value}:${String(value).length}`, () => assert.throws(() => validateQuestion(value), { code: "INVALID_QUESTION" }));
test("accepts max-length question and trims whitespace", () => { assert.equal(validateQuestion(" x "), "x"); assert.equal(validateQuestion("x".repeat(2000)).length, 2000); });
test("validates citation and removes repeated sources", () => assert.deepEqual(validateAnswer({ ...answer, sources: ["src/auth.ts", "src/auth.ts"] }, context), answer));
for (const sources of [["missing.ts"], ["unread.ts"], ["https://evil.example/file"], []]) test(`rejects unsupported evidence ${sources}`, () => assert.throws(() => validateAnswer({ ...answer, sources }, context), { code: "INVALID_AI_OUTPUT" }));
test("allows explicit insufficient-evidence answer without sources", () => assert.equal(validateAnswer({ answer: "Not enough evidence in selected files.", sources: [], insufficientEvidence: true }, context).insufficientEvidence, true));
for (const value of [null, { ...answer, answer: "" }, { ...answer, insufficientEvidence: "false" }, { ...answer, sources: "src/auth.ts" }]) test(`rejects malformed answer ${JSON.stringify(value)}`, () => assert.throws(() => validateAnswer(value, context)));
test("passes question and untrusted context to mocked model", async () => {
  const result = await generateAnswer(context, "Where does authentication happen?", config, async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    const payload = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(payload.question, "Where does authentication happen?");
    assert.equal(payload.context.commitSha, "abc123");
    assert.match(body.systemInstruction.parts[0].text, /untrusted/);
    return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(answer) }] } }] });
  });
  assert.deepEqual(result, answer);
});
test("empty context returns insufficient evidence without calling provider", async () => {
  const result = await generateAnswer({ ...context, files: [] }, "How does the backend work?", config, async () => { throw new Error("must not call"); });
  assert.equal(result.insufficientEvidence, true);
});
test("rate limits and timeouts propagate sanitized failures", async () => {
  await assert.rejects(generateAnswer(context, "Explain auth", config, async () => json({ message: "secret" }, 429)), { code: "AI_RATE_LIMIT" });
  await assert.rejects(generateAnswer(context, "Explain auth", config, async () => { throw new DOMException("timeout", "TimeoutError"); }), { code: "AI_TIMEOUT" });
});
test("malformed model output is rejected", async () => {
  await assert.rejects(generateAnswer(context, "Explain auth", config, async () => json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json" }] } }] })), { code: "INVALID_AI_OUTPUT" });
});
test("chat handler wraps grounded answer with commit and coverage", async () => {
  const handler = createChatHandler(async (_repo, question) => ({ question: String(question), repository: context.repository, commitSha: context.commitSha, explanation: answer, coverage: { filePaths: ["src/auth.ts"], truncated: true, warnings: context.warnings } }));
  const response = await handler(request({ repoUrl: "https://github.com/example/demo", question: " Explain auth " }));
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.success, true); assert.equal(body.question, "Explain auth"); assert.equal(body.commitSha, "abc123"); assert.equal(body.coverage.truncated, true);
});
test("route validates malformed JSON, URLs, and questions before AI calls", async () => {
  for (const req of [new Request('http://localhost/api/chat', {method:'POST',body:'{'}), request({repoUrl:'bad',question:'Explain'}), request({repoUrl:'https://github.com/example/demo',question:''})]) {
    assert.equal((await POST(req)).status, 400);
  }
});
test("route reports missing AI configuration", async () => {
  const key = process.env.GEMINI_API_KEY;
  try { delete process.env.GEMINI_API_KEY; const response = await POST(request({repoUrl:'https://github.com/example/demo',question:'Explain authentication'})); assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED'); }
  finally { if (key !== undefined) process.env.GEMINI_API_KEY = key; }
});
test("question prioritizes auth files outside default selection budget", async () => {
  const paths = [...Array.from({length:25},(_,i)=>`src/file${i}.ts`), 'src/security/authentication.ts'];
  const api = new Octokit({ request: { fetch: async (input: string) => {
    const path = new URL(input).pathname;
    if (path.includes('/commits/')) return json({sha:'abc',commit:{tree:{sha:'tree'}}});
    if (path.includes('/git/trees/')) return json({tree: paths.map((path,i)=>({path,sha:String(i),type:'blob',mode:'100644',size:10})),truncated:false});
    if (path.includes('/git/blobs/')) return json({encoding:'base64',content:Buffer.from('source').toString('base64'),size:6});
    return json({name:'demo',owner:{login:'example'},default_branch:'main',private:false});
  } } });
  const baseline = await collectRepositoryContext('https://github.com/example/demo', api);
  const focused = await collectRepositoryContext('https://github.com/example/demo', api, 'Where does authentication happen?');
  assert.ok(!baseline.files.some(f=>f.path.endsWith('authentication.ts')));
  assert.equal(focused.files[0].path, 'src/security/authentication.ts');
  assert.equal(focused.files.length, 20);
});

test("provider overload returns actionable visitor message", async () => {
  await assert.rejects(generateAnswer(context, "Explain auth", config, async () => json({ message: "overloaded" }, 503)), { code: "AI_BUSY", status: 503 });
});
