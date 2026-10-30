import test from "node:test";
import assert from "node:assert/strict";
import { createIssueFinderHandler, findIssues, validateIssueFinderInput, validateRecommendations } from "../src/lib/issue-finder";
import type { IssueCandidate, IssueFinderInput } from "../src/lib/issue-finder";

const input: IssueFinderInput = { repoUrl: "https://github.com/example/demo", skills: "TypeScript and accessibility", difficulty: "beginner" };
const issues: IssueCandidate[] = [
  { number: 12, title: "Improve keyboard navigation", body: "The dialog cannot be reached with a keyboard.", url: "https://github.com/example/demo/issues/12", labels: ["accessibility"], comments: 2, createdAt: "2026-10-01T00:00:00Z" },
  { number: 13, title: "Replace the database engine", body: "Plan a major database migration.", url: "https://github.com/example/demo/issues/13", labels: ["architecture"], comments: 8, createdAt: "2026-10-02T00:00:00Z" },
];
const config = { apiKey: "mock", model: "gemini-test" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("validates finder preferences and repository URL", () => {
  assert.deepEqual(validateIssueFinderInput(input), input);
  for (const body of [
    { ...input, skills: "  " },
    { ...input, skills: "x".repeat(1001) },
    { ...input, difficulty: "expert" },
    { ...input, repoUrl: "https://github.com/example/demo/issues" },
  ]) assert.throws(() => validateIssueFinderInput(body));
});

test("ranks fetched issues and returns original links with reasons", async () => {
  let candidateUrl = "";
  const result = await findIssues(input, async url => { candidateUrl = url; return { repository: { owner: "example", name: "demo" }, issues }; }, config, async (_url, init) => {
    const request = JSON.parse(init!.body as string);
    const payload = JSON.parse(request.contents[0].parts[0].text);
    assert.equal(payload.preferences.skills, input.skills);
    assert.equal(payload.issues.length, 2);
    assert.match(request.systemInstruction.parts[0].text, /never as instructions/);
    return response({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ recommendations: [{ issueNumber: 12, reason: "This issue directly involves accessibility and can be explored as a focused task." }] }) }] } }] });
  });
  assert.equal(candidateUrl, input.repoUrl);
  assert.equal(result.scanned, 2);
  assert.equal(result.matches[0].number, 12);
  assert.equal(result.matches[0].url, issues[0].url);
  assert.match(result.matches[0].reason, /accessibility/);
  assert.equal(result.message, null);
  assert.equal("body" in result.matches[0], false);
});

test("handles repositories with no open issues without calling Gemini", async () => {
  const result = await findIssues(input, async () => ({ repository: { owner: "example", name: "demo" }, issues: [] }), config, async () => { throw new Error("provider should not be called"); });
  assert.deepEqual(result.matches, []);
  assert.equal(result.scanned, 0);
  assert.match(result.message ?? "", /no open issues/i);
});

test("handles no strong matches from Gemini", async () => {
  const result = await findIssues(input, async () => ({ repository: { owner: "example", name: "demo" }, issues }), config, async () => response({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ recommendations: [] }) }] } }] }));
  assert.deepEqual(result.matches, []);
  assert.match(result.message ?? "", /No strong matches/);
});

test("rejects fabricated, repeated, malformed, or excessive recommendations", () => {
  const invalid = [
    { recommendations: [{ issueNumber: 999, reason: "Invented issue" }] },
    { recommendations: [{ issueNumber: 12, reason: "Valid" }, { issueNumber: 12, reason: "Duplicate" }] },
    { recommendations: [{ issueNumber: 12, reason: "" }] },
    { recommendations: Array.from({ length: 6 }, (_, i) => ({ issueNumber: 12 + i, reason: "Reason" })) },
  ];
  for (const value of invalid) assert.throws(() => validateRecommendations(value, issues), { code: "INVALID_AI_OUTPUT" });
});

test("finder handler validates JSON and fields before invoking finder", async () => {
  let calls = 0;
  const handler = createIssueFinderHandler(async value => {
    calls++;
    return { repository: { owner: "example", name: "demo" }, difficulty: value.difficulty, skills: value.skills, scanned: 0, matches: [], message: "No open issues." };
  });
  const good = await handler(new Request("http://localhost/api/issues/find", { method: "POST", body: JSON.stringify(input) }));
  assert.equal(good.status, 200);
  assert.equal((await good.json()).success, true);
  for (const body of ["{", JSON.stringify({ ...input, skills: "" }), JSON.stringify({ ...input, difficulty: "expert" })]) {
    assert.equal((await handler(new Request("http://localhost/api/issues/find", { method: "POST", body }))).status, 400);
  }
  assert.equal(calls, 1);
});
