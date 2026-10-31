# Public GitNova hosting

Visitors use the website without an API key or model selection. The hosting account owner configures one shared AI service. No credentials belong in browser settings, source code, public assets, or NEXT_PUBLIC_ environment variables.

## Current implementation

Browser → Next.js `/api/overview` or `/api/chat` → public GitHub context → hosted Gemma (via Gemini API) → validated response with source paths.

The server reads `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GITHUB_TOKEN` from its environment. The browser receives only results or sanitized errors. Local `.env.local` settings do not automatically transfer to a hosting provider.

## Owner deployment steps

1. Replace the credentials that were accidentally placed in `.env.example`. That template has been sanitized, and missing local settings were moved into ignored `.env.local`. Revoke the old keys after configuring replacements.
2. Choose a hosting provider that runs Next.js server routes. A static-only upload cannot run the AI endpoints.
3. Set `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GITHUB_TOKEN` in the host's private runtime environment. Do not paste these into the repository, browser, or chat.
4. Configure shared usage controls before exposing anonymous AI endpoints: per-visitor/IP rate limits, a global daily request or token budget, and a concurrency limit. Use host-level controls or shared storage; an in-memory limiter alone does not cover multiple serverless instances. IP limits are imperfect on shared networks and against distributed abuse.
5. Select a provider quota/billing arrangement appropriate to usage. Free quota is shared by every visitor. A paid plan can provide higher quota but does not guarantee uptime. Configure alerts and available billing limits in the provider account.
6. Deploy and test the public URL: import a public repository, generate an overview, ask a question, follow its citations, and verify that malformed input, quota exhaustion, and provider outages show actionable messages.
7. Confirm private environment files and credential values are absent from the public build and Git history before sharing the URL. Record the deployed revision and retain the previous deployment for rollback.

## Remaining work

Hosting has not been selected or provisioned in this task. No public URL has been deployed. Distributed usage controls are not implemented yet and are a release prerequisite; the present backend remains appropriate for local development and controlled demos. Live Gemini overload and timeouts have been observed. Secrets remaining server-side removes visitor setup; it does not provide unlimited or guaranteed access.

Ollama remains a separate planned local-model feature. A deployed server cannot use a visitor's laptop model through its own localhost address.
