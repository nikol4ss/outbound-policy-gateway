import Link from "next/link";
import type { ReactNode } from "react";

export function Mark() {
  return <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="3" y="10" width="15" height="15" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="10" y="3" width="15" height="15" rx="1" stroke="currentColor" strokeWidth="2"/></svg>;
}

export function Brand() {
  return <Link className="brand" href="/" aria-label="Call Policy home"><Mark/><span>Call Policy</span></Link>;
}

export function PublicHeader() {
  return <header className="public-header"><Brand/><nav aria-label="Main navigation"><Link href="/docs">Documentation</Link><Link className="button button-small" href="/login">Open workspace</Link></nav></header>;
}

export function PublicFooter() {
  return <footer className="public-footer"><span>Call Policy</span><p>Policy enforcement and evidence. Legal coverage must be reviewed for your use case.</p><Link href="/docs">Developer documentation</Link></footer>;
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><path d="m3 10 9-7 9 7v10H15v-6H9v6H3z"/></>,
    check: <><path d="M6 3h4l2 5-3 2a14 14 0 0 0 5 5l2-3 5 2v4c0 2-2 3-4 2C9 18 5 14 3 7c-1-2 1-4 3-4Z"/></>,
    consents: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    optouts: <><circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/></>,
    policies: <><path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    dnc: <><path d="M9 5h12M9 12h12M9 19h12"/><circle cx="4" cy="5" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="19" r="1"/></>,
    integrations: <><path d="M9 3v4H5v4H2v5h3v5h5v-3h4v3h5v-5h3v-5h-3V7h-5V3z"/></>,
    audit: <><path d="M6 3h8l5 5v13H6zM14 3v6h5M9 13h7M9 17h5"/></>,
    docs: <><path d="M12 5v16M3 4h5c3 0 4 2 4 2s1-2 4-2h5v15h-5c-3 0-4 2-4 2s-1-2-4-2H3z"/></>,
    logout: <><path d="M10 3H4v18h6M8 12h13m-5-5 5 5-5 5"/></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.audit}</svg>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><Icon name="audit"/><h3>{title}</h3><p>{children}</p></div>;
}
