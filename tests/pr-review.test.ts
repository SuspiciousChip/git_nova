import test from "node:test";
import assert from "node:assert/strict";
import { createPullRequestReviewHandler, reviewPullRequest, validatePullRequestInput, validateReview, type PullRequestPayload } from "../src/lib/pr-review";

const input = { repoUrl: "https://github.com/example/demo", pullNumber: 42 };
const payload: PullRequestPayload = {
  repository: { owner: "example", name: "demo" },
  pullRequest: { number: 42, title: "Fix auth", author: "octocat", url: "https://github.com/example/demo/pull/42", base: "main", head: "fix-auth", changedFiles: 1, additions: 2, deletions: 0 },
  files: [{ filename: "src/auth.ts", status: "modified", additions: 2, deletions: 0, patch: "@@ -4,0 +5,2 @@\n+const token = readToken();\n+return verify(token);", changedLines: new Set([5, 6]), url: "https://github.com/example/demo/blob/fix/src/auth.ts" }],
};
const config = { apiKey: "mock", model: "gemini-test" };
const response = (data: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(data) }] } }] }));

test("validates repository and pull request number", () => {
  assert.deepEqual(validatePullRequestInput(input), input);
  assert.deepEqual(validatePullRequestInput({ ...input, pullNumber: "42" }), input);
  assert.throws(() => validatePullRequestInput({ ...input, pullNumber: 0 }), { code: "INVALID_PULL_NUMBER" });
  assert.throws(() => validatePullRequestInput({ ...input, repoUrl: "https://github.com/example/demo/pull/42" }));
});

test("reviews a pull request and grounds findings in added lines", async () => {
  const result = await reviewPullRequest(input, async () => payload, async (_url, init) => {
    const request = JSON.parse(init!.body as string);
    const reviewPayload = JSON.parse(request.contents[0].parts[0].text);
    assert.equal(reviewPayload.files[0].filename, "src/auth.ts");
    assert.match(request.systemInstruction.parts[0].text, /untrusted data/);
    return response({ summary: "The token validation change needs a failure path.", verdict: "request_changes", findings: [{ severity: "high", title: "Handle invalid tokens", explanation: "The new verification path can throw without returning a safe authentication error.", file: "src/auth.ts", line: 6, suggestion: "Catch validation failures and return the existing unauthorized response." }] });
  }, config);
  assert.equal(result.verdict, "request_changes");
  assert.equal(result.findings[0].file, "src/auth.ts");
  assert.equal(result.findings[0].line, 6);
});

test("rejects fabricated review citations", () => {
  assert.throws(() => validateReview({ summary: "Review", verdict: "comment", findings: [{ severity: "high", title: "Fake", explanation: "No", file: "src/other.ts", line: 2, suggestion: "Fix" }] }, payload.files), { code: "INVALID_AI_OUTPUT" });
  assert.throws(() => validateReview({ summary: "Review", verdict: "comment", findings: [{ severity: "high", title: "Wrong line", explanation: "No", file: "src/auth.ts", line: 4, suggestion: "Fix" }] }, payload.files), { code: "INVALID_AI_OUTPUT" });
});

test("review handler validates input before calling reviewer", async () => {
  let calls = 0;
  const handler = createPullRequestReviewHandler(async value => { calls++; return { ...payload, changedFiles: payload.files.map(file => file.filename), summary: "ok", verdict: "approve", findings: [] }; });
  const good = await handler(new Request("http://localhost/api/pr/review", { method: "POST", body: JSON.stringify(input) }));
  assert.equal(good.status, 200);
  assert.equal((await good.json()).success, true);
  assert.equal((await handler(new Request("http://localhost/api/pr/review", { method: "POST", body: JSON.stringify({ ...input, pullNumber: 0 }) }))).status, 400);
  assert.equal(calls, 1);
});
