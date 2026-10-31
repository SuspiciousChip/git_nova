"use client";

import { useEffect, useRef, useState } from "react";
import type { PullRequestReviewResult, ReviewSeverity } from "../lib/pr-review";
import { Icon } from "./icon";

const severityLabels: Record<ReviewSeverity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", nit: "Nit" };

export default function PRReviewer({ repoUrl }: { repoUrl: string }) {
  const [pullNumber, setPullNumber] = useState("");
  const [result, setResult] = useState<PullRequestReviewResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => { controller.current?.abort(); setResult(null); setError(""); setBusy(false); return () => controller.current?.abort(); }, [repoUrl]);

  async function review(event: React.FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/pr/review", { method: "POST", signal: pending.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, pullNumber }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Could not review this pull request. Please try again.");
      if (!pending.signal.aborted) setResult(body as PullRequestReviewResult & { success: true });
    } catch (err) { if (!pending.signal.aborted) setError(err instanceof Error ? err.message : "Could not reach the server."); }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }

  return <section className="panel pr-review-panel">
    <div className="section-heading"><div><span className="eyebrow">CHANGE REVIEW</span><h1>Review before you merge<span className="red-dot">.</span></h1></div><span className="icon-tile"><Icon name="review"/></span></div>
    <p>Paste a repository above, choose a pull request, and GitNova will check the changed lines for concrete risks with citations.</p>
    <div className="finder-repo"><Icon name="github" size={16}/><span>{repoUrl || "Enter a public GitHub repository URL above."}</span></div>
    <form className="pr-review-form" onSubmit={review}>
      <label htmlFor="pull-number">Pull request number</label>
      <input id="pull-number" inputMode="numeric" pattern="[0-9]+" required value={pullNumber} disabled={busy} onChange={event => setPullNumber(event.target.value.replace(/\D/g, ""))} placeholder="e.g. 42" />
      <div className="finder-actions"><span>Reviews up to 60 changed files and cites added lines only.</span><button className="primary" disabled={busy || !repoUrl.trim() || !pullNumber}><Icon name="spark" size={16}/>{busy ? "Reviewing changes…" : "Review pull request"}</button></div>
    </form>
    {busy && <p role="status" className="notice">Fetching the pull request diff and checking changed lines…</p>}
    {error && <div role="alert" className="notice error"><Icon name="issue"/><div><strong>Couldn’t review this pull request</strong><p>{error}</p></div></div>}
    {result && <section className="pr-results" aria-live="polite">
      <div className="pr-result-heading"><div><span className="eyebrow">{result.pullRequest.base} ← {result.pullRequest.head}</span><h2>{result.pullRequest.title}</h2><p>#{result.pullRequest.number} · @{result.pullRequest.author}</p></div><span className={`pr-verdict ${result.verdict}`}>{result.verdict.replace("_", " ")}</span></div>
      <div className="pr-stats"><span>{result.pullRequest.changedFiles} files</span><span className="additions">+{result.pullRequest.additions}</span><span className="deletions">−{result.pullRequest.deletions}</span><a href={result.pullRequest.url} target="_blank" rel="noreferrer">Open on GitHub <Icon name="external" size={12}/></a></div>
      <p className="pr-summary">{result.summary}</p>
      {result.findings.length ? <div className="pr-findings"><h3>Findings ({result.findings.length})</h3>{result.findings.map((finding, index) => <article className={`pr-finding severity-${finding.severity}`} key={`${finding.file}:${finding.line}:${index}`}><div className="pr-finding-meta"><span>{severityLabels[finding.severity]}</span><a href={`${result.pullRequest.url}/files`} target="_blank" rel="noreferrer">{finding.file}:{finding.line} <Icon name="external" size={11}/></a></div><h3>{finding.title}</h3><p>{finding.explanation}</p><div className="pr-suggestion"><strong>Suggestion</strong><span>{finding.suggestion}</span></div></article>)}</div> : <div className="pr-clean"><Icon name="spark" size={20}/><strong>No actionable findings</strong><p>The changed lines passed the automated review. Still review the full diff and run the project’s tests before merging.</p></div>}
      <p className="pr-coverage"><Icon name="file" size={15}/>Review is grounded in the supplied patch. It does not run code, inspect unchanged files, or replace maintainer review.</p>
    </section>}
  </section>;
}
