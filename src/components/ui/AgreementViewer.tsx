'use client';

import { useMemo, useState, useRef, useEffect, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import AgreementEditor from './AgreementEditor';
import AgreementFinalizeStep from './AgreementFinalizeStep';

interface RedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  clause: string;
  issue: string;
  recommendation: string;
}

interface AgreementTimelineEvent {
  id: string;
  type: string;
  actorRole: string;
  summary: string;
  createdAt: Date | string;
}

interface AgreementRevisionSummary {
  id: string;
  versionNumber: number;
  createdAt: Date | string;
  rawContent: string;
  plainLanguageSummary: string;
  plainLanguageSummaryMs?: string | null;
}

interface AgreementChangeRequestSummary {
  id: string;
  category: string;
  requestedChange: string;
  reason: string;
  note?: string | null;
  status: string;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
}

interface FinalizeChecklistBase {
  hasRawContent: boolean;
  isWizardComplete: boolean;
  unresolvedStructuredRequests: number;
  hasRequiredIdentityData: boolean;
  isFinalizableStatus: boolean;
}

interface Props {
  agreementId: string;
  status: string;
  rawContent: string;
  plainLanguageSummary: string;
  plainLanguageSummaryMs?: string | null;
  redFlags: RedFlag[];
  redFlagsMs?: RedFlag[] | null;
  tenantName: string;
  propertyAddress: string;
  readOnly?: boolean;
  contentHash?: string | null;
  signedAt?: Date | string | null;
  signedByIp?: string | null;
  txHash?: string | null;
  events?: AgreementTimelineEvent[];
  revisions?: AgreementRevisionSummary[];
  changeRequests?: AgreementChangeRequestSummary[];
  finalizeChecklistBase?: FinalizeChecklistBase | null;
  editable?: boolean;
  editableInitialContent?: string;
  negotiationNotes?: string | null;
  tenancyStartDate?: string;
  tenancyEndDate?: string;
  tenancyMonthlyRent?: number;
  tenancyDepositAmount?: number;
}

type Tab = 'agreement' | 'summary' | 'redflags' | 'edit' | 'history';
type DisplayLanguage = 'en' | 'ms';

const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  DRAFT:                   { label: 'Draft',                  dot: '#9CA3AF', text: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  FINALIZED:               { label: 'Finalized',              dot: '#10B981', text: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  PENDING_SIGNATURE_PROOF: { label: 'Pending Signature',      dot: '#3B82F6', text: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  SIGNED:                  { label: 'Signed',                 dot: '#22C55E', text: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  NEGOTIATING:             { label: 'Negotiating',            dot: '#8B5CF6', text: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status.replace(/_/g, ' '), dot: '#9CA3AF', text: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' };
  return (
    <span style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.text }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold">
      <span style={{ background: meta.dot }} className="w-1.5 h-1.5 rounded-full" />
      {meta.label}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'HIGH') return (
    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </div>
  );
  if (severity === 'MEDIUM') return (
    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
  return (
    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}

const SEVERITY_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  HIGH:   { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  MEDIUM: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  LOW:    { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
};

const SEVERITY_FLAG_STYLE: Record<string, { border: string; bg: string }> = {
  HIGH:   { border: '#EF4444', bg: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7F7 100%)' },
  MEDIUM: { border: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEFCE8 100%)' },
  LOW:    { border: '#3B82F6', bg: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)' },
};

const TAB_ICONS: Record<string, ReactElement> = {
  agreement: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  summary: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h10M4 18h8" />
    </svg>
  ),
  redflags: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  edit: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  history: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ── Document reader ─────────────────────────────────────────────────────────

interface DocSection { id: string; title: string; }
interface DocNode {
  type: 'title' | 'section-header' | 'party-label' | 'structural' | 'sub-clause' | 'alpha-item' | 'meta' | 'para';
  text: string;
  sectionId?: string;
}

function parseDocumentSections(raw: string): { nodes: DocNode[]; toc: DocSection[] } {
  const nodes: DocNode[] = [];
  const toc: DocSection[] = [];
  let secIdx = 0;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;

    if (t.startsWith('AI-generated') || t.startsWith('Note:')) {
      nodes.push({ type: 'meta', text: t });
      continue;
    }

    // Numbered section header: "1. MOSTLY UPPERCASE TITLE"
    const numMatch = t.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      const titlePart = numMatch[2];
      const ups = (titlePart.match(/[A-Z]/g) ?? []).length;
      const alphas = (titlePart.match(/[a-zA-Z]/g) ?? []).length;
      if (alphas > 0 && ups / alphas > 0.6) {
        secIdx++;
        const id = `ds-${secIdx}`;
        toc.push({ id, title: t });
        nodes.push({ type: 'section-header', text: t, sectionId: id });
        continue;
      }
    }

    // Sub-clause: "1.1 ..." or "2.3.1 ..."
    if (/^\d+\.\d+/.test(t)) { nodes.push({ type: 'sub-clause', text: t }); continue; }

    // Alpha recital items: "A. ..."
    if (/^[A-Z]\.\s+\S/.test(t)) { nodes.push({ type: 'alpha-item', text: t }); continue; }

    // Lower alpha / roman list items
    if (/^[a-z]\)\s|^\([a-z]\)\s|^\(i+v?\)\s/.test(t)) { nodes.push({ type: 'alpha-item', text: t }); continue; }

    // Structural keywords
    if (t === 'BETWEEN' || t === 'AND') { nodes.push({ type: 'party-label', text: t }); continue; }
    if (/^WHEREAS[:\s]|^NOW IT IS HEREBY/.test(t)) { nodes.push({ type: 'structural', text: t }); continue; }

    // All-caps line → title or unnamed section
    const stripped = t.replace(/[^A-Za-z]/g, '');
    if (stripped.length > 0 && stripped === stripped.toUpperCase() && t.length <= 80) {
      if (/AGREEMENT|TENANCY|RESIDENTIAL/.test(t)) {
        nodes.push({ type: 'title', text: t });
      } else {
        secIdx++;
        const id = `ds-${secIdx}`;
        toc.push({ id, title: t });
        nodes.push({ type: 'section-header', text: t, sectionId: id });
      }
      continue;
    }

    nodes.push({ type: 'para', text: t });
  }
  return { nodes, toc };
}

function DocumentReader({ content }: { content: string }) {
  const { nodes, toc } = useMemo(() => parseDocumentSections(content), [content]);
  const [activeSection, setActiveSection] = useState<string | null>(toc[0]?.id ?? null);
  const [readProgress, setReadProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const secElsRef = useRef<Record<string, HTMLDivElement>>({});
  // Prevents scroll handler from overriding a click-initiated section change
  const clickLockRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const progress = scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * 100 : 100;
      setReadProgress(progress);

      // Don't fight the smooth-scroll animation after a TOC click
      if (clickLockRef.current) return;

      const containerTop = el.getBoundingClientRect().top;
      let active: string | null = null;
      for (const [id, ref] of Object.entries(secElsRef.current)) {
        if (ref.getBoundingClientRect().top - containerTop <= 96) active = id;
      }
      // At the very bottom, snap to the last section so it can always be activated
      if (progress >= 99 && toc.length > 0) active = toc[toc.length - 1].id;
      if (active !== null) setActiveSection(active);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const ref = secElsRef.current[id];
    const el = scrollRef.current;
    if (ref && el) {
      // Lock immediately so the scroll handler doesn't override our selection
      clickLockRef.current = true;
      setActiveSection(id);
      const offset = ref.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 52;
      el.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
      // Release after smooth-scroll animation finishes (~600 ms)
      setTimeout(() => { clickLockRef.current = false; }, 650);
    }
  };

  const makeRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) secElsRef.current[id] = el;
  };

  return (
    <div className="av-doc-fade">
      {/* Reading progress bar — percentage only shown once user scrolls */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(196,154,60,0.12)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${readProgress}%`, background: 'linear-gradient(90deg,#C49A3C,#E8B84B)' }} />
        </div>
        {readProgress > 0 && (
          <span className="text-[10px] font-semibold tabular-nums shrink-0" style={{ color: '#A07820' }}>
            {Math.round(readProgress)}%
          </span>
        )}
      </div>

      <div className="flex gap-5 items-start">
        {/* Scrollable document body */}
        <div ref={scrollRef} className="av-doc-reader flex-1 min-w-0 overflow-y-auto pr-1"
          style={{ maxHeight: '68vh' }}>
          <div className="pb-10">
            {nodes.map((node, idx) => {
              switch (node.type) {
                case 'title':
                  return (
                    <h1 key={idx} className="av-serif text-center text-[21px] font-bold text-gray-900 mb-6 mt-1 tracking-wide leading-tight">
                      {node.text}
                    </h1>
                  );

                case 'section-header': {
                  const m = node.text.match(/^(\d+\.\s+)(.+)/);
                  return (
                    <div key={idx} id={node.sectionId} ref={makeRef(node.sectionId!)} className="mt-9 mb-4 scroll-mt-16">
                      <div className="h-px mb-3" style={{ background: 'linear-gradient(90deg,rgba(196,154,60,0.4),transparent)' }} />
                      <h2 className="av-serif text-[15px] font-bold text-gray-900 leading-snug">
                        {m
                          ? <><span className="av-clause-num">{m[1]}</span>{m[2]}</>
                          : node.text}
                      </h2>
                    </div>
                  );
                }

                case 'party-label':
                  return (
                    <div key={idx} className="text-center my-5">
                      <span className="av-serif text-[12px] font-semibold tracking-[0.25em] uppercase"
                        style={{ color: '#7A5A10' }}>
                        {node.text}
                      </span>
                    </div>
                  );

                case 'structural':
                  return (
                    <p key={idx} className="av-serif text-[14px] font-semibold text-gray-700 mt-6 mb-2">
                      {node.text}
                    </p>
                  );

                case 'sub-clause': {
                  const m = node.text.match(/^([\d.]+)\s+(.+)/);
                  return (
                    <p key={idx} className="text-[13px] text-gray-800 leading-[1.8] ml-5 mt-2.5">
                      {m
                        ? <><span className="av-clause-num">{m[1]} </span>{m[2]}</>
                        : node.text}
                    </p>
                  );
                }

                case 'alpha-item':
                  return (
                    <p key={idx} className="text-[13px] text-gray-800 leading-[1.8] ml-7 mt-2">
                      {node.text}
                    </p>
                  );

                case 'meta':
                  return (
                    <div key={idx} className="rounded-lg px-3 py-2 mb-5 text-[11px] text-gray-400 italic"
                      style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                      {node.text}
                    </div>
                  );

                default:
                  return (
                    <p key={idx} className="text-[13.5px] text-gray-800 leading-[1.95] mt-3">
                      {node.text}
                    </p>
                  );
              }
            })}
          </div>
        </div>

        {/* Sticky in-document TOC (2XL screens only) */}
        {toc.length > 0 && (
          <nav className="hidden 2xl:block w-36 shrink-0">
            <div className="sticky top-0 rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(196,154,60,0.15)', background: 'rgba(254,252,247,0.9)' }}>
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(196,154,60,0.1)' }}>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: '#C49A3C' }}>
                  Sections
                </p>
              </div>
              <div className="p-1.5 space-y-px">
                {toc.map((item) => (
                  <button key={item.id} type="button" onClick={() => scrollTo(item.id)}
                    className={`av-toc-item block w-full text-left text-[10px] px-2 py-1.5 rounded-lg leading-snug transition-all ${
                      activeSection === item.id ? 'av-toc-active' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}>
                    {item.title.length > 36 ? item.title.slice(0, 36) + '…' : item.title}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

export default function AgreementViewer({
  agreementId,
  status,
  rawContent,
  plainLanguageSummary,
  plainLanguageSummaryMs,
  redFlags,
  redFlagsMs,
  tenantName,
  propertyAddress,
  readOnly = false,
  contentHash,
  signedAt,
  signedByIp,
  txHash,
  events = [],
  revisions = [],
  changeRequests = [],
  finalizeChecklistBase = null,
  editable = false,
  editableInitialContent,
  negotiationNotes,
  tenancyStartDate,
  tenancyEndDate,
  tenancyMonthlyRent,
  tenancyDepositAmount,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('agreement');
  const [displayLanguage, setDisplayLanguage] = useState<DisplayLanguage>('en');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    revisions[0]?.id ?? null,
  );

  const displaySummary =
    displayLanguage === 'ms' && plainLanguageSummaryMs
      ? plainLanguageSummaryMs
      : plainLanguageSummary;
  const displayRedFlags =
    displayLanguage === 'ms' && redFlagsMs && redFlagsMs.length > 0
      ? redFlagsMs
      : redFlags;
  const isMalay = displayLanguage === 'ms';

  const highCount = redFlags.filter((f) => f.severity === 'HIGH').length;
  const isDraftLike = status === 'DRAFT' || status === 'NEGOTIATING';
  const isSigned = status === 'SIGNED';
  const hasTenancyTermsForFinalize =
    tenancyStartDate != null &&
    tenancyEndDate != null &&
    tenancyMonthlyRent !== undefined &&
    tenancyDepositAmount !== undefined;
  const showFinalizeButton =
    isDraftLike && !readOnly && finalizeChecklistBase && hasTenancyTermsForFinalize;
  const showEditTab = editable && !readOnly && !isSigned && status !== 'PENDING_SIGNATURE_PROOF';
  const currentVersion = revisions[0]?.versionNumber ?? 1;
  const latestEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const selectedRevision =
    revisions.find((r) => r.id === selectedRevisionId) ?? revisions[0] ?? null;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'agreement', label: 'Full Agreement' },
    { key: 'summary',   label: 'Plain Language' },
    { key: 'redflags',  label: 'Red Flags', badge: redFlags.length },
    ...(showEditTab ? [{ key: 'edit' as const, label: 'Edit' }] : []),
    { key: 'history', label: 'History', badge: latestEvents.length },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .av-root { font-family: 'Outfit', system-ui, sans-serif; }
        .av-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .av-mono  { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 11px; }

        .av-sidebar { background: linear-gradient(180deg, #1C2740 0%, #17213A 100%); }
        .av-action  { background: linear-gradient(180deg, #131927 0%, #0F1520 100%); }

        .av-sidebar-divider { border-color: rgba(255,255,255,0.055); }

        .av-nav-btn { transition: all 0.15s ease; }
        .av-nav-btn:hover:not(.av-nav-active) { background: rgba(255,255,255,0.04); }
        .av-nav-active {
          background: linear-gradient(135deg, rgba(196,154,60,0.14) 0%, rgba(196,154,60,0.05) 100%);
          border-left: 2px solid #C49A3C;
          padding-left: calc(0.75rem - 2px) !important;
          color: #E8B84B !important;
        }

        .av-document {
          background: linear-gradient(180deg, #FEFCF7 0%, #FDFAF5 100%);
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.06);
          border: 1px solid rgba(0,0,0,0.07);
        }

        .av-finalize-btn {
          background: linear-gradient(135deg, #C49A3C 0%, #E8B84B 60%, #D4A840 100%);
          box-shadow: 0 4px 14px rgba(196,154,60,0.38);
          transition: all 0.2s ease;
          color: #1a1200;
          font-weight: 600;
        }
        .av-finalize-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #D4AA4C 0%, #F0C455 60%, #E2B848 100%);
          box-shadow: 0 6px 20px rgba(196,154,60,0.48);
          transform: translateY(-1px);
        }
        .av-finalize-btn:disabled {
          background: linear-gradient(135deg, #374151 0%, #2D3748 100%);
          box-shadow: none;
          color: #6B7280;
          cursor: not-allowed;
          transform: none;
        }

        .av-pdf-btn {
          background: linear-gradient(135deg, rgba(196,154,60,0.09), rgba(196,154,60,0.04));
          border: 1px solid rgba(196,154,60,0.28);
          color: #C49A3C;
          transition: all 0.18s ease;
        }
        .av-pdf-btn:hover {
          background: linear-gradient(135deg, rgba(196,154,60,0.18), rgba(196,154,60,0.09));
          box-shadow: 0 2px 8px rgba(196,154,60,0.2);
        }

        .av-checklist-pass {
          background: rgba(16,185,129,0.09);
          border: 1px solid rgba(16,185,129,0.22);
          color: #6EE7B7;
        }
        .av-checklist-fail {
          background: rgba(245,158,11,0.09);
          border: 1px solid rgba(245,158,11,0.22);
          color: #FCD34D;
        }

        .av-lang-seg { background: rgba(0,0,0,0.25); border-radius: 10px; padding: 2px; }
        .av-lang-opt { flex: 1; padding: 6px 0; font-size: 11px; font-weight: 600; border-radius: 8px; transition: all 0.15s ease; color: #6B7280; }
        .av-lang-on  { background: white; color: #1C2740; box-shadow: 0 1px 4px rgba(0,0,0,0.14); }

        .av-gold-icon-wrap {
          background: rgba(196,154,60,0.12);
          border-radius: 8px;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        @keyframes av-pulse-warn {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .av-pulse { animation: av-pulse-warn 2.2s ease-in-out infinite; }

        .av-doc-divider { border-color: #EDE8DE; }
        .av-mobile-tab { border-bottom-width: 2px; transition: color 0.15s, border-color 0.15s; }

        .av-doc-reader {
          scrollbar-width: thin;
          scrollbar-color: rgba(196,154,60,0.25) transparent;
        }
        .av-doc-reader::-webkit-scrollbar { width: 4px; }
        .av-doc-reader::-webkit-scrollbar-track { background: transparent; }
        .av-doc-reader::-webkit-scrollbar-thumb { background: rgba(196,154,60,0.2); border-radius: 2px; }
        .av-doc-reader::-webkit-scrollbar-thumb:hover { background: rgba(196,154,60,0.45); }

        .av-clause-num { color: #9A6E10; font-weight: 700; }
        .av-toc-active { font-weight: 600; background: rgba(196,154,60,0.09); color: #7A4F00; }

        @keyframes av-doc-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .av-doc-fade { animation: av-doc-fade 0.25s ease both; }
      `}</style>

      <div className="av-root">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <div className="w-[3px] h-9 rounded-full shrink-0"
                style={{ background: 'linear-gradient(180deg,#C49A3C,#E8B84B)' }} />
              <h1 className="av-serif text-[28px] font-semibold tracking-tight text-gray-900 leading-tight">
                Tenancy Agreement
              </h1>
            </div>
            <p className="text-sm text-gray-400 ml-[15px] mt-0.5">
              {propertyAddress} &middot; {tenantName}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 pt-1">
            <StatusPill status={status} />

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              v{currentVersion}
            </div>
          </div>
        </div>


        {/* ── High-severity alert ─────────────────────────────────────── */}
        {highCount > 0 && isDraftLike && !readOnly && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3.5 rounded-xl"
            style={{ background: 'linear-gradient(135deg,#FEF2F2,#FFF8F8)', border: '1px solid #FECACA', boxShadow: '0 2px 8px rgba(239,68,68,0.09)' }}>
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-red-500 av-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">
                {highCount} High-Severity {highCount === 1 ? 'Issue' : 'Issues'} Detected
              </p>
              <p className="text-[11px] text-red-500 mt-0.5">
                Review the Red Flags tab carefully before finalizing this agreement.
              </p>
            </div>
          </div>
        )}

        {/* ── Two-column grid ────────────────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_272px]">

          {/* ── CENTER: document content ─────────────────────────────── */}
          <main className="min-w-0">
            {/* Horizontal tab bar — single row, no wrapping */}
            <div className="flex items-center gap-2 mb-1">
              {/* Tabs — scrollable if viewport is narrow */}
              <div className="flex items-center gap-1 p-1 rounded-xl flex-1 min-w-0 overflow-x-auto"
                style={{ background: 'rgba(28,39,64,0.06)', border: '1px solid rgba(28,39,64,0.08)' }}>
                {tabs.map((tab) => (
                  <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
                      activeTab === tab.key
                        ? 'text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={activeTab === tab.key ? {
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
                    } : {}}>
                    {TAB_ICONS[tab.key]}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ml-0.5">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Language toggle — always on the right, never wraps */}
              <div className="flex items-center rounded-xl p-1 shrink-0 text-[11px] font-semibold"
                style={{ background: 'rgba(28,39,64,0.06)', border: '1px solid rgba(28,39,64,0.08)' }}>
                {(['en', 'ms'] as const).map((lang) => (
                  <button key={lang} type="button" onClick={() => setDisplayLanguage(lang)}
                    className={`px-4 py-1.5 rounded-lg transition-all ${
                      displayLanguage === lang ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {lang === 'en' ? 'EN' : 'BM'}
                  </button>
                ))}
              </div>
            </div>

            {/* Bilingual scope hint — single muted line, no banner */}
            <p className="text-[10px] text-gray-400 mb-3 mt-1.5 pl-1">
              EN / BM applies to Plain Language &amp; Red Flags only — legal agreement text is English only.
            </p>

            {/* Content card */}
            <div className="av-document rounded-2xl overflow-hidden">

              {/* ── Full Agreement ── */}
              {activeTab === 'agreement' && (
                <div className="p-6 md:p-8">
                  <DocumentReader content={rawContent} />
                </div>
              )}

              {/* ── Plain Language Summary ── */}
              {activeTab === 'summary' && (
                <div className="p-6 md:p-8">
                  <div className="mb-5 pb-4 av-doc-divider border-b">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#C49A3C,#E8B84B)' }}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 6h16M4 10h16M4 14h10M4 18h8" />
                        </svg>
                      </div>
                      <h2 className="av-serif text-[22px] font-semibold text-gray-900">Plain Language Summary</h2>
                    </div>
                    <p className="text-[11px] text-gray-400 ml-8">
                      {isMalay
                        ? 'Setiap fasal dijelaskan dalam bahasa mudah untuk membantu kedua-dua pihak menyemak terma utama.'
                        : 'Each clause explained in plain language so both parties can review the key terms easily.'}
                    </p>
                    {isMalay && !plainLanguageSummaryMs && (
                      <span className="inline-block mt-2 ml-8 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                        Malay summary unavailable — showing English
                      </span>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[13.5px] text-gray-700 leading-[1.9]">
                    {displaySummary}
                  </pre>
                </div>
              )}

              {/* ── Red Flags ── */}
              {activeTab === 'redflags' && (
                <div className="p-6 md:p-8">
                  <div className="mb-5 pb-4 av-doc-divider border-b">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h2 className="av-serif text-[22px] font-semibold text-gray-900">AI Red Flag Analysis</h2>
                    </div>
                    <p className="text-[11px] text-gray-400 ml-8">
                      {isMalay
                        ? 'Analisis AI tentang isu, kekaburan, atau terma yang mungkin perlu disemak sebelum persetujuan akhir.'
                        : 'AI analysis of issues, ambiguities, or terms that may need review before finalizing.'}
                    </p>
                  </div>

                  {showEditTab && (
                    <div className="mb-5 rounded-xl px-4 py-4 flex items-start justify-between gap-4"
                      style={{ background: 'linear-gradient(135deg,#EFF6FF,#F0F9FF)', border: '1px solid #BFDBFE' }}>
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Want to address these issues?</p>
                        <p className="text-[11px] text-blue-700 mt-1">Edit the agreement text, then refresh AI analysis to update flags.</p>
                      </div>
                      <button type="button" onClick={() => setActiveTab('edit')}
                        className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-[11px] font-semibold text-white transition-colors">
                        Edit Agreement
                      </button>
                    </div>
                  )}

                  {displayRedFlags.length === 0 ? (
                    <div className="text-center py-14">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)' }}>
                        <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="av-serif text-[22px] font-semibold text-gray-800 mb-1">
                        {isMalay ? 'Tiada Isu Dikesan' : 'No Issues Detected'}
                      </p>
                      <p className="text-sm text-gray-400">
                        {isMalay
                          ? 'Analisis AI tidak menemui isu ketara untuk versi ini.'
                          : 'The AI analysis found no significant issues for this version.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayRedFlags.map((flag, index) => {
                        const sty = SEVERITY_FLAG_STYLE[flag.severity] ?? SEVERITY_FLAG_STYLE.LOW;
                        const badge = SEVERITY_BADGE[flag.severity] ?? SEVERITY_BADGE.LOW;
                        return (
                          <div key={index} className="rounded-xl p-4"
                            style={{ borderLeft: `3px solid ${sty.border}`, background: sty.bg }}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <SeverityIcon severity={flag.severity} />
                                <p className="font-semibold text-sm text-gray-900">{flag.clause}</p>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                                style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                                {flag.severity}
                              </span>
                            </div>
                            <p className="text-[13px] text-gray-700 leading-relaxed mb-3 ml-7">{flag.issue}</p>
                            <div className="ml-7 bg-white/70 rounded-lg px-3.5 py-2.5">
                              <p className="text-[11px] text-gray-600">
                                <span className="font-semibold text-gray-800">
                                  {isMalay ? 'Cadangan: ' : 'Recommendation: '}
                                </span>
                                {flag.recommendation}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Edit Agreement ── */}
              {activeTab === 'edit' && showEditTab && (
                <div className="p-6 md:p-8">
                  <div className="mb-5 pb-4 av-doc-divider border-b">
                    <h2 className="av-serif text-[22px] font-semibold text-gray-900 mb-1">Edit Agreement</h2>
                    <p className="text-sm text-gray-500">
                      Update the agreement text directly or use AI Assist to apply a specific change. After saving, refresh AI analysis before re-finalizing.
                    </p>
                  </div>
                  <AgreementEditor
                    agreementId={agreementId}
                    initialContent={editableInitialContent ?? rawContent}
                    negotiationNotes={negotiationNotes}
                    changeRequests={changeRequests}
                  />
                </div>
              )}

              {/* ── History ── */}
              {activeTab === 'history' && (
                <div className="p-6 md:p-8 space-y-6">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Current Version', value: `v${currentVersion}`, sub: `${revisions.length} revision(s)` },
                      { label: 'Timeline Events', value: `${latestEvents.length}`, sub: 'Activity recorded' },
                      { label: 'Change Requests', value: `${changeRequests.length}`, sub: 'From tenant' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{s.label}</p>
                        <p className="av-serif text-2xl font-semibold text-gray-900">{s.value}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Timeline */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Agreement Timeline</h3>
                    <p className="text-[11px] text-gray-400 mb-3">
                      Start here to understand what happened. Expand recorded versions only when you need revision metadata.
                    </p>
                    {latestEvents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-400 text-center">
                        No agreement history recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {latestEvents.map((event) => (
                          <div key={event.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-gray-900">{event.summary}</p>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0">
                                {event.actorRole}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {new Date(event.createdAt).toLocaleString('en-MY')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recorded versions */}
                  <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Recorded Versions</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Audit-only snapshots, hidden by default.</p>
                      </div>
                      {revisions.length > 0 && (
                        <button type="button" onClick={() => setShowVersionHistory((c) => !c)}
                          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                          {showVersionHistory ? 'Hide' : 'View'}
                        </button>
                      )}
                    </div>

                    {revisions.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-400 text-center">
                        No versions recorded yet.
                      </div>
                    )}

                    {revisions.length > 0 && !showVersionHistory && (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-4 text-sm text-gray-400">
                        {revisions.length} recorded version(s). Expand only when you need revision metadata.
                      </div>
                    )}

                    {showVersionHistory && (
                      <div className="space-y-2">
                        {revisions.map((revision) => (
                          <button type="button" key={revision.id}
                            onClick={() => setSelectedRevisionId(revision.id)}
                            className={`w-full rounded-xl border px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors ${
                              selectedRevision?.id === revision.id
                                ? 'border-amber-300 bg-amber-50'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Version {revision.versionNumber}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {new Date(revision.createdAt).toLocaleString('en-MY')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {currentVersion === revision.versionNumber && (
                                <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">
                                  Current
                                </span>
                              )}
                              <span className="text-[11px] font-medium text-gray-400">
                                {selectedRevision?.id === revision.id ? 'Viewing' : 'View'}
                              </span>
                            </div>
                          </button>
                        ))}

                        {selectedRevision && (
                          <div className="rounded-xl border border-gray-200 bg-white mt-3 overflow-hidden">
                            <div className="border-b border-gray-100 px-4 py-3 flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  Version {selectedRevision.versionNumber} Preview
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  Snapshot from {new Date(selectedRevision.createdAt).toLocaleString('en-MY')}
                                </p>
                              </div>
                              <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                                History
                              </span>
                            </div>
                            <div className="p-4 space-y-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
                                  Agreement Text
                                </p>
                                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4 max-h-72 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-gray-700">
                                    {selectedRevision.rawContent}
                                  </pre>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
                                  Plain Language Summary
                                </p>
                                <div className="rounded-lg border border-gray-100 bg-white px-4 py-4 max-h-40 overflow-y-auto">
                                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
                                    {displayLanguage === 'ms' && selectedRevision.plainLanguageSummaryMs
                                      ? selectedRevision.plainLanguageSummaryMs
                                      : selectedRevision.plainLanguageSummary}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Change requests */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Structured Change Requests</h3>
                    {changeRequests.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-400 text-center">
                        No structured change requests recorded for this agreement.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {changeRequests.map((req) => (
                          <div key={req.id} className="rounded-xl border border-gray-100 bg-white px-4 py-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{req.category}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {new Date(req.createdAt).toLocaleString('en-MY')}
                                </p>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                req.status === 'RESOLVED'
                                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset'
                                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 mb-2">{req.requestedChange}</p>
                            <p className="text-[11px] text-gray-500">
                              <span className="font-semibold text-gray-700">Reason: </span>{req.reason}
                            </p>
                            {req.note && (
                              <p className="text-[11px] text-gray-500 mt-1.5">
                                <span className="font-semibold text-gray-700">Note: </span>{req.note}
                              </p>
                            )}
                            {req.resolvedAt && (
                              <p className="text-[11px] text-emerald-600 mt-2">
                                Resolved on {new Date(req.resolvedAt).toLocaleString('en-MY')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* ── RIGHT: dark action panel ─────────────────────────────── */}
          <aside className="self-start">
            <div className="av-action rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Checklist header */}
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#C49A3C' }}>
                  Review Checklist
                </p>
              </div>

              {showFinalizeButton && (
                <AgreementFinalizeStep
                  agreementId={agreementId}
                  currentTerms={{
                    startDate: tenancyStartDate!,
                    endDate: tenancyEndDate!,
                    monthlyRent: tenancyMonthlyRent!,
                    depositAmount: tenancyDepositAmount!,
                  }}
                  finalizeChecklistBase={finalizeChecklistBase!}
                  onFinalized={() => router.refresh()}
                />
              )}

              {!showFinalizeButton && (
                <div className="px-4 py-4">
                  {redFlags.length > 0 ? (
                    <div className="rounded-xl px-3 py-3 text-[11px]"
                      style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.22)' }}>
                      <p className="font-semibold text-red-400">{redFlags.length} red {redFlags.length === 1 ? 'flag' : 'flags'} detected</p>
                      <p className="mt-0.5 text-gray-500">Review the Red Flags tab for details.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl px-3 py-3 text-[11px]"
                      style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.22)' }}>
                      <p className="font-semibold text-emerald-400">No red flags detected</p>
                      <p className="mt-0.5 text-gray-500">AI analysis found no significant issues.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Download */}
              <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <a href={`/api/agreements/${agreementId}/pdf`} download
                  className="av-pdf-btn flex items-center justify-center gap-2 w-full text-[11px] font-semibold px-3 py-2.5 rounded-xl">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </a>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Signing Audit Record ─────────────────────────────────── */}
        {isSigned && contentHash && (
          <div className="mt-5 rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#0F1629,#141B2E)', border: '1px solid rgba(196,154,60,0.2)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(196,154,60,0.12)' }}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" style={{ color: '#C49A3C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#C49A3C' }}>
                  Signing Audit Record
                </p>
              </div>
            </div>
            <div className="px-5 py-5 space-y-4">
              {signedAt && (
                <div className="flex items-start gap-3">
                  <div className="av-gold-icon-wrap">
                    <svg className="w-3.5 h-3.5" style={{ color: '#C49A3C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500">Signed at</p>
                    <p className="text-xs text-gray-300 mt-0.5">{new Date(signedAt).toLocaleString('en-MY')}</p>
                  </div>
                </div>
              )}

              {signedByIp && (
                <div className="flex items-start gap-3">
                  <div className="av-gold-icon-wrap">
                    <svg className="w-3.5 h-3.5" style={{ color: '#C49A3C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500">Signed from IP</p>
                    <p className="av-mono text-gray-300 mt-0.5">{signedByIp}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="av-gold-icon-wrap">
                  <svg className="w-3.5 h-3.5" style={{ color: '#C49A3C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gray-500">SHA-256 Fingerprint</p>
                  <p className="av-mono text-gray-300 mt-0.5 break-all">{contentHash}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="av-gold-icon-wrap">
                  <svg className="w-3.5 h-3.5" style={{ color: '#C49A3C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gray-500">Blockchain Anchor (Sepolia)</p>
                  {txHash ? (
                    <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                      className="av-mono break-all hover:underline mt-0.5 block" style={{ color: '#C49A3C' }}>
                      {txHash}
                    </a>
                  ) : (
                    <p className="text-[11px] text-gray-500 mt-0.5">Blockchain anchoring is still in progress.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
