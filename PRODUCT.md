# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers, especially people new to a codebase, who want to understand an unfamiliar public GitHub repository and find a way to contribute.

## Product Purpose

GitNova helps developers explore, understand, and contribute to open-source projects. Success means a developer can get oriented in an unfamiliar repository and know where to look or what to ask next.

## Positioning

GitNova provides beginner-friendly repository orientation, with explanations grounded in repository files and links back to their sources.

## Operating Context

Users provide a public GitHub repository URL. They can inspect repository structure and selected files, request an AI-generated overview, and ask codebase questions. The product is in development and its feature set will grow; specific additional features are undecided.

## Capabilities and Constraints

- The current web app supports public GitHub repository import, selected source browsing, AI overviews, and codebase Q&A.
- Issue discovery, pull request review, triage, duplicate detection, and local Ollama support are shown as planned or coming soon; they are not currently connected.
- Without an imported repository, the workspace uses clearly labeled illustrative sample content.
- GitHub access is public-repository only. Repository contents are displayed as text and are not executed or saved by the app.
- AI features require server-side Gemini configuration. If AI analysis fails, repository browsing remains available.
- Additional product features are planned, but their scope and order have not yet been decided.

## Brand Commitments

The product is named GitNova. Its current product line is “Explore. Understand. Contribute.”

## Evidence on Hand

- The runnable project and implementation are in this repository (`src/`).
- `README.md` documents supported API behavior, limits, setup, and known verification status.
- The default workspace content is illustrative, not evidence of a live AI result or a user outcome. Do not present it as real repository analysis.

## Product Principles

- Help people get oriented in unfamiliar codebases.
- Ground explanations in repository evidence and provide paths back to source.
- Make planned and unavailable capabilities clear.
- Keep repository exploration useful when AI is unavailable.
