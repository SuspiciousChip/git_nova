"use client";

import { useEffect, useRef, useState } from "react";
import type { DuplicateDetectorResult } from "../lib/duplicate-detector";
import { Icon } from "./icon";

export default function DuplicateDetector({ repoUrl }: { repoUrl: string }) {
  const [issueNumber, setIssueNumber] = useState("");
  const [result, setResult] = useState<DuplicateDetectorResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { controller.current?.abort(); setResult(null); setError(""); setBusy(false); return () => controller.current?.abort(); }, [repoUrl]);
  async function detect(event: React.FormEvent) {
    event.preventDefault(); controller.current?.abort(); const pending = new AbortController(); controller.current = pending; setBusy(true); setError(""); setResult(null);
    try { const response = await fetch("/api/issues/duplicates", { method: "POST", signal: pending.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, issueNumber }) }); const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Could not compare this issue."); if (!pending.signal.aborted) setResult(body as DuplicateDetectorResult & { success: true }); }
    catch (err) { if (!pending.signal.aborted) setError(err instanceof Error ? err.message : "Could not reach the server."); }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }
  return <section className="panel duplicate-panel"><div className="section-heading"><div><span className="eyebrow">ISSUE HYGIENE</span><h1>Find duplicate issues<span className="red-dot">.</span></h1></div><span className="icon-tile"><Icon name="duplicate"/></span></div><p>Choose an issue and GitNova will compare it with the repository’s other open issues to uncover repeated reports.</p><div className="finder-repo"><Icon name="github" size={16}/><span>{repoUrl || "Enter a public GitHub repository URL above."}</span></div><form className="pr-review-form" onSubmit={detect}><label htmlFor="duplicate-issue-number">Issue number</label><input id="duplicate-issue-number" inputMode="numeric" pattern="[0-9]+" required value={issueNumber} disabled={busy} onChange={event => setIssueNumber(event.target.value.replace(/\D/g, ""))} placeholder="e.g. 128"/><div className="finder-actions"><span>Compares against up to 100 other open issues.</span><button className="primary" disabled={busy || !repoUrl.trim() || !issueNumber}><Icon name="spark" size={16}/>{busy ? "Comparing issues…" : "Find duplicates"}</button></div></form>{busy && <p role="status" className="notice">Reading issue reports and comparing their meaning…</p>}{error && <div role="alert" className="notice error"><Icon name="issue"/><div><strong>Couldn’t compare this issue</strong><p>{error}</p></div></div>}{result && <section className="duplicate-results" aria-live="polite"><div className="pr-result-heading"><div><span className="eyebrow">TARGET ISSUE</span><h2>#{result.target.number} · {result.target.title}</h2><p>{result.scanned} other open issues compared</p></div><a className="quiet" href={result.target.url} target="_blank" rel="noreferrer">Open issue <Icon name="external" size={12}/></a></div>{result.message && <p className="finder-message">{result.message}</p>}{result.duplicates.length > 0 && <div className="duplicate-list"><h3>Likely duplicates</h3>{result.duplicates.map(issue => <article className={`duplicate-match confidence-${issue.confidence}`} key={issue.number}><div className="pr-finding-meta"><span>{issue.confidence} confidence</span><a href={issue.url} target="_blank" rel="noreferrer">#{issue.number} <Icon name="external" size={11}/></a></div><h3>{issue.title}</h3><p>{issue.reason}</p><div className="issue-labels">{issue.labels.map(label => <span key={label}>{label}</span>)}</div></article>)}</div>}</section>}</section>;
}
