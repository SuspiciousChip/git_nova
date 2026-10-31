import test from "node:test";
import assert from "node:assert/strict";
import { createDuplicateDetectorHandler, detectDuplicates, validateDuplicateDetectorInput, validateDuplicateMatches, type DuplicateIssue } from "../src/lib/duplicate-detector";

const input = { repoUrl: "https://github.com/example/demo", issueNumber: 12 };
const target: DuplicateIssue = { number: 12, title: "Login fails after session expiry", body: "Users are logged out unexpectedly.", url: "https://github.com/example/demo/issues/12", labels: ["bug"], createdAt: "2026-10-01T00:00:00Z" };
const candidate: DuplicateIssue = { number: 19, title: "Session timeout sends users back to login", body: "After an idle timeout the session is lost.", url: "https://github.com/example/demo/issues/19", labels: ["bug"], createdAt: "2026-10-02T00:00:00Z" };
const config = { apiKey: "mock", model: "gemini-test" };

test("validates repository and issue number", () => { assert.deepEqual(validateDuplicateDetectorInput(input), input); assert.deepEqual(validateDuplicateDetectorInput({ ...input, issueNumber: "12" }), input); assert.throws(() => validateDuplicateDetectorInput({ ...input, issueNumber: 0 }), { code: "INVALID_ISSUE_NUMBER" }); });
test("detects and verifies duplicate issue matches", async () => {
  const result = await detectDuplicates(input, async () => ({ repository: { owner: "example", name: "demo" }, target, candidates: [candidate] }), async (_url, init) => { const request = JSON.parse(init!.body as string); const body = JSON.parse(request.contents[0].parts[0].text); assert.equal(body.target.number, 12); assert.match(request.systemInstruction.parts[0].text, /untrusted data/); return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ duplicates: [{ issueNumber: 19, confidence: "high", reason: "Both describe the same session-expiry login failure." }] }) }] } }] })); }, config);
  assert.equal(result.duplicates[0].number, 19); assert.equal(result.duplicates[0].confidence, "high"); assert.equal(result.scanned, 1);
});
test("rejects fabricated duplicate issue numbers", () => { assert.throws(() => validateDuplicateMatches({ duplicates: [{ issueNumber: 999, confidence: "high", reason: "Invented" }] }, [candidate]), { code: "INVALID_AI_OUTPUT" }); });
test("duplicate handler validates before detector call", async () => { let calls = 0; const handler = createDuplicateDetectorHandler(async value => { calls++; return { repository: { owner: "example", name: "demo" }, target, scanned: 0, duplicates: [], message: null }; }); const good = await handler(new Request("http://localhost/api/issues/duplicates", { method: "POST", body: JSON.stringify(input) })); assert.equal(good.status, 200); assert.equal((await handler(new Request("http://localhost/api/issues/duplicates", { method: "POST", body: JSON.stringify({ ...input, issueNumber: 0 }) }))).status, 400); assert.equal(calls, 1); });
