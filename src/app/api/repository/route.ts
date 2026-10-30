import { handle, readBody } from "@/lib/api";
import { createGithubService } from "@/lib/github";
export async function POST(request: Request) {
  return handle(async () => ({ repository: await createGithubService().repository((await readBody(request)).repoUrl) }));
}
