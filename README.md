# GitNova

Explore. Understand. Contribute.

GitNova is an AI-powered open-source companion in development. We are building the backend first, following the [shared workflow](https://chatgpt.com/share/6ae4da40-71ec-83e8-9925-56bb8b44b7e7).

## Run locally

Use Node.js 22 or newer and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Public GitHub repositories work without credentials, subject to GitHub's unauthenticated rate limit. Optionally set `GITHUB_TOKEN` in `.env.local` to a token with public repository read access. Never put credentials in client-visible variables or commit them. For AI analysis, set `GEMINI_API_KEY` and `GEMINI_MODEL` to a Gemini model available to your key. Ollama is reserved for a later phase. Live Gemini verification is pending; current AI tests use mocked responses.

## Foundation: GitHub integration

```sh
curl -X POST http://localhost:3000/api/repository \
  -H 'Content-Type: application/json' \
  -d '{"repoUrl":"https://github.com/facebook/react"}'

curl --get http://localhost:3000/api/repository/readme \
  --data-urlencode 'repoUrl=https://github.com/facebook/react'

curl --get http://localhost:3000/api/issues \
  --data-urlencode 'repoUrl=https://github.com/facebook/react' \
  --data-urlencode 'page=1'
```

Responses contain `success` and `repository`, `readme`, or `issues`. Errors contain `success: false` and an `error` with `code` and `message`. Missing READMEs return `readme: null`. Private repositories are rejected. GitHub's `openIssues` metadata count includes pull requests. Issue pages exclude pull requests and can contain fewer than 30 issues; follow `nextPage` until it is null, including when a page is empty.

The root URL opens the Concept A workspace; service status is available at `/api/health`. The workspace starts with clearly labeled illustrative data. Import a repository to replace it with real context. AI failures leave the source browser usable. Codebase Q&A is connected to the question endpoint. Issue AI, PR review, and Ollama are labeled as coming soon. No repository contents are executed or saved. This is a local MVP backend: authentication and application-level rate limiting must be added before a public deployment using shared credentials.

## AI Repository Analyzer

The backend collects folder structure, README, dependency manifests, and selected important files at one commit, then asks Gemini for a beginner-friendly overview.

```sh
# Inspect collected inputs without using Gemini.
curl --get http://localhost:3000/api/repository/files \
  --data-urlencode 'repoUrl=https://github.com/facebook/react'

# Requires GEMINI_API_KEY and GEMINI_MODEL in .env.local.
curl -X POST http://localhost:3000/api/overview \
  -H 'Content-Type: application/json' \
  -d '{"repoUrl":"https://github.com/facebook/react"}'
```

The overview response contains `repository`, `commitSha`, `overview`, and `coverage`. Overview sections explain purpose/audience, technologies, directories, important files, architecture, getting started, and a reading order. Each explanation contains `title`, `explanation`, and `sources` (repository paths). Citations are checked against supplied paths; AI factual correctness still needs human review.

`coverage` reports analyzed file paths, selected README path, manifest paths, structure entry count, truncation, and warnings. The context endpoint's `readme` and `manifests` contain paths; their contents are in `files`. Files are read using immutable blob SHAs from the resolved commit. No code or dependency installation commands from the repository are executed.

Limits: 20 text files, 50 KB per file, 200 KB total file content, and 1,000 structure entries. Oversized, binary, symlink, generated, vendored, and secret-like files are skipped. This is selective analysis, not an exhaustive repository audit; filename filtering is not a guarantee that public source contains no secrets. Common manifests include package.json, pyproject.toml, requirements.txt, go.mod, Cargo.toml, Gemfile, composer.json, pom.xml, Gradle files, and .csproj files. Missing manifests and READMEs are reported explicitly. Public source context is sent to Google only when the overview endpoint is invoked with configured credentials.

An empty repository returns `422 EMPTY_REPOSITORY`. Missing AI configuration returns `503 AI_NOT_CONFIGURED` before GitHub requests. AI timeouts return `504 AI_TIMEOUT`; malformed or unsupported citations return `502 INVALID_AI_OUTPUT`. Gemini calls have a 30-second timeout and bounded output. GitHub requests have individual 10-second timeouts. Hosting execution limits must accommodate context retrieval plus generation; deployment is still a later milestone.

Validation: mocked GitHub and Gemini cases cover input validation, file limits, missing content, citation checks, and provider failures. Live public GitHub collection was verified through HTTP against Express (284 tree entries, README, package.json, and 20 selected files with an omission warning) and directly against Hello-World (README-only context). No live Gemini generation has been performed.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Tests use mocked GitHub responses and require no token.

## Workflow

See [TASKS.md](TASKS.md) for the ordered task board, priorities, dependencies, and completion checks.

Foundation complete: project setup and GitHub metadata, README, and issue endpoints.

1. **AI Repository Analyzer:** analyze folder structure, README, dependency manifests, and important files to generate a beginner-friendly overview from a public GitHub URL.
2. **Codebase Q&A:** answer questions with file references after the analyzer works.
3. Smart issue finder, label suggestions, and duplicate detection.
4. Fetch PR metadata and diffs, then generate structured AI pull request reviews.
5. Optional Ollama mode and end-to-end backend testing.
6. Frontend integration and deployment.

Frontend palette: Signal Red `#E63946`, Charcoal Grey `#23272B`, Moonlit Silver `#C5CBD3`.

API routes live in `src/app/api`, reusable GitHub integration in `src/lib/github.ts`, and tests in `tests`. Next.js App Router, TypeScript, and Octokit form the foundation. See [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and [GitHub issues documentation](https://docs.github.com/en/rest/issues/issues).

## Frontend verification

Concept A includes responsive navigation, repository import, source tabs, commit-pinned source links, loading/cancel states, and recoverable errors. Live browser verification covered Hello-World import and the missing-AI-configuration state. AI generation is still mock-tested only.

## AI Codebase Explainer

Open **Codebase Q&A** in the sidebar, enter a public GitHub URL in the top bar, and ask a question. No prior analyzer run is required. Example questions: “Where does authentication happen?” and “How does the backend work?”

```sh
curl -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"repoUrl":"https://github.com/expressjs/express","question":"How does the backend work?"}'
```

Responses include `question`, `repository`, `commitSha`, `explanation: { answer, sources, insufficientEvidence }`, and `coverage: { filePaths, truncated, warnings }`. Citation links use the answer’s own commit SHA. Only files whose contents were supplied to the model can be cited. Supported answers must contain at least one citation; insufficient-evidence answers may have none. These checks validate citation existence, not the semantic correctness of every AI claim.

Questions must contain 1–2,000 characters. Requests are independent; the previous answer is replaced, and changing the repository clears the answer and cancels the pending client request. Canceling a client request does not guarantee that an already-started provider request stops. Question terms and authentication/backend synonyms prioritize matching file paths while preserving the existing context size limits and manifest/README preference. This is bounded path-based selection, not full-codebase semantic search. Missing evidence is reported explicitly.

Gemini configuration is shared with the analyzer. No client-provided source text is trusted as repository context; the server fetches public GitHub files itself. Provider errors are sanitized. Live Gemini verification remains deferred at the user's request; tests use mocked provider responses. Browser checks verified question presets, submission, and missing-configuration feedback.

## Shared AI for visitors

GitNova uses server-managed AI credentials. Visitors do not supply keys or choose a model. Public hosting still requires owner-side environment configuration and shared usage controls; see [public hosting preparation](docs/PUBLIC-HOSTING.md). No public deployment has been created yet.

## Hosted Gemma for the hackathon

The current model is `gemma-4-26b-a4b-it`, an open-weight Gemma model accessed through Google's hosted Gemini API. The existing server-side `GEMINI_API_KEY` authenticates these calls; `GEMINI_MODEL` selects Gemma. No separate Gemma API key is required, and visitors do not configure either setting. `gemma-4-31b-it` is also supported.

This is hosted inference, not local Ollama or offline mode. The implementation does not silently fall back to a Gemini model. For Gemma, JSON is requested through the prompt, then parsed and checked with the same answer/overview and source-citation validators. Malformed answers are rejected. Minimal thinking is requested to reduce latency; hosting quota and availability still apply.

Reference: [Run Gemma with the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api). Hackathon disclosure: Codex/ChatGPT assisted implementation and testing; runtime repository analysis and Q&A are configured to use hosted Gemma. Model choice alone does not establish compliance with every event rule.
