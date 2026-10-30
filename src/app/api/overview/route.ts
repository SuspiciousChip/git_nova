import { handle, readBody } from "@/lib/api";
import { analyzeRepository } from "@/lib/analyzer";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  return handle(async () => analyzeRepository((await readBody(request)).repoUrl));
}
