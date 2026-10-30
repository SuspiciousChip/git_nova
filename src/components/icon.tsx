export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    analyze: <><path d="M4 20V10m6 10V4m6 16v-8m5 8H2"/><path d="m15 5 2 2 4-4"/></>,
    chat: <path d="M21 11a9 9 0 0 1-9 9H5l-4 2 2-6a9 9 0 1 1 18-5Z"/>,
    issue: <><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>,
    review: <><circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/><path d="M6 6v12m12 0v-7c0-4-7-2-7-6m0 0 3 1m-3-1 1 3"/></>,
    triage: <><path d="M9 5h12M9 12h12M9 19h12"/><circle cx="3" cy="5" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="19" r="1"/></>,
    duplicate: <><rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V3H3v14h4"/></>,
    folder: <path d="M2 6V4h7l3 3h10v13H2Z"/>,
    file: <><path d="M5 2h9l5 5v15H5Z"/><path d="M14 2v6h5M8 13h8m-8 4h6"/></>,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5"/>,
    external: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></>,
    code: <><path d="m7 6-5 6 5 6m10-12 5 6-5 6m-4-15-4 18"/></>,
    book: <><path d="M12 5c-3-3-7-3-10-2v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-3-1-7-1-10 2Zm0 0v16"/></>,
    spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>,
    settings: <><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    github: <><path d="M9 20c-5 2-5-3-7-3m15 5v-4c0-1-.3-2-1-3 4 0 6-2 6-5 0-2-1-3-2-4 0-1 0-3-1-4-2 0-3 1-4 2-2-1-4-1-6 0-1-1-2-2-4-2-1 1-1 3-1 4-1 1-2 2-2 4 0 3 2 5 6 5-.7 1-1 2-1 3v4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.code}</svg>;
}
