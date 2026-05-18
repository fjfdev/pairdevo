import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  getProject,
  updateProject,
  getTimeRemaining,
  getShareUrl,
  getOrCreateUserId,
  WS_BASE,
  LANGUAGES,
  type Project,
} from '../lib/projects';

const NEON_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5a5a7a', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'bf00ff' },
    { token: 'string', foreground: '00ff88' },
    { token: 'number', foreground: 'ffee00' },
    { token: 'type', foreground: '00f5ff' },
    { token: 'function', foreground: 'ff9500' },
    { token: 'variable', foreground: 'e8e8f0' },
    { token: 'operator', foreground: 'ff0080' },
  ],
  colors: {
    'editor.background': '#0a0a0f',
    'editor.foreground': '#e8e8f0',
    'editor.lineHighlightBackground': '#16162a',
    'editor.selectionBackground': '#bf00ff33',
    'editor.inactiveSelectionBackground': '#bf00ff1a',
    'editorCursor.foreground': '#00f5ff',
    'editorLineNumber.foreground': '#3a3a60',
    'editorLineNumber.activeForeground': '#00f5ff',
    'editor.findMatchBackground': '#00f5ff33',
    'editor.findMatchHighlightBackground': '#00f5ff1a',
    'editorWidget.background': '#10101a',
    'editorWidget.border': '#2a2a45',
    'editorSuggestWidget.background': '#10101a',
    'editorSuggestWidget.border': '#2a2a45',
    'editorSuggestWidget.selectedBackground': '#16162a',
    'input.background': '#16162a',
    'input.border': '#2a2a45',
    'scrollbarSlider.background': '#2a2a45aa',
    'scrollbarSlider.hoverBackground': '#00f5ff44',
    'scrollbarSlider.activeBackground': '#00f5ff88',
  },
};

type WsStatus = 'connecting' | 'connected' | 'disconnected';

interface Props {
  projectId: string;
}

export default function CodeEditor({ projectId }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [peers, setPeers] = useState(0);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Prevent echo-back: when we receive a remote update we set this flag so the
  // local onChange handler skips sending it back over the wire.
  const isRemoteUpdate = useRef(false);

  // ── Load project from API ──────────────────────────────────────────────────

  const reload = useCallback(async () => {
    const p = await getProject(projectId);
    if (p) {
      setProject(p);
      setTimeLeft(getTimeRemaining(p.expiresAt));
    }
  }, [projectId]);

  useEffect(() => {
    reload();
    const interval = setInterval(async () => {
      const p = await getProject(projectId);
      if (p) setTimeLeft(getTimeRemaining(p.expiresAt));
    }, 30_000);
    return () => clearInterval(interval);
  }, [reload]);

  // ── WebSocket connection ───────────────────────────────────────────────────

  useEffect(() => {
    const userId = getOrCreateUserId();
    const url = `${WS_BASE}/ws?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;
    let attempt = 0;

    const BASE_DELAY = 1000;   // 1 s
    const MAX_DELAY  = 30000;  // 30 s cap

    function scheduleReconnect() {
      // Exponential backoff with ±20 % jitter: 1s, 2s, 4s, 8s, … up to 30s
      const exp = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
      const jitter = exp * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.round(exp + jitter);
      attempt += 1;
      setReconnectAttempt(attempt);
      reconnectTimer = setTimeout(connect, delay);
    }

    function connect() {
      ws = new WebSocket(url);
      wsRef.current = ws;
      setWsStatus('connecting');

      ws.onopen = () => {
        if (unmounted) return;
        attempt = 0; // reset backoff on successful connection
        setReconnectAttempt(0);
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }

        switch (msg.type) {
          case 'init':
            // Server sent the full project state on join
            setProject(msg.project);
            setTimeLeft(getTimeRemaining(msg.project.expiresAt));
            break;

          case 'code:change':
            isRemoteUpdate.current = true;
            setProject((prev) => prev ? { ...prev, code: msg.code } : prev);
            break;

          case 'language:change':
            setProject((prev) => {
              if (!prev) return prev;
              const updated = { ...prev, language: msg.language };
              if (msg.code !== null) updated.code = msg.code;
              return updated;
            });
            break;

          case 'name:change':
            setProject((prev) => prev ? { ...prev, name: msg.name } : prev);
            break;

          case 'peers':
            setPeers(msg.count);
            break;
        }
      };

      ws.onclose = (event) => {
        if (unmounted) return;
        setWsStatus('disconnected');
        setPeers(0);
        // 1000 = normal closure (e.g. project expired) — don't retry
        if (event.code !== 1000) scheduleReconnect();
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so reconnect logic lives there
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [projectId]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function wsSend(msg: object) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // ── Editor handlers ────────────────────────────────────────────────────────

  function handleEditorMount(_: unknown, monaco: any) {
    monaco.editor.defineTheme('neon-dark', NEON_THEME);
    monaco.editor.setTheme('neon-dark');
  }

  function handleCodeChange(value: string | undefined) {
    if (!project || value === undefined) return;

    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    // Optimistic local update
    setProject((prev) => prev ? { ...prev, code: value } : prev);

    // Debounce: persist to API + broadcast via WS
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateProject(projectId, { code: value });
      wsSend({ type: 'code:change', code: value });
    }, 300);
  }

  function handleLanguageChange(langId: string) {
    if (!project) return;
    const newLang = LANGUAGES.find((l) => l.id === langId);
    const oldLang = LANGUAGES.find((l) => l.id === project.language);

    // Reset code to default only if user hasn't modified it from the old default
    const newCode =
      project.code === oldLang?.defaultCode ? (newLang?.defaultCode ?? project.code) : project.code;

    setProject((prev) => prev ? { ...prev, language: langId, code: newCode } : prev);
    updateProject(projectId, { language: langId, code: newCode });
    wsSend({ type: 'language:change', language: langId, code: newCode });
  }

  function handleNameSubmit() {
    if (!project || !editingName.trim()) {
      setNameFocused(false);
      return;
    }
    const name = editingName.trim();
    setProject((prev) => prev ? { ...prev, name } : prev);
    updateProject(projectId, { name });
    wsSend({ type: 'name:change', name });
    setNameFocused(false);
  }

  async function handleCopyLink() {
    const url = getShareUrl(projectId);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] font-mono">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-pulse">⟳</div>
          <p>loading project...</p>
          <a href="/dashboard" className="text-[var(--color-neon-cyan)] hover:opacity-70 transition-opacity text-sm">
            ← back to dashboard
          </a>
        </div>
      </div>
    );
  }

  const lang = LANGUAGES.find((l) => l.id === project.language) ?? LANGUAGES[0];
  const shareUrl = getShareUrl(projectId);
  const isAlmostExpired = project.expiresAt - Date.now() < 3 * 60 * 60 * 1000;

  const wsStatusColor =
    wsStatus === 'connected'
      ? 'var(--color-neon-green)'
      : wsStatus === 'connecting'
      ? '#ffee00'
      : 'var(--color-neon-pink)';

  const wsStatusLabel =
    wsStatus === 'connected'
      ? `${peers} connected`
      : wsStatus === 'connecting'
      ? reconnectAttempt > 0 ? `reconnecting… (attempt ${reconnectAttempt})` : 'connecting...'
      : 'disconnected';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[var(--color-bg-base)]">
      {/* Editor toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0 flex-wrap">
        {/* Back */}
        <a
          href="/dashboard"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-neon-cyan)] transition-colors p-1"
          title="Back to dashboard"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Project name */}
        {nameFocused ? (
          <input
            autoFocus
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') setNameFocused(false);
            }}
            className="font-mono text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] border border-[var(--color-neon-purple)] rounded px-2 py-1 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => { setEditingName(project.name); setNameFocused(true); }}
            className="font-mono text-sm text-[var(--color-text-primary)] hover:text-[var(--color-neon-cyan)] transition-colors"
            title="Click to rename"
          >
            {project.name}
          </button>
        )}

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Language selector */}
        <div className="relative">
          <select
            value={project.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="appearance-none font-mono text-xs bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-neon-purple)]
                       rounded px-3 py-1.5 pr-7 focus:outline-none focus:border-[var(--color-neon-purple)] cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-muted)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" />
          </svg>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Expiry */}
        <span className={`text-xs font-mono flex items-center gap-1 ${isAlmostExpired ? 'text-[var(--color-neon-pink)]' : 'text-[var(--color-text-muted)]'}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" />
          </svg>
          {timeLeft}
        </span>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Share link */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <svg className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <span className="font-mono text-xs text-[var(--color-text-muted)] max-w-[180px] truncate hidden sm:block">
            {shareUrl.replace('http://', '').replace('https://', '')}
          </span>
          <button
            onClick={handleCopyLink}
            className={`text-xs font-mono px-2 py-0.5 rounded transition-all duration-200 ${
              copied
                ? 'text-[var(--color-neon-green)] border border-[var(--color-neon-green)]/40'
                : 'text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan)]/10'
            }`}
          >
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={lang.monacoId}
          value={project.code}
          onChange={handleCodeChange}
          onMount={handleEditorMount}
          theme="neon-dark"
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'line',
            lineNumbersMinChars: 3,
            overviewRulerLanes: 0,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            {lang.label}
          </span>
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            {project.code.split('\n').length} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: wsStatusColor,
              boxShadow: wsStatus === 'connected' ? `0 0 6px ${wsStatusColor}` : 'none',
              animation: wsStatus === 'connected' ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span className="text-xs font-mono" style={{ color: wsStatusColor }}>
            {wsStatusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
