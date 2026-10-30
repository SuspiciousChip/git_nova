export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function handle(action: () => Promise<unknown>) {
  try {
    return Response.json({ success: true, ...await action() as object });
  } catch (error) {
    const known = error instanceof ApiError;
    return Response.json({ success: false, error: {
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "An unexpected error occurred.",
    } }, { status: known ? error.status : 500 });
  }
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Send a JSON object containing repoUrl.");
  }
}
