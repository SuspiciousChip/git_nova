# GitNova task board

This is the working plan for the backend-first MVP. Update this file as work progresses. The goal is a demonstrable flow: import a public GitHub repository, understand it, ask a question, find an issue, and review a pull request. The user selected Concept A and requested frontend work now; the analyzer workspace is implemented while remaining backend features retain their planned status.

## Current state

- **Done:** Next.js/TypeScript setup; repository metadata, README, and paginated issue APIs; URL validation; GitHub error handling; public-repository restriction.
- **Verified in the foundation:** 23 tests passed, type checking passed, production build passed, and all three endpoints returned HTTP 200 for `facebook/react`.
- **First feature: AI Repository Analyzer.** Backend implemented and mock-tested; live Gemini verification remains pending by user choice.
- **Done:** Smart Issue Finder API and workspace flow; mocked ranking/validation tests, typecheck, and production build pass. Live Gemini smoke check reached the route but returned `AI_NOT_CONFIGURED` because credentials are absent.
- **Not implemented:** Issue triage, duplicate detection, PR diffs/review, Ollama or deployment. Analyzer and explainer live AI verification remain pending.
- **Credential dependency:** a working Gemini API key is needed for live AI verification. Configure it locally in `.env.local`; never put keys in this board or chat. Mocked implementation can proceed before a key is available.

## How to manage the work

Status: `TODO`, `NEXT`, `DOING`, `BLOCKED`, `DONE`, or `DEFERRED`. Keep one implementation task in `DOING` at a time. A task becomes `DONE` only after its completion checks pass; record evidence under the milestone. If blocked, record the reason and move to an independent task.

Priorities: **P0** = core working demo or required release check; **P1** = remaining planned MVP features; **P2** = optional local AI. No team members have been assigned: the current implementer owns each task until an explicit handoff. Credential setup belongs to the project owner.

The shared chat mentioned a 10 AM deadline. Treat that as historical context, not a newly confirmed deadline. Estimates below are planning budgets, not delivery promises. Reserve **90–120 minutes for frontend integration and 30–45 minutes for release verification** before spending time on optional work. If time tightens, explicitly defer P2 first, then P1; keep the core demo and release checks.

## 0. Foundation — complete

| ID | Task | Status | Evidence |
| --- | --- | --- | --- |
| F-01 | Initialize Next.js, TypeScript, dependency lockfile, and environment template | DONE | Production build passed |
| F-02 | Import public repository metadata | DONE | `POST /api/repository`; live React repository check |
| F-03 | Fetch README and paginated open issues | DONE | `GET /api/repository/readme`, `GET /api/issues`; live checks |
| F-04 | Validate input and handle upstream failures | DONE | 23 tests in `tests/github.test.ts` |

## 1. AI Repository Analyzer — first feature, 90–135 minutes

**User story:** Paste a public GitHub repository URL. AI examines the folder structure, README, dependencies, and important files, then generates a beginner-friendly project overview.

**Input:** `{ "repoUrl": "https://github.com/owner/repository" }` sent to the proposed `POST /api/overview` endpoint. The backend is implemented and tested first; the URL input and results screen are connected in the final frontend phase.

**Overview output:**

- What the project does and who it is for, explained in plain language.
- Main technologies and dependencies, with their roles where supported by evidence.
- Folder structure and the purpose of important directories.
- Important files and entry points, with source paths.
- How the main parts fit together and where a beginner should start reading.
- Setup/run instructions only when supported by the README or package scripts; otherwise state that they are unknown.
- Coverage warnings for missing README, absent manifests, or omitted files.

**Feature completion:** A real public repository produces a grounded overview covering all four inputs: folder structure, README, dependency manifests, and selected important files. Missing inputs are explicitly reported. Q&A and PR review are separate features and do not block this analyzer.

### Repository inputs

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| G-01 | P0 | Fetch repository tree and selected text files from a resolved commit | F-02 | DONE | Return paths, commit SHA, contents, and truncation metadata. Cap at 20 files, 50 KB per file, and 200 KB total. Prioritize README, dependency manifests (such as package.json, pyproject.toml, requirements.txt, go.mod, or Cargo.toml when present), and entry points. Include nested manifests within the budget. Skip binary, generated, vendored dependency directories, and secret-like files; never execute repository code. Test empty repos, large files, and truncated trees. |
| G-03 | P0 | Define reusable repository context and endpoint contracts | G-01 | DONE | Typed context combines metadata, folder tree, README, dependency manifests, selected files, and commit SHA. Document request/response examples and limits for downstream AI consumers. |

Use existing `src/lib/github.ts` and `src/lib/api.ts`. Implemented endpoint: `GET /api/repository/files?repoUrl=...`. Read manifest contents as data; do not install dependencies from imported repositories.

Implemented context shape in `src/types/repository.ts` (abridged):

```ts
interface RepositoryContext {
  repository: { owner: string; name: string; defaultBranch: string };
  commitSha: string;
  readme: string | null; // Path; contents are in files.
  tree: Array<{ path: string; type: "file" | "directory" }>;
  manifests: string[]; // Paths; contents are in files.
  files: Array<{ path: string; content: string; truncated: boolean }>;
  truncated: boolean;
  warnings: string[];
}
```

### AI analysis and verification

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| A-01 | P0 | Add server-side Gemini adapter | G-03 | DONE | Configurable model; 30-second timeout; bounded input/output; validate structured output. Missing key, timeout, quota failure, and malformed output return actionable sanitized errors. Treat repository text as untrusted data in prompts. |
| A-02 | P0 | Generate repository overview | A-01 | DONE | `POST /api/overview` returns the beginner-friendly overview described above, including dependencies, directory explanations, important files, and a suggested reading order grounded in supplied context. Flags limited context rather than inventing files. |
| A-04 | P0 | Verify AI Repository Analyzer | A-02; Gemini key | DEFERRED | User requested mocked AI tests for now.  Generate a live overview on a public repository. Check folder, README, manifest, and important-file evidence; verify cited paths. Test missing README, absent manifests, empty repository, bounded large repository, and malformed AI output. Record limitations. |

Implemented files: `src/lib/gemini.ts`, `src/lib/repository-context.ts`, `src/lib/analyzer.ts`, and corresponding route handlers. Preserve the existing `{ success: true, ...result }` / `{ success: false, error: { code, message } }` response pattern.

## 2. Codebase Q&A — 30–45 minutes

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| A-03 | P0 | Implement codebase Q&A | A-01, G-03 | DONE | `POST /api/chat` accepts repo URL and question; returns answer and supplied-file citations. Reject blank/oversized questions; say when evidence is insufficient. No persistent chat history required for MVP. Mocked answers, citation validation, and browser submission verified; live AI validation tracked separately in A-05. |
| A-05 | P0 | Verify live Codebase Explainer | A-03; Gemini key | DEFERRED | User requested mocked AI tests. When enabled, ask an architecture question and an authentication question on a public repository; verify the answer against each cited file. |

## 3. Issue intelligence — 45–60 minutes

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| I-01 | P0 | Rank contribution opportunities | F-03, A-01 | DONE | Returns up to 5 fetched issues based on requested skills/difficulty, with reasons and original links. Handles no matches and validates every returned issue number. Six mocked tests cover ranking, no matches, malformed/fabricated results, and request validation. Live Gemini remains unverified until credentials are configured. |
| I-02 | P1 | Suggest issue categories, priority, and labels | F-03, A-01 | TODO | Suggestions include rationale and uncertainty. No labels are written to GitHub. Handle sparse issue descriptions. |
| I-03 | P1 | Detect potential duplicate issues | F-03 | TODO | Compare a bounded set of up to 100 fetched issues; return candidate pairs and similarity reasons. Exclude self-pairs and mirrored pairs. Label results as possible duplicates, not confirmed duplicates. |

Implemented route: `POST /api/issues/find`. Routes **to create**: `POST /api/issues/triage` and `POST /api/issues/duplicates`. Remaining issue analysis modules are not implemented.

## 4. Pull request review — 60–90 minutes

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| G-02 | P0 | Fetch PR metadata, changed files, and available patches | F-02 | TODO | Validate positive PR number; return base/head SHAs and additions/deletions. Cap at 50 files and 200 KB of patches; explicitly flag missing/truncated patches. Test missing PR and binary changes. |
| R-01 | P0 | Generate a structured review of a GitHub PR | G-02, A-01 | TODO | `POST /api/review` returns summary and findings with severity, path, explanation, and suggested fix. Cite changed lines only when supported by patches; report review coverage and omitted files. |
| R-02 | P0 | Validate review behavior | R-01 | TODO | Test a known defect, clean diff, empty diff, unavailable patch, and oversized PR. Distinguish no findings from unable to review. Never post a GitHub comment automatically. |

Proposed module **to create**: `src/lib/pr-reviewer.ts`. Proposed GitHub data endpoint **to create**: `GET /api/repository/pull-request?repoUrl=...&number=...`.

## 5. Backend verification and optional local mode — 45–75 minutes

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| B-01 | P0 | Run backend regression and live smoke checks | A-04, A-05, I-01, R-02 | TODO | Tests, typecheck, and build pass; live import → overview → Q&A → issue finding → PR review succeeds. Check bad URL, missing repo, rate limit, AI timeout, and malformed model output. |
| L-01 | P2 | Add Ollama provider with the same AI contract | A-01 | TODO | Explicit server configuration selects provider. Local inference works with an installed model; unavailable service/model returns a clear error. No silent cloud fallback. |
| L-02 | P2 | Verify and document local AI setup | L-01 | TODO | Overview and Q&A run locally with no Gemini key. Document model setup, limitations, and that GitHub fetching still needs network access. Hosted deployment must not claim access to the user's localhost Ollama. |

If I-02/I-03 or L-01/L-02 are implemented, include them in B-01 regression checks before release. Proposed Ollama module **to create**: `src/lib/ollama.ts`.

## 6. Frontend — final implementation phase, 90–120 minutes

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| U-01 | P0 | Build repository import and dashboard shell | G-03 (user requested frontend early) | DONE | Responsive, keyboard-accessible import flow; clear loading, empty, success, and error states. Use the updated paper-and-ink theme with acid-yellow and orange accents, pixel details, and graffiti-inspired illustration; no glassmorphism or purple gradients. |
| U-02 | P0 | Connect overview, Q&A, and issue finding | U-01 | DOING | User can import a repo, read overview, ask a question, and open a ranked issue. Changing repositories clears previous results. Show source links and incomplete-context warnings. |
| U-03 | P0 | Connect PR review | U-01, R-02 | DONE | User selects a PR number and sees structured findings tied to changed file/line citations plus coverage limitations. API errors are recoverable without refreshing. |
| U-04 | P1 | Expose implemented secondary features | U-02; I-02/I-03 or L-02 as applicable | DOING | Completed PR review, issue matching, and duplicate detection are actionable; deferred features remain clearly marked unavailable. |

The root now serves `src/app/page.tsx`; health was moved to `src/app/api/health/route.ts`. The client workspace lives in `src/components/workspace.tsx`.

## 7. Release and demo — 30–45 minutes

| ID | Priority | Task | Depends on | Status | Completion check |
| --- | --- | --- | --- | --- | --- |
| D-01 | P0 | Prepare deployment configuration and access controls | U-02, U-03 | TODO | Server-only secrets, request limits, and application-level rate limiting; authentication/access gate before exposing shared credentials publicly. Choose target and document a rollback procedure. |
| D-02 | P0 | Deploy and verify the deployed build | D-01 | TODO | Confirm deployed revision, then smoke-test all core flows on the deployment URL. Check environment-specific failures and keep credentials out of client bundles/logs. |
| D-03 | P0 | Prepare a short demo and honest feature checklist | D-02 | TODO | Demonstrate one repository and one PR; document known limits, setup, and deferred tasks. Have a reproducible local fallback if a provider is unavailable. |

## Execution order

`G-01 → G-03 → A-01 → A-02 → A-04 → A-03 → I-01 → G-02 → R-01 → R-02 → B-01 → U-01 → U-02 → U-03 → D-01 → D-02 → D-03`

Insert I-02/I-03 after I-01 if the time reserve permits. Insert L-01/L-02 before frontend only if core backend verification is green and the time reserve remains intact. These are explicit scheduling decisions, not removed requirements.

## Definition of done and progress log

For each completed task: record changed artifacts, relevant tests/live checks, and known limitations. Run `npm test`, `npm run typecheck`, and `npm run build` at milestone boundaries. Do not mark a mocked feature live-verified, or a locally working feature deployed.

| Milestone | Status | Evidence / blocker |
| --- | --- | --- |
| Foundation | DONE | 23 passing tests; typecheck/build passed; live repository/README/issues requests succeeded |
| AI Repository Analyzer | BLOCKED | Backend implemented; 43 tests and typecheck/build passed. Live HTTP 200 for Express: 284 tree entries, README, package.json, 20 selected files with omission warning. A-04 live Gemini verification deferred at user request. |
| Codebase Q&A | BLOCKED | Backend and frontend implemented; 67 tests passed. Browser presets, submission, and missing-configuration feedback verified. Live Gemini verification deferred. |
| Issue intelligence | DOING | Smart Issue Finder and Duplicate Detector APIs and workspace flows implemented; mocked tests, typecheck, and production build pass. Triage remains TODO. |
| PR review | DONE | Pull request diff fetch, structured Gemini review, changed-line citation validation, workspace panel, and mocked tests implemented; 83 tests, typecheck, and production build pass. |
| Backend verification / local mode | TODO | Local mode optional |
| Frontend | DOING | Concept A shell, analyzer import, source browser, AI-error handling, Codebase Q&A, Smart Issue Finder, and PR Reviewer are connected. Triage, duplicate detection, and Ollama remain unavailable. |
| Release | TODO | Deployment target and configuration not yet selected |

## UI requests — implemented in order

1. **Theme and motion (2026-10-31):** Replaced gradient panels with opaque paper surfaces, hard ink outlines and offset shadows. Added pixel accents, graffiti-inspired typography and a custom vector illustration. Added scroll-triggered section reveals with reduced-motion support and observer cleanup. Typecheck, production build, and 67 tests passed (`node --import tsx --test tests/*.test.ts`; the npm test wrapper was blocked by sandbox IPC restrictions). Visual browser verification remains pending: the browser connection to the local preview was refused.
