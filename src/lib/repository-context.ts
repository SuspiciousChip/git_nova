import { ApiError } from "./api";
import { createGithubService, githubCall, githubClient, parseRepoUrl } from "./github";
import type { RepositoryContext } from "../types/repository";

export const CONTEXT_LIMITS = { files: 20, fileBytes: 50_000, totalBytes: 200_000, treeEntries: 1000 };
const manifest = /(?:^|\/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|go\.mod|Cargo\.toml|Gemfile|composer\.json|pom\.xml|build\.gradle(?:\.kts)?|.*\.csproj)$/i;
const readme = /(?:^|\/)readme(?:\.(?:md|rst|txt|markdown))?$/i;
const excluded = /(?:^|\/)(?:node_modules|vendor|dist|build|coverage|\.git|\.next|__pycache__|\.venv|venv|\.aws|\.ssh)(?:\/|$)|(?:^|\/)(?:\.env[^/]*|[^/]*(?:secret|credential)[^/]*|id_rsa|id_ed25519)(?:\/|$)|\.(?:pem|key|p12|pfx)$/i;
const source = /\.(?:[cm]?[jt]sx?|py|go|rs|rb|java|kt|cs|php|swift|c|h|cpp|vue|svelte|md|toml|json|ya?ml)$/i;
function rank(path: string) {
  if (/^readme(?:\.|$)/i.test(path)) return 0;
  if (manifest.test(path)) return 1;
  if (readme.test(path)) return 2;
  if (/(?:^|\/)(?:main|index|app|server|page|layout|cli)\./i.test(path)) return 3;
  return 4;
}

export async function collectRepositoryContext(input: unknown, api = githubClient(), question = ""): Promise<RepositoryContext> {
  const terms = question.toLowerCase().match(/[a-z0-9_]{3,}/g)?.slice(0, 40) ?? [];
  if (terms.some(term => /auth|login|session/.test(term))) terms.push("auth", "login", "session", "middleware", "token");
  if (terms.some(term => /backend|server/.test(term))) terms.push("server", "api", "routes", "handler", "controller");
  const relevance = (path: string) => terms.filter(term => path.toLowerCase().includes(term)).length;
  const priority = (path: string) => rank(path) <= 1 ? rank(path) : relevance(path) ? 2 : rank(path) + 1;
  const ref = parseRepoUrl(input);
  const repo = await createGithubService(api).repository(input);
  const { data: commit } = await githubCall(() => api.repos.getCommit({ ...ref, ref: repo.defaultBranch }));
  const { data: tree } = await githubCall(() => api.git.getTree({ ...ref, tree_sha: commit.commit.tree.sha, recursive: "1" }));
  const warnings: string[] = [];
  const entries = tree.tree.filter(entry => entry.path && !excluded.test(entry.path));
  const candidates = entries.filter(entry => entry.type === "blob" && entry.mode !== "120000" && entry.sha && (readme.test(entry.path!) || manifest.test(entry.path!) || source.test(entry.path!)))
    .sort((a, b) => priority(a.path!) - priority(b.path!) || relevance(b.path!) - relevance(a.path!) || a.path!.split("/").length - b.path!.split("/").length || a.path!.localeCompare(b.path!));
  // Skip oversized blobs before fetching; do not download large files just to truncate them.
  const eligible = candidates.filter(entry => typeof entry.size === "number" && entry.size <= CONTEXT_LIMITS.fileBytes);
  let budget = CONTEXT_LIMITS.totalBytes;
  const selected = eligible.filter(entry => {
    if (entry.size! > budget) return false;
    budget -= entry.size!;
    return true;
  }).slice(0, CONTEXT_LIMITS.files);
  let truncated = Boolean(tree.truncated) || entries.length > CONTEXT_LIMITS.treeEntries || selected.length < candidates.length;
  if (tree.truncated) warnings.push("GitHub returned an incomplete repository tree.");
  if (entries.length > CONTEXT_LIMITS.treeEntries) warnings.push("Folder structure is limited to 1000 entries.");
  if (selected.length < candidates.length) warnings.push("Some candidate files were omitted due to file-count or byte limits.");
  const files: RepositoryContext["files"] = [];
  // Bounded batches avoid serial timeouts on large repos without flooding GitHub.
  for (let offset = 0; offset < selected.length; offset += 4) {
    const batch = await Promise.all(selected.slice(offset, offset + 4).map(async entry => {
      try {
        const { data } = await githubCall(() => api.git.getBlob({ ...ref, file_sha: entry.sha! }));
        if (data.encoding !== "base64" || (data.size ?? 0) > CONTEXT_LIMITS.fileBytes) return null;
        const bytes = Buffer.from(data.content, "base64");
        if (bytes.length > CONTEXT_LIMITS.fileBytes || bytes.includes(0)) return null;
        let content: string;
        try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
        return { path: entry.path!, content, truncated: false };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }));
    for (let i = 0; i < batch.length; i++) {
      if (batch[i]) files.push(batch[i]!);
      else { truncated = true; warnings.push(`Skipped unreadable or unavailable file: ${selected[offset + i].path}`); }
    }
  }
  // Enforce the aggregate limit on actual decoded bytes as well as tree metadata.
  let actualBytes = 0;
  const boundedFiles = files.filter(file => {
    const size = Buffer.byteLength(file.content);
    if (actualBytes + size > CONTEXT_LIMITS.totalBytes) { truncated = true; return false; }
    actualBytes += size;
    return true;
  });
  if (boundedFiles.length !== files.length) warnings.push("Decoded file contents exceeded the total byte limit.");
  const readmeFile = boundedFiles.find(file => readme.test(file.path));
  const manifests = boundedFiles.filter(file => manifest.test(file.path)).map(file => file.path);
  if (!readmeFile) warnings.push("No readable README was included.");
  if (!manifests.length) warnings.push("No supported dependency manifest was included.");
  if (!boundedFiles.length) warnings.push("No readable source files were included; analysis is limited to metadata and structure.");
  return {
    repository: { owner: repo.owner, name: repo.name, defaultBranch: repo.defaultBranch, description: repo.description ?? null },
    commitSha: commit.sha,
    tree: entries.filter(entry => entry.type === "blob" || entry.type === "tree").slice(0, CONTEXT_LIMITS.treeEntries)
      .map(entry => ({ path: entry.path!, type: entry.type === "tree" ? "directory" : "file" })),
    readme: readmeFile?.path ?? null, manifests, files: boundedFiles, truncated, warnings,
  };
}
