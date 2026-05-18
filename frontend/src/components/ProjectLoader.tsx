import React, { useEffect, useState } from 'react';
import CodeEditor from './CodeEditor';

export default function ProjectLoader() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Read id from URL hash: /project#id=xxx
    // or from query param: /project?id=xxx
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const id = params.get('id') ?? hashParams.get('id') ?? window.location.hash.replace('#', '');
    setProjectId(id || null);
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] text-[var(--color-text-muted)] font-mono">
        <span className="animate-pulse">loading...</span>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] text-[var(--color-text-muted)] font-mono">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔍</div>
          <p>no project id provided</p>
          <a href="/dashboard" className="text-[var(--color-neon-cyan)] hover:opacity-70 transition-opacity text-sm">
            ← back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return <CodeEditor projectId={projectId} />;
}
