import { Octokit } from "@octokit/rest";
import { ApiError } from "./api";

export function parseRepoUrl(value: unknown) {
  const invalid = () => new ApiError(400, "INVALID_REPOSITORY_URL", "Use https://github.com/owner/repository.");
  if (typeof value !== "string") throw invalid();
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw invalid(); }
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) throw invalid();
  const match = /^\/([a-z\d](?:[a-z\d-]{0,38}))\/([a-z\d_.-]+)\/?$/i.exec(url.pathname);
  if (!match) throw invalid();
  const repo = match[2].replace(/\.git$/, "");
  if (!repo || repo === "." || repo === "..") throw invalid();
  return { owner: match[1], repo };
}

export function githubClient() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN || undefined, request: { timeout: 10000 }, userAgent: "GitNova/0.1" });
}

export async function githubCall<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) {
    if (error instanceof ApiError) throw error;
    const status = (error as { status?: number }).status;
    if (status === 409) throw new ApiError(422, "EMPTY_REPOSITORY", "This repository has no commits to analyze.");
    if (status === 404) throw new ApiError(404, "NOT_FOUND", "Repository or resource not found.");
    if (status === 401) throw new ApiError(502, "GITHUB_AUTH_ERROR", "Repository access is temporarily unavailable. Please try again later.");
    if (status === 403 || status === 429) throw new ApiError(503, "GITHUB_UNAVAILABLE", "GitHub denied this request or its rate limit was reached. Try again later.");
    throw new ApiError(502, "GITHUB_ERROR", "Could not retrieve data from GitHub. Try again later.");
  }
}

export function createGithubService(api = githubClient()) {
  async function repository(input: unknown) {
    const ref = parseRepoUrl(input);
    const { data } = await githubCall(() => api.repos.get(ref));
    if (data.private) throw new ApiError(403, "PUBLIC_REPOSITORIES_ONLY", "Only public repositories are supported.");
    return { name: data.name, owner: data.owner.login, description: data.description,
      language: data.language, stars: data.stargazers_count, openIssues: data.open_issues_count,
      url: data.html_url, defaultBranch: data.default_branch };
  }
  async function readme(input: unknown) {
    await repository(input);
    try {
      const { data } = await githubCall(() => api.repos.getReadme(parseRepoUrl(input)));
      if (data.encoding !== "base64") throw new ApiError(502, "README_ENCODING", "Unsupported README encoding.");
      return { path: data.path, content: Buffer.from(data.content, "base64").toString("utf8"), url: data.html_url };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
  async function issues(input: unknown, page = 1) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new ApiError(400, "INVALID_PAGE", "page must be an integer from 1 to 1000.");
    await repository(input);
    const response = await githubCall(() => api.issues.listForRepo({ ...parseRepoUrl(input), state: "open", per_page: 30, page }));
    return { issues: response.data.filter(issue => !issue.pull_request).map(issue => ({
      number: issue.number, title: issue.title, body: issue.body ?? "", url: issue.html_url,
      labels: issue.labels.map(label => typeof label === "string" ? label : label.name ?? ""),
      comments: issue.comments, createdAt: issue.created_at,
    })), page, nextPage: response.headers.link?.includes('rel="next"') ? page + 1 : null };
  }
  return { repository, readme, issues };
}
