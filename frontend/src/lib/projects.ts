export interface Project {
  id: string;
  userId: string;
  name: string;
  language: string;
  code: string;
  createdAt: number; // unix ms
  expiresAt: number; // unix ms (+24h)
}

export type Language = {
  id: string;
  label: string;
  monacoId: string;
  defaultCode: string;
};

export const LANGUAGES: Language[] = [
  {
    id: 'typescript',
    label: 'TypeScript',
    monacoId: 'typescript',
    defaultCode: `// TypeScript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`,
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    monacoId: 'javascript',
    defaultCode: `// JavaScript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`,
  },
  {
    id: 'python',
    label: 'Python',
    monacoId: 'python',
    defaultCode: `# Python
def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("World"))
`,
  },
  {
    id: 'rust',
    label: 'Rust',
    monacoId: 'rust',
    defaultCode: `// Rust
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    println!("{}", greet("World"));
}
`,
  },
  {
    id: 'go',
    label: 'Go',
    monacoId: 'go',
    defaultCode: `// Go
package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}

func main() {
    fmt.Println(greet("World"))
}
`,
  },
  {
    id: 'cpp',
    label: 'C++',
    monacoId: 'cpp',
    defaultCode: `// C++
#include <iostream>
#include <string>

std::string greet(const std::string& name) {
    return "Hello, " + name + "!";
}

int main() {
    std::cout << greet("World") << std::endl;
    return 0;
}
`,
  },
  {
    id: 'java',
    label: 'Java',
    monacoId: 'java',
    defaultCode: `// Java
public class Main {
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }

    public static void main(String[] args) {
        System.out.println(greet("World"));
    }
}
`,
  },
  {
    id: 'html',
    label: 'HTML',
    monacoId: 'html',
    defaultCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hello World</title>
</head>
<body>
  <h1>Hello, World!</h1>
</body>
</html>
`,
  },
  {
    id: 'css',
    label: 'CSS',
    monacoId: 'css',
    defaultCode: `/* CSS */
body {
  font-family: system-ui, sans-serif;
  background: #0a0a0f;
  color: #e8e8f0;
  margin: 0;
  padding: 2rem;
}

h1 {
  color: #00f5ff;
}
`,
  },
  {
    id: 'json',
    label: 'JSON',
    monacoId: 'json',
    defaultCode: `{
  "message": "Hello, World!",
  "version": "1.0.0",
  "features": ["real-time", "collaborative", "syntax-highlighting"]
}
`,
  },
  {
    id: 'sql',
    label: 'SQL',
    monacoId: 'sql',
    defaultCode: `-- SQL
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

SELECT * FROM users WHERE created_at > NOW() - INTERVAL '24 hours';
`,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    monacoId: 'markdown',
    defaultCode: `# Hello, World!

Welcome to **pairdevo** — real-time collaborative code sharing.

## Features

- Real-time collaboration
- Syntax highlighting for 10+ languages
- Share via link
- Auto-expires in 24h

\`\`\`typescript
const hello = (name: string) => \`Hello, \${name}!\`;
\`\`\`
`,
  },
];

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
export const WS_BASE = API_BASE.replace(/^http/, 'ws');

// ── User identity ─────────────────────────────────────────────────────────────

const USER_ID_KEY = 'pairdevo:userId';

export function getOrCreateUserId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      id = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const userId = getOrCreateUserId();
  return apiFetch<Project[]>(`/api/projects?userId=${encodeURIComponent(userId)}`);
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    return await apiFetch<Project>(`/api/projects/${id}`);
  } catch {
    return null;
  }
}

export async function canCreateProject(): Promise<boolean> {
  const projects = await getProjects();
  return projects.length < 5;
}

export async function createProject(name: string, language: string): Promise<Project | null> {
  const userId = getOrCreateUserId();
  const lang = LANGUAGES.find((l) => l.id === language) ?? LANGUAGES[0];
  try {
    return await apiFetch<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ userId, name, language: lang.id, defaultCode: lang.defaultCode }),
    });
  } catch {
    return null;
  }
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'language' | 'code'>>
): Promise<Project | null> {
  const userId = getOrCreateUserId();
  try {
    return await apiFetch<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, ...patch }),
    });
  } catch {
    return null;
  }
}

export async function deleteProject(id: string): Promise<void> {
  const userId = getOrCreateUserId();
  await apiFetch<void>(`/api/projects/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
}

export function getTimeRemaining(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getShareUrl(id: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/project?id=${id}`;
}
