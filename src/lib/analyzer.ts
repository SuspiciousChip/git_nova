import { collectRepositoryContext } from "./repository-context";
import { generateOverview, geminiConfig } from "./gemini";
import { parseRepoUrl } from "./github";

export async function analyzeRepository(repoUrl: unknown) {
  parseRepoUrl(repoUrl);
  // Fail before consuming GitHub quota when AI credentials are not configured.
  const config = geminiConfig();
  const context = await collectRepositoryContext(repoUrl);
  const overview = await generateOverview(context, config);
  return {
    repository: context.repository, commitSha: context.commitSha, overview,
    coverage: { filePaths: context.files.map(file => file.path), readme: context.readme,
      manifests: context.manifests, treeEntries: context.tree.length,
      truncated: context.truncated, warnings: context.warnings },
  };
}
