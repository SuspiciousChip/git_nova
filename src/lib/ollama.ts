import { ApiError } from "./api";

export async function generateOllamaJson(
  input: string,
  instruction: string,
  schema: object,
  config: { apiKey: string; model: string },
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  try {
    const response = await fetcher("https://ollama.com/api/chat", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(90_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          // Cloud does not support schema-constrained output. Callers validate the parsed result.
          { role: "system", content: `${instruction}\nReturn exactly one JSON object, without markdown fences or commentary, matching this schema: ${JSON.stringify(schema)}` },
          { role: "user", content: input },
        ],
        options: { temperature: 0, num_predict: 8192 },
      }),
    });
    if (response.status === 401 || response.status === 403) throw new ApiError(503, "AI_AUTH_ERROR", "GitNova AI is temporarily unavailable. Please try again later.");
    if (response.status === 429) throw new ApiError(503, "AI_RATE_LIMIT", "The shared AI quota is temporarily exhausted. Please try again later.");
    if (response.status === 503) throw new ApiError(503, "AI_BUSY", "AI is experiencing high demand. Please try again in a moment.");
    if (!response.ok) throw new ApiError(502, "AI_PROVIDER_ERROR", "The AI service could not complete your request. Please try again later.");
    const body = await response.json();
    if (body?.done !== true || body.done_reason !== "stop") throw new ApiError(502, "INCOMPLETE_AI_OUTPUT", "AI analysis was blocked or incomplete. Please try again.");
    const content = body.message?.content;
    const invalid = () => new ApiError(502, "INVALID_AI_OUTPUT", "The AI returned invalid structured output. Please try again.");
    if (typeof content !== "string" || content.length > 100_000) throw invalid();
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content.trim());
    try { return JSON.parse(fenced ? fenced[1] : content); } catch { throw invalid(); }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new ApiError(504, "AI_TIMEOUT", "AI analysis timed out. Try again later.");
    throw new ApiError(502, "AI_PROVIDER_ERROR", "Could not read a response from the AI provider.");
  }
}
