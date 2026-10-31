import test from "node:test";
import assert from "node:assert/strict";
import { geminiConfig, generateStructuredJson } from "../src/lib/gemini";
import { generateAnswer } from "../src/lib/explainer";
import type { RepositoryContext } from "../src/types/repository";
const config = { apiKey: "mock", model: "gemma-4-26b-a4b-it" };
const response = (text: string) => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }] }), { headers: { "Content-Type": "application/json" } });
test("configuration accepts both supported hosted Gemma models", () => {
  const oldKey = process.env.GEMINI_API_KEY, oldModel = process.env.GEMINI_MODEL;
  try {
    process.env.GEMINI_API_KEY = 'mock';
    for (const model of ['gemma-4-26b-a4b-it','gemma-4-31b-it']) { process.env.GEMINI_MODEL = model; assert.equal(geminiConfig().model, model); }
    process.env.GEMINI_MODEL='gemma-unknown'; assert.throws(geminiConfig, {code:'AI_NOT_CONFIGURED'});
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = oldModel;
  }
});
test("Gemma requests prompt-based JSON and minimal thinking", async () => {
  const result = await generateStructuredJson('input', 'instruction', {type:'object'}, config, async (url, options) => {
    assert.ok(String(url).includes('gemma-4-26b-a4b-it'));
    const body=JSON.parse(options!.body as string);
    assert.equal(body.generationConfig.responseJsonSchema, undefined);
    assert.equal(body.generationConfig.responseMimeType, undefined);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
    assert.match(body.systemInstruction.parts[0].text, /matching this schema/);
    return response('{"answer":"hello"}');
  });
  assert.deepEqual(result, {answer:'hello'});
});
test("Gemma accepts a single JSON fence but rejects surrounding prose", async () => {
  assert.deepEqual(await generateStructuredJson('input','instruction',{},config,async()=>response('```json\n{"answer":"hello"}\n```')), {answer:'hello'});
  await assert.rejects(generateStructuredJson('input','instruction',{},config,async()=>response('Here it is: {"answer":"hello"}')), {code:'INVALID_AI_OUTPUT'});
});
test("Gemma answers still reject fabricated citations", async () => {
  const ctx = { files: [{path:'README',content:'Hello',truncated:false}], tree: [] } as unknown as RepositoryContext;
  await assert.rejects(generateAnswer(ctx,'Explain this',config,async()=>response(JSON.stringify({answer:'A project',sources:['fake.ts'],insufficientEvidence:false}))), {code:'INVALID_AI_OUTPUT'});
});
