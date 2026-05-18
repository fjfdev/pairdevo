import React, { useState, useEffect, useCallback } from 'react';
import {
  getProjects,
  createProject,
  deleteProject,
  canCreateProject,
  getTimeRemaining,
  LANGUAGES,
  type Project,
} from '../lib/projects';

const MAX_PROJECTS = 5;

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lang = LANGUAGES.find((l) => l.id === project.language);
  const timeLeft = getTimeRemaining(project.expiresAt);
  const isAlmostExpired = project.expiresAt - Date.now() < 3 * 60 * 60 * 1000; // < 3h

  return (
    <div className="group relative p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-bright)] transition-all duration-200">
      {/* Subtle top glow on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-neon-cyan)] to-transparent opacity-0 group-hover:opacity-40 transition-opacity rounded-t-xl" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-mono font-semibold text-[var(--color-text-primary)] truncate text-sm">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-bg-muted)] text-[var(--color-neon-purple)] border border-[var(--color-neon-purple)]/20">
              {lang?.label ?? project.language}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={() => onDelete(project.id)}
                className="text-xs font-mono text-[var(--color-neon-pink)] hover:opacity-70 transition-opacity"
              >
                confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs font-mono text-[var(--color-text-muted)] hover:opacity-70 transition-opacity"
              >
                cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-neon-pink)] p-1"
              title="Delete project"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Code preview */}
      <div className="font-mono text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] rounded-lg p-3 mb-4 h-16 overflow-hidden relative">
        <pre className="whitespace-pre-wrap break-all leading-4">
          {project.code.split('\n').slice(0, 4).join('\n')}
        </pre>
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[var(--color-bg-elevated)] to-transparent" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-mono flex items-center gap-1 ${isAlmostExpired ? 'text-[var(--color-neon-pink)]' : 'text-[var(--color-text-muted)]'}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" strokeLinecap="round" />
          </svg>
          {timeLeft}
        </span>

        <a
          href={`/project?id=${project.id}`}
          className="text-xs font-mono px-3 py-1.5 rounded border border-[var(--color-neon-cyan)]/40 text-[var(--color-neon-cyan)]
                     hover:bg-[var(--color-neon-cyan)] hover:text-[var(--color-bg-base)] transition-all duration-200"
        >
          open →
        </a>
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, lang: string) => void }) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState(LANGUAGES[0].id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), language);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl border border-[var(--color-border-bright)] bg-[var(--color-bg-elevated)] p-6 glow-purple"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono font-bold text-lg text-[var(--color-text-primary)]">
            new <span className="text-[var(--color-neon-purple)]">project</span>
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2">project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-snippet"
              maxLength={50}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]
                         text-[var(--color-text-primary)] font-mono text-sm placeholder-[var(--color-text-muted)]
                         focus:outline-none focus:border-[var(--color-neon-purple)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2">language</label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguage(lang.id)}
                  className={`px-2 py-2 rounded-lg border text-xs font-mono transition-all duration-150 ${
                    language === lang.id
                      ? 'border-[var(--color-neon-purple)] bg-[var(--color-neon-purple)]/10 text-[var(--color-neon-purple)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-3 rounded-lg bg-[var(--color-neon-purple)] text-white font-mono font-semibold text-sm
                       hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed mt-2"
          >
            create project
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [canCreate, setCanCreate] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [fetched, able] = await Promise.all([getProjects(), canCreateProject()]);
      setProjects(fetched);
      setCanCreate(able);
    } catch (err) {
      console.error('[dashboard] failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleCreate(name: string, language: string) {
    const project = await createProject(name, language);
    if (project) {
      setShowModal(false);
      window.location.href = `/project?id=${project.id}`;
    }
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    refresh();
  }

  const remaining = MAX_PROJECTS - projects.length;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-center py-24">
          <span className="text-sm font-mono text-[var(--color-text-muted)] animate-pulse">loading projects...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-mono text-[var(--color-text-primary)]">
              my <span className="text-[var(--color-neon-cyan)]">projects</span>
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] font-mono mt-1">
              {projects.length}/{MAX_PROJECTS} projects used · each expires 24h after creation
            </p>
          </div>

          {canCreate ? (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg border border-[var(--color-neon-cyan)] text-[var(--color-neon-cyan)] text-sm font-mono
                         hover:bg-[var(--color-neon-cyan)] hover:text-[var(--color-bg-base)] transition-all duration-200 glow-cyan"
            >
              + new project
            </button>
          ) : (
            <div className="text-xs font-mono text-[var(--color-neon-pink)] px-3 py-2 rounded border border-[var(--color-neon-pink)]/30 bg-[var(--color-neon-pink)]/5">
              limit reached (5/5)
            </div>
          )}
        </div>

        {/* Slot usage bar */}
        <div className="mb-8">
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_PROJECTS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < projects.length
                    ? 'bg-[var(--color-neon-cyan)]'
                    : 'bg-[var(--color-bg-muted)]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <div className="text-center py-24 space-y-6">
            <div className="text-6xl">📁</div>
            <div>
              <p className="font-mono text-[var(--color-text-secondary)] mb-2">no projects yet</p>
              <p className="text-sm text-[var(--color-text-muted)] font-mono">create one to get started</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-block px-6 py-3 rounded-lg bg-[var(--color-neon-cyan)] text-[var(--color-bg-base)] font-mono font-semibold text-sm glow-cyan hover:opacity-90 transition-opacity"
            >
              create your first project →
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onDelete={handleDelete} />
            ))}

            {/* Empty slot cards */}
            {remaining > 0 &&
              Array.from({ length: Math.min(remaining, 1) }).map((_, i) => (
                <button
                  key={`empty-${i}`}
                  onClick={() => setShowModal(true)}
                  className="p-5 rounded-xl border border-dashed border-[var(--color-border)] bg-transparent
                             hover:border-[var(--color-neon-cyan)]/50 hover:bg-[var(--color-neon-cyan)]/5 transition-all duration-200
                             text-[var(--color-text-muted)] font-mono text-sm flex flex-col items-center justify-center gap-3 min-h-[200px]"
                >
                  <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs">new project</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}
