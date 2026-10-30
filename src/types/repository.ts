export interface RepositoryContext {
  repository: { owner: string; name: string; defaultBranch: string; description: string | null };
  commitSha: string;
  tree: Array<{ path: string; type: "file" | "directory" }>;
  readme: string | null;
  manifests: string[];
  files: Array<{ path: string; content: string; truncated: boolean }>;
  truncated: boolean;
  warnings: string[];
}

export interface Explanation {
  title: string;
  explanation: string;
  sources: string[];
}

export interface RepositoryOverview {
  summary: Explanation;
  technologies: Explanation[];
  directories: Explanation[];
  importantFiles: Explanation[];
  architecture: Explanation;
  gettingStarted: Explanation[];
  readingOrder: Explanation[];
  limitations: string[];
}
