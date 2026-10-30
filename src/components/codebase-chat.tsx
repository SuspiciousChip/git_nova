"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatResult } from "../lib/explainer";
import { Icon } from "./icon";

export default function CodebaseChat({ repoUrl }: { repoUrl: string }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { setResult(null); setError(""); setQuestion(""); setBusy(false); return () => controller.current?.abort(); }, [repoUrl]);
  async function ask(event: React.FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/chat", { method: "POST", signal: pending.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, question }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Could not answer that question. Please try again.");
      if (!pending.signal.aborted) setResult(body);
    } catch (err) { if (!pending.signal.aborted) setError(err instanceof Error ? err.message : "Could not reach the server."); }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }
  return <section className="panel explainer-panel">
    <div className="section-heading"><div><span className="eyebrow">AI CODEBASE EXPLAINER</span><h1>Ask the code. Find your way<span className="red-dot">.</span></h1></div><span className="icon-tile"><Icon name="chat"/></span></div>
    <p>Understand how a project works, with answers that point back to its source files.</p>
    <div className="chat-repo"><Icon name="github" size={16}/><span>{repoUrl || "Enter a public GitHub URL in the bar above."}</span></div>
    <div className="suggested-questions">{["Where does authentication happen?", "How does the backend work?", "Where should I start reading?"].map(text => <button disabled={busy} key={text} onClick={() => setQuestion(text)}>{text}<Icon name="arrow" size={13}/></button>)}</div>
    <form onSubmit={ask} className="question-form"><label htmlFor="codebase-question">Your question</label><textarea id="codebase-question" required maxLength={2000} disabled={busy} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about authentication, request handling, or a specific file…" rows={3}/><div><span>{question.length}/2,000 · Each question is independent.</span><div>{busy && <button type="button" className="quiet" onClick={() => { controller.current?.abort(); setBusy(false); setError("Question canceled. You can try again."); }}>Cancel</button>}<button className="primary" disabled={busy || !repoUrl.trim() || !question.trim()}><Icon name="spark" size={16}/>{busy ? "Reading the code…" : "Ask GitNova"}</button></div></div></form>
    {busy && <p role="status" className="notice">Finding relevant files and preparing an explanation…</p>}
    {error && <div role="alert" className="notice error"><Icon name="issue"/><div><strong>Unable to answer yet</strong><p>{error}</p></div></div>}
    {result && <article className="answer-card" aria-live="polite"><div className="small-heading"><Icon name="spark"/>GitNova’s explanation<span className="badge">{result.explanation.insufficientEvidence ? "Limited evidence" : "AI generated"}</span></div><h2>{result.question}</h2><p className="answer-text">{result.explanation.answer}</p><h3>Relevant files</h3><div className="citations">{result.explanation.sources.map(path => <a key={path} target="_blank" rel="noreferrer" href={`https://github.com/${result.repository.owner}/${result.repository.name}/blob/${result.commitSha}/${path.split("/").map(encodeURIComponent).join("/")}`}><Icon name="file" size={13}/>{path}<Icon name="external" size={11}/></a>)}</div>{!result.explanation.sources.length && <p>No supporting files could be identified from the selected context.</p>}<details><summary>{result.coverage.filePaths.length} files examined · Commit {result.commitSha.slice(0, 7)}{result.coverage.truncated ? " · Partial coverage" : ""}</summary><ul>{result.coverage.filePaths.map(path => <li key={path}>{path}</li>)}</ul>{result.coverage.warnings.map(warning => <p key={warning}>{warning}</p>)}</details></article>}
    {!result && !busy && !error && <div className="chat-empty"><Icon name="book" size={28}/><h2>A clearer picture, one question at a time.</h2><p>Answers use a bounded selection of repository files. When the evidence is incomplete, GitNova will say so.</p></div>}
  </section>;
}
