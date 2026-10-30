import { handle } from "@/lib/api";
import { createGithubService } from "@/lib/github";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return handle(() => createGithubService().issues(params.get("repoUrl"), params.has("page") ? Number(params.get("page")) : 1));
}
