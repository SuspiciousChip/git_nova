"use client";

import { useEffect, useRef, useState } from "react";
import type { Explanation, RepositoryContext, RepositoryOverview } from "../types/repository";
import { Icon } from "./icon";
import CodebaseChat from "./codebase-chat";
import IssueFinder from "./issue-finder";

const tools = [
  { name: "Repository Analyzer", icon: "analyze", description: "Understand the structure, dependencies, and ideas behind a repository." },
  { name: "Codebase Q&A", icon: "chat", description: "Ask questions about a repository and get answers with file references." },
  { name: "Smart Issue Finder", icon: "issue", description: "Find contribution opportunities that match your skills and experience." },
  { name: "PR Reviewer", icon: "review", description: "Get a structured review of pull request changes before you merge." },
  { name: "Issue Triage", icon: "triage", description: "Suggest labels and priorities to help maintainers organize their backlog." },
  { name: "Duplicate Detector", icon: "duplicate", description: "Discover potentially related issues and review possible duplicates." },
];
const example: RepositoryContext = {
  repository: { owner: "expressjs", name: "express", defaultBranch: "master", description: "A small, flexible web framework for Node.js." },
  commitSha: "", readme: "Readme.md", manifests: ["package.json"], truncated: true, warnings: [],
  tree: [{ path: "lib", type: "directory" }, { path: "test", type: "directory" }, { path: "examples", type: "directory" }, { path: "package.json", type: "file" }, { path: "Readme.md", type: "file" }],
  files: [{ path: "lib/application.js", content: "// Illustrative preview — not fetched repository source.\n// Application configuration and request handling live here.", truncated: false }, { path: "package.json", content: "Illustrative preview: dependencies and package scripts appear here after import.", truncated: false }, { path: "Readme.md", content: "Illustrative preview: project documentation appears here after import.", truncated: false }],
};
const exampleSummary: Explanation = { title: "Repository overview", explanation: "A small, flexible web framework for Node.js. Express helps developers build web applications and APIs by connecting incoming requests to the right handlers.", sources: [] };

async function readResponse(response: Response) {
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error?.message ?? "This request could not be completed. Please try again.");
  return body;
}

export default function Workspace() {
  const [url, setUrl] = useState("https://github.com/expressjs/express");
  const [active, setActive] = useState(0);
  const [context, setContext] = useState<RepositoryContext | null>(example);
  const [preview, setPreview] = useState(true);
  const [overview, setOverview] = useState<RepositoryOverview | null>(null);
  const [selected, setSelected] = useState("lib/application.js");
  const [tab, setTab] = useState("Structure");
  const [phase, setPhase] = useState<"idle" | "files" | "ai">("idle");
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [settings, setSettings] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const root = shell.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (motion.matches) continue;
        const animation = entry.target.animate(
          [{ opacity: 0.25, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 550, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: 0.08 });
    root.querySelectorAll(".street-banner, .panel, .tool-grid > button, .coverage-panel").forEach(node => observer.observe(node));
    const stopMotion = () => { if (motion.matches) animations.forEach(animation => animation.cancel()); };
    motion.addEventListener("change", stopMotion);
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); motion.removeEventListener("change", stopMotion); };
  }, [active, overview]);
  const busy = phase !== "idle";
  const repoLink = context ? `https://github.com/${context.repository.owner}/${context.repository.name}` : "";
  function sourceLink(path: string) { return `${repoLink}/blob/${context?.commitSha}/${path.split("/").map(encodeURIComponent).join("/")}`; }
  function citations(item: Explanation) { return <div className="citations">{item.sources.map(path => <a href={sourceLink(path)} target="_blank" rel="noreferrer" key={path}><Icon name="file" size={12}/>{path}<Icon name="external" size={10}/></a>)}</div>; }

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setActive(0); setTab("Structure"); setPreview(false); setOverview(null); setContext(null); setError(""); setAiError(""); setPhase("files");
    const repoUrl = url.trim();
    try {
      const body = await readResponse(await fetch(`/api/repository/files?repoUrl=${encodeURIComponent(repoUrl)}`, { signal: controller.signal }));
      if (controller.signal.aborted) return;
      setContext(body.context); setSelected(body.context.files[0]?.path ?? ""); setPhase("ai");
      try {
        const result = await readResponse(await fetch("/api/overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl }), signal: controller.signal }));
        if (controller.signal.aborted) return;
        if (result.commitSha !== body.context.commitSha) throw new Error("The repository changed during analysis. Import it again to keep the overview and files in sync.");
        setOverview(result.overview);
      } catch (err) {
        if (!controller.signal.aborted) setAiError(err instanceof Error ? err.message : "AI analysis is unavailable. Your repository files are ready to explore.");
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not import this repository.");
    } finally { if (!controller.signal.aborted) setPhase("idle"); }
  }
  function cancel() { request.current?.abort(); setPhase("idle"); if (!context) setError("Import canceled. You can try another repository."); else setAiError("AI analysis canceled. Repository files are still available."); }
  const selectedFile = context?.files.find(file => file.path === selected);
  const summary = overview?.summary ?? (preview ? exampleSummary : null);
  const selectedExplanation = overview?.importantFiles.find(item => item.sources.includes(selected));

  return <div className="app-shell" ref={shell}>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="GitNova home"><span className="orbit"><span/></span>GitNova<span className="brand-dot">.</span></a>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">{tools.map((tool, i) => <button key={tool.name} className={`nav-item ${active === i ? "active" : ""}`} aria-current={active === i ? "page" : undefined} onClick={() => { setActive(i); setSettings(false); }}><Icon name={tool.icon}/><span>{tool.name}</span>{i > 2 && <span className="planned-dot" title="Planned feature"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="provider-label"><Icon name="spark" size={15}/> GITNOVA AI</div><p>AI is included.<br/>No API key or model setup needed.</p><button className="settings-link" onClick={() => setSettings(!settings)} aria-expanded={settings}><Icon name="info" size={17}/> About GitNova AI</button><p>Built for open source.<br/>Made for your next contribution.</p><span className="version">GITNOVA / EARLY ACCESS</span></div>
    </aside>
    <main>
      <header className="topbar"><form onSubmit={analyze} className="import-form"><label className="url-input"><Icon name="github"/><span className="sr-only">Public GitHub repository URL</span><input type="url" required value={url} disabled={busy} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/owner/repository" /></label><button className="primary" disabled={busy} type="submit"><Icon name={busy ? "spark" : "analyze"} size={18}/>{phase === "files" ? "Importing…" : phase === "ai" ? "Analyzing…" : "Analyze repository"}</button>{busy && <button type="button" className="quiet" onClick={cancel}>Cancel</button>}</form><span className="top-note">YOUR OPEN-SOURCE COMPANION</span></header>
      <div className="workspace">
        {settings && <section className="notice settings-panel"><div><strong>AI, without the setup</strong><p>GitNova manages the AI connection for you. Paste a public repository URL and start exploring—no personal API key or model selection required. Selected public source files and your question are sent to our AI provider. Usage limits and temporary service outages may apply.</p></div><button className="quiet" onClick={() => setSettings(false)}>Close</button></section>}
        {preview && active === 0 && <div className="preview-banner"><span><span className="status-dot"/> DESIGN PREVIEW <span className="preview-description">Illustrative content. Analyze a repository to load real data.</span></span><span>VOL. 01 / PLAY BUILD REPEAT</span></div>}
        <div role="status" aria-live="polite" className={busy ? "notice" : "sr-only"}>{phase === "files" ? "Fetching repository structure and selected files…" : phase === "ai" ? "Repository imported. Generating your AI overview…" : "Ready"}</div>
        {error && <div role="alert" className="notice error"><Icon name="issue"/><div><strong>We couldn’t import that repository</strong><p>{error}</p></div></div>}
        {active === 1 ? <CodebaseChat repoUrl={url.trim()} /> : active === 2 ? <IssueFinder repoUrl={url.trim()} /> : active !== 0 ? <section className="coming-soon panel"><span className="feature-icon"><Icon name={tools[active].icon} size={34}/></span><span className="eyebrow">COMING NEXT</span><h1>{tools[active].name}</h1><p>{tools[active].description}</p><p className="muted">This feature isn’t connected yet. Start with the repository analyzer to explore the code today.</p><button className="primary" onClick={() => setActive(0)}>Back to analyzer <Icon name="arrow" size={18}/></button></section> : <>
          <section className="street-banner" aria-label="Explore open source">
            <div className="street-copy"><span className="eyebrow">OPEN SOURCE. OPEN POSSIBILITIES.</span><h2>Read the code.<br/><span>Leave your mark.</span></h2><p>Your next contribution starts with a little curiosity.</p></div>
            <svg className="street-art" viewBox="0 0 240 190" fill="none" aria-hidden="true">
              <path d="m140 6 14 28 31-15-9 33 39 9-31 20 28 29-37-2 1 35-29-23-22 27-5-36-37 9 21-30-29-19 38-5-8-32 27 15Z" fill="#fa784b" stroke="#20231d" strokeWidth="3"/>
              <g transform="rotate(-10 100 100)"><path d="M34 48h128v91H34z" fill="#fffdf4" stroke="#20231d" strokeWidth="4"/><path d="M44 60h108v65H44z" fill="#20231d"/><path d="m74 76-13 15 13 15m47-30 13 15-13 15m-19-34-9 38" stroke="#dbea68" strokeWidth="5" strokeLinejoin="miter"/><path d="M20 139h156l13 15H8z" fill="#fffdf4" stroke="#20231d" strokeWidth="4"/><path d="M79 140h39" stroke="#20231d" strokeWidth="4"/></g>
              <path d="M187 122h12v12h12v12h-12v12h-12v-12h-12v-12h12ZM20 20h8v8h8v8h-8v8h-8v-8h-8v-8h8Z" fill="#20231d"/>
              <path d="M66 167q58 22 101-7m-13-3 16 1-9 14" stroke="#20231d" strokeWidth="4" strokeLinecap="round"/><path d="m207 35 13-11m-9 28 20-3M36 165l-12 13" stroke="#20231d" strokeWidth="3"/>
              <path d="M224 89h6v6h-6zM8 103h7v7H8zM182 17h5v5h-5z" fill="#20231d"/>
            </svg><span className="street-edition">GITNOVA CREATIVE DEPT. / 001</span>
          </section>
          <section className="repo-heading"><div className="repo-identity"><div className="repo-icon"><Icon name="github" size={28}/></div><div><div className="repo-title">{context ? <><span>{context.repository.owner}</span><span className="slash">/</span>{context.repository.name}<span className="badge">Public</span></> : "Your next repository"}</div><p>Explore. Understand. Contribute.</p></div></div><div className="repo-actions">{context && <a href={repoLink} target="_blank" rel="noreferrer">View on GitHub <Icon name="external" size={13}/></a>}<span className="coverage"><span className="status-dot"/>{preview ? "Example workspace" : context ? `${context.files.length} ${context.files.length === 1 ? "file" : "files"} loaded${context.truncated ? " · Partial coverage" : ""}` : "Ready to explore"}</span></div></section>
          {aiError && <div className="notice" role="alert"><Icon name="spark"/><div><strong>Files are ready. AI overview is unavailable.</strong><p>{aiError}</p></div></div>}
          <div className="dashboard-grid"><div className="main-column"><section className="panel analyzer-panel"><div className="section-heading"><div><span className="eyebrow">REPOSITORY INTELLIGENCE</span><h1>Understand this repository<span className="red-dot">.</span></h1></div><span className="icon-tile"><Icon name="analyze"/></span></div>
            <section className="overview-card"><div className="small-heading"><Icon name="book" size={18}/>Repository overview<span className="badge">{preview ? "Example" : overview ? "AI generated" : "Repository data"}</span></div><p className="summary">{summary?.explanation ?? context?.repository.description ?? "Paste a public GitHub URL above to explore its structure, dependencies, and important files."}</p>{summary && citations(summary)}<div className="tags">{preview ? ["JavaScript", "Node.js", "npm"].map(tag => <span key={tag}><i/>{tag}</span>) : overview?.technologies.map(item => <span key={item.title} title={item.explanation}>{item.title}</span>) ?? context?.manifests.map(path => <button key={path} onClick={() => { setSelected(path); setTab("Dependencies"); }}><Icon name="file" size={12}/>{path}</button>)}</div></section>
            <div className="browser-tabs" role="tablist" aria-label="Repository views">{["Structure", "README", "Dependencies"].map(item => <button role="tab" aria-selected={tab === item} key={item} onClick={() => { setTab(item); if (item === "README") setSelected(context?.readme ?? ""); if (item === "Dependencies") setSelected(context?.manifests[0] ?? ""); }}>{item}</button>)}<span>{preview ? "Preview" : context?.commitSha.slice(0, 7)}</span></div>
            <div className="file-browser"><div className="file-list"><div className="list-title">{tab === "Structure" ? "REPOSITORY FILES" : tab.toUpperCase()}</div>{tab === "Structure" && context?.tree.filter(entry => entry.type === "directory" && !entry.path.includes("/")).slice(0, 8).map(entry => <div className="folder-row" key={entry.path}><Icon name="folder" size={16}/>{entry.path}/</div>)}{context?.files.filter(file => tab === "Structure" || (tab === "README" ? file.path === context.readme : context.manifests.includes(file.path))).map(file => <button key={file.path} className={selected === file.path ? "selected" : ""} onClick={() => setSelected(file.path)}><Icon name="file" size={15}/><span>{file.path}</span>{selected === file.path && <Icon name="chevron" size={12}/>}</button>)}{(!context || (tab === "README" && !context.readme) || (tab === "Dependencies" && !context.manifests.length)) && <p className="empty">{context ? "No matching files included." : "Your files will appear here."}</p>}</div><div className="file-detail"><div className="small-heading"><Icon name="code" size={17}/>{tab === "Structure" ? "Inside the repository" : tab}</div><h2>{selectedFile?.path ?? "Select a file"}</h2><p>{selectedExplanation?.explanation ?? (preview ? "Explore the files that make this project work. Import a repository to see its actual source." : "Source from the selected repository commit. File contents are displayed as text, never executed.")}</p><pre tabIndex={0} aria-label="File contents">{selectedFile?.content ?? "No file selected."}</pre>{selectedFile && !preview && <a className="source-link" href={sourceLink(selectedFile.path)} target="_blank" rel="noreferrer">View source <Icon name="external" size={12}/></a>}</div></div>
            <section className="architecture"><div className="small-heading"><Icon name="review" size={18}/>How it works <span className="muted">/ architecture</span></div>{overview ? <><p>{overview.architecture.explanation}</p>{citations(overview.architecture)}</> : preview ? <><p>A high-level look at how an Express request moves through the application.</p><div className="flow">{["Request", "Middleware", "Router", "Response"].map((label, i) => <div key={label}><span className="flow-step">0{i + 1}</span><strong>{label}</strong>{i < 3 && <Icon name="arrow" size={16}/>}</div>)}</div></> : <p>{busy ? "The architecture explanation will appear after AI analysis." : "Generate an AI overview to see how the project’s parts fit together."}</p>}</section>
          </section>{overview && <section className="panel detail-sections">{[{label: "Where to start", items: overview.readingOrder}, {label: "Getting started", items: overview.gettingStarted}, {label: "Directory guide", items: overview.directories}].map(group => <div key={group.label}><h2>{group.label}</h2>{group.items.length ? group.items.map((item, i) => <article key={i}><h3>{item.title}</h3><p>{item.explanation}</p>{citations(item)}</article>) : <p className="muted">Not enough evidence was available for this section.</p>}</div>)}</section>}</div>
          <aside className="right-column"><section className="panel chat-panel"><div className="small-heading"><Icon name="chat"/>Ask the codebase<span className="badge">AI</span></div><p>Find your way through unfamiliar code.</p><div className="question">Where should I start reading?<Icon name="arrow" size={16}/></div><div className="chat-placeholder"><span className="nova-mark"><Icon name="spark" size={19}/></span><p>Answers grounded in your repository, with sources you can follow.</p><div className="skeleton-line"/><div className="skeleton-line short"/><span className="micro">Ask a question to explore the source.</span></div><button className="text-link" onClick={() => setActive(1)}>Open codebase explainer <Icon name="arrow" size={14}/></button></section>
          <section className="panel contribution-panel"><div className="small-heading"><Icon name="spark"/>Your first contribution</div><p>Small steps. Meaningful impact.</p><div className="contribution-illustration"><span/><span/><span/><Icon name="issue" size={28}/></div><h2>Find your starting point.</h2><p>Discover approachable issues matched to your skills and interests.</p><span className="issue-tag">good first issue</span><button className="text-link" onClick={() => setActive(2)}>Open Smart Issue Finder <Icon name="arrow" size={14}/></button></section>
          <section className="coverage-panel"><Icon name="file" size={17}/><div><strong>Grounded in source</strong><p>{preview ? "Every explanation should lead you back to the code." : "Analysis uses selected files, not an exhaustive audit."}</p>{context?.warnings.map(warning => <p key={warning}>{warning}</p>)}{overview?.limitations.map(warning => <p key={warning}>{warning}</p>)}</div></section></aside></div>
          <div className="tool-grid">{tools.slice(3).map((tool, i) => <button key={tool.name} onClick={() => setActive(i + 3)}><Icon name={tool.icon} size={23}/><div><strong>{tool.name}</strong><p>{tool.description}</p><span>COMING SOON</span></div><Icon name="chevron" size={14}/></button>)}</div>
          <footer><span>BUILT FOR DEVELOPERS. OPEN TO EVERYONE.</span><span><span className="status-dot"/> {preview ? "Preview mode" : "Public repositories only"}</span></footer>
        </>}
      </div>
    </main>
  </div>;
}
