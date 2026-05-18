import React from 'react';

interface NavbarProps {
  showDashboardLink?: boolean;
}

export default function Navbar({ showDashboardLink = true }: NavbarProps) {
  return (
    <nav className="border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <span className="font-mono text-xl font-bold text-[var(--color-neon-cyan)] text-glow-cyan group-hover:opacity-80 transition-opacity">
            &lt;/&gt;
          </span>
          <span className="font-mono text-lg font-semibold text-[var(--color-text-primary)]">
            pair<span className="text-[var(--color-neon-cyan)]">devo</span>
          </span>
        </a>

        <div className="flex items-center gap-4">
          {showDashboardLink && (
            <a
              href="/dashboard"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-cyan)] transition-colors font-mono"
            >
              my projects
            </a>
          )}
          <a
            href="/dashboard"
            className="px-4 py-1.5 rounded border border-[var(--color-neon-cyan)] text-[var(--color-neon-cyan)] text-sm font-mono
                       hover:bg-[var(--color-neon-cyan)] hover:text-[var(--color-bg-base)] transition-all duration-200 glow-cyan"
          >
            + new project
          </a>
        </div>
      </div>
    </nav>
  );
}
