'use client';

import { useState } from 'react';
import styles from './demo.module.css';

type Connection = { url: string; tokens: Record<'TENANT' | 'LANDLORD', string> };

// Shows how to point a standard MCP client at this case. Tokens are fetched only when
// the panel is opened, belong to this browser's case, and unlock the read-only tools.
export default function McpConnect({ role }: { role: 'TENANT' | 'LANDLORD' }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState(''), [copied, setCopied] = useState('');
  async function load(open: boolean) {
    if (!open || connection) return;
    try {
      const response = await fetch('/api/judge/mcp', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Connection details are unavailable.');
      setConnection(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection details are unavailable.'); }
  }
  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); } catch { setCopied(''); setError('Copy is unavailable here; select the text instead.'); }
  }
  const token = connection?.tokens[role] ?? '';
  const url = connection?.url ?? 'http://127.0.0.1:3030/api/mcp';
  const snippets = connection ? [
    { label: 'MCP Inspector (CLI)', value: `npx -y @modelcontextprotocol/inspector --cli ${url} --transport http --header "Authorization: Bearer ${token}" --method tools/list` },
    { label: 'Claude Code', value: `claude mcp add --transport http rentalease-demo ${url} --header "Authorization: Bearer ${token}"` },
    { label: 'Claude Desktop (claude_desktop_config.json)', value: JSON.stringify({ mcpServers: { 'rentalease-demo': { command: 'npx',
      args: ['-y', 'mcp-remote', url, '--transport', 'http-only', '--header', 'Authorization:${AUTH_HEADER}'], env: { AUTH_HEADER: 'Bearer ' + token } } } }, null, 2) },
  ] : [];
  return <details className={`${styles.panel} ${styles.mcp}`} onToggle={e => void load((e.currentTarget as HTMLDetailsElement).open)}>
    <summary><span className={styles.eyebrow}>For developers</span><strong>Connect an MCP client to this case</strong></summary>
    <p>The voice assistant reads this case through six MCP tools (protocol 2025-11-25, Streamable HTTP). Point MCP Inspector, Claude Code or Claude Desktop at the same server.
      The token below acts as <strong>{role === 'LANDLORD' ? 'Landlord · Daniel' : 'Tenant · Aina'}</strong>; switch roles above for the other token. Tools only read and check drafts — saving still needs <em>Confirm and save</em> on this page.</p>
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {!connection && !error && <p role="status">Loading connection details…</p>}
    {connection && <>
      <dl className={styles.connection}><dt>Server URL</dt><dd><code>{url}</code></dd><dt>Bearer token</dt><dd><code>{token}</code>
        <button type="button" onClick={() => void copy('token', token)}>{copied === 'token' ? 'Copied' : 'Copy token'}</button></dd></dl>
      {snippets.map(s => <div key={s.label} className={styles.snippet}><div><strong>{s.label}</strong>
        <button type="button" onClick={() => void copy(s.label, s.value)}>{copied === s.label ? 'Copied' : 'Copy'}</button></div><pre>{s.value}</pre></div>)}
      <p className={styles.small}>Keep the token private like a password. It follows this browser to new scenarios and stops working when the case expires. Use the exact 127.0.0.1 address.</p>
    </>}
  </details>;
}
