import test from "node:test";
import assert from "node:assert/strict";
import { aiConfig, generateStructuredJson } from "../src/lib/gemini";

const config = { provider: "ollama" as const, apiKey: "test-secret", model: "cloud-model" };
const schema = { type: "object" };
const result = (content: unknown, done_reason = "stop") => Response.json({ done: true, done_reason, message: { content } });

test("Ollama Cloud configuration requires key and model, independent of Gemini", () => {
  const names = ["AI_PROVIDER", "OLLAMA_API_KEY", "OLLAMA_MODEL"] as const;
  const old = names.map(name => process.env[name]);
  try {
    process.env.AI_PROVIDER = "ollama";
    process.env.OLLAMA_API_KEY = "test-secret";
    process.env.OLLAMA_MODEL = "cloud-model";
    assert.deepEqual(aiConfig(), config);
    delete process.env.OLLAMA_API_KEY;
    assert.throws(aiConfig, { code: "AI_NOT_CONFIGURED" });
    process.env.OLLAMA_API_KEY = "test-secret";
    delete process.env.OLLAMA_MODEL;
    assert.throws(aiConfig, { code: "AI_NOT_CONFIGURED" });
    process.env.AI_PROVIDER = "unknown";
    assert.throws(aiConfig, { code: "AI_NOT_CONFIGURED" });
  } finally {
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});

test("shared generation dispatches to Ollama with server auth and prompt schema", async () => {
  const value = await generateStructuredJson("evidence", "instruction", schema, config, async (url, init) => {
    assert.equal(url, "https://ollama.com/api/chat");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-secret");
    assert.equal(init?.redirect, "error");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, config.model);
    assert.equal(body.stream, false);
    assert.equal(body.format, undefined);
    assert.ok(body.messages[0].content.includes(JSON.stringify(schema)));
    assert.equal(body.messages[1].content, "evidence");
    return result('```json\n{"ok":true}\n```');
  });
  assert.deepEqual(value, { ok: true });
});

test("Ollama rejects invalid and truncated output", async () => {
  for (const content of ["not json", null, "x".repeat(100_001)]) {
    await assert.rejects(generateStructuredJson("", "", schema, config, async () => result(content)), { code: "INVALID_AI_OUTPUT" });
  }
  await assert.rejects(generateStructuredJson("", "", schema, config, async () => result("{}", "length")), { code: "INCOMPLETE_AI_OUTPUT" });
});

test("Ollama maps provider errors without leaking upstream content", async () => {
  for (const [status, code] of [[401, "AI_AUTH_ERROR"], [403, "AI_AUTH_ERROR"], [429, "AI_RATE_LIMIT"], [503, "AI_BUSY"], [500, "AI_PROVIDER_ERROR"]] as const) {
    await assert.rejects(generateStructuredJson("", "", schema, config, async () => new Response("private provider detail", { status })), { code });
  }
  await assert.rejects(generateStructuredJson("", "", schema, config, async () => { throw new DOMException("timeout", "TimeoutError"); }), { code: "AI_TIMEOUT" });
  await assert.rejects(generateStructuredJson("", "", schema, config, async () => { throw new Error("network"); }), { code: "AI_PROVIDER_ERROR" });
});
