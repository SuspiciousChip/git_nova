import { handle } from "@/lib/api";
import { createGithubService } from "@/lib/github";
export async function GET(request: Request) {
  return handle(async () => ({ readme: await createGithubService().readme(new URL(request.url).searchParams.get("repoUrl")) }));
}
