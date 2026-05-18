import { Router } from 'express';
import {
  getProject,
  getUserProjects,
  getUserProjectCount,
  createProject,
  updateProject,
  deleteProject,
} from '../db.js';

const router = Router();

// ─── GET /api/projects?userId=xxx ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId query param required' });
  }

  const projects = await getUserProjects(userId);
  res.json(projects);
});

// ─── GET /api/projects/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'project not found or expired' });
  res.json(project);
});

// ─── POST /api/projects ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { userId, name, language, defaultCode } = req.body;

  if (!userId || !name || !language) {
    return res.status(400).json({ error: 'userId, name, and language are required' });
  }
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
    return res.status(400).json({ error: 'name must be 1–50 characters' });
  }

  const count = await getUserProjectCount(userId);
  if (count >= 5) {
    return res.status(409).json({ error: 'project limit reached (max 5)' });
  }

  const project = await createProject(
    userId,
    name.trim(),
    language,
    typeof defaultCode === 'string' ? defaultCode : ''
  );

  if (!project) {
    return res.status(409).json({ error: 'project limit reached (max 5)' });
  }

  res.status(201).json(project);
});

// ─── PATCH /api/projects/:id ──────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { userId, name, language, code } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const existing = await getProject(req.params.id);
  if (!existing) return res.status(404).json({ error: 'project not found or expired' });
  if (existing.userId !== userId) return res.status(403).json({ error: 'forbidden' });

  const patch = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim().slice(0, 50);
  if (typeof language === 'string') patch.language = language;
  if (typeof code === 'string') patch.code = code;

  const updated = await updateProject(req.params.id, patch);
  res.json(updated);
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const deleted = await deleteProject(req.params.id, userId);
  if (!deleted) {
    return res.status(404).json({ error: 'project not found, expired, or forbidden' });
  }

  res.status(204).end();
});

export default router;
