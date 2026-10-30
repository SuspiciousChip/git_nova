"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueDifficulty, IssueFinderResult } from "../lib/issue-finder";
import { Icon } from "./icon";

export default function IssueFinder({ repoUrl }: { repoUrl: string }) {
  const [skills, setSkills] = useState("");
  const [difficulty, setDifficulty] = useState<IssueDifficulty>("any");
  const [result, setResult] = useState<IssueFinderResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    setResult(null);
    setError("");
    setBusy(false);
    return () => controller.current?.abort();
  }, [repoUrl]);

  async function find(event: React.FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/issues/find", {
        method: "POST",
        signal: pending.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, skills, difficulty }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Could not find matching issues. Please try again.");
      if (!pending.signal.aborted) setResult(body as IssueFinderResult & { success: true });
    } catch (err) {
      if (!pending.signal.aborted) setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      if (!pending.signal.aborted) setBusy(false);
    }
  }

  return <section className="panel finder-panel">
    <div className="section-heading"><div><span className="eyebrow">CONTRIBUTION MATCHING</span><h1>Find your first issue<span className="red-dot">.</span></h1></div><span className="icon-tile"><Icon name="issue"/></span></div>
    <p>Tell GitNova what you know and what challenge you want. It will rank open issues and explain why each may fit.</p>
    <div className="finder-repo"><Icon name="github" size={16}/><span>{repoUrl || "Enter a public GitHub repository URL above."}</span></div>
    <form className="finder-form" onSubmit={find}>
      <label htmlFor="finder-skills">Skills and interests</label>
      <textarea id="finder-skills" required maxLength={1000} disabled={busy} value={skills} onChange={event => setSkills(event.target.value)} placeholder="For example: JavaScript, React, accessibility, and writing documentation" rows={3}/>
      <label htmlFor="finder-difficulty">Preferred difficulty</label>
      <select id="finder-difficulty" value={difficulty} disabled={busy} onChange={event => setDifficulty(event.target.value as IssueDifficulty)}>
        <option value="any">Any difficulty</option>
        <option value="beginner">Beginner friendly</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
      <div className="finder-actions"><span>Checks up to 100 open issues and returns at most 5 matches.</span><button className="primary" disabled={busy || !repoUrl.trim() || !skills.trim()}><Icon name="spark" size={16}/>{busy ? "Matching issues…" : "Find matching issues"}</button></div>
    </form>
    {busy && <p role="status" className="notice">Reading open issues and matching them to your preferences…</p>}
    {error && <div role="alert" className="notice error"><Icon name="issue"/><div><strong>Couldn’t find issues yet</strong><p>{error}</p></div></div>}
    {result && <section className="finder-results" aria-live="polite">
      <div className="finder-result-heading"><h2>Recommended issues</h2><span className="badge">{result.scanned} open issues scanned</span></div>
      {result.message && <p className="finder-message">{result.message}</p>}
      {result.matches.map(issue => <article className="issue-match" key={issue.number}>
        <div className="issue-match-title"><a href={issue.url} target="_blank" rel="noreferrer">#{issue.number} · {issue.title}<Icon name="external" size={12}/></a><span className="issue-date">Opened {new Date(issue.createdAt).toLocaleDateString()}</span></div>
        <p>{issue.reason}</p>
        <div className="issue-labels">{issue.labels.map(label => <span key={label}>{label}</span>)}</div>
      </article>)}
    </section>}
  </section>;
}
