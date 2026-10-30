import { handle } from "@/lib/api";
import { collectRepositoryContext } from "@/lib/repository-context";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function GET(request: Request) {
  return handle(async () => ({ context: await collectRepositoryContext(new URL(request.url).searchParams.get("repoUrl")) }));
}
