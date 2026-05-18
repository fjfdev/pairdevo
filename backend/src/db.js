import redis from './redis.js';

const PROJECT_TTL = 24 * 60 * 60; // 24 hours in seconds
const MAX_PROJECTS = 5;

/**
 * Generate a 10-character alphanumeric ID.
 */
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function projectKey(id) {
  return `project:${id}`;
}

function userProjectsKey(userId) {
  return `user:${userId}:projects`;
}

/**
 * Fetch a single project from Redis. Returns null if not found or expired.
 */
export async function getProject(id) {
  const raw = await redis.get(projectKey(id));
  if (!raw) return null;
  return JSON.parse(raw);
}

/**
 * Fetch all live projects for a user (expired ones are pruned automatically).
 */
export async function getUserProjects(userId) {
  const ids = await redis.smembers(userProjectsKey(userId));
  if (!ids.length) return [];

  const projects = await Promise.all(ids.map((id) => getProject(id)));

  // Filter nulls (expired keys no longer in Redis)
  const live = projects.filter(Boolean);

  // Clean up stale IDs from the set
  const staleIds = ids.filter((id, i) => !projects[i]);
  if (staleIds.length) {
    await redis.srem(userProjectsKey(userId), ...staleIds);
  }

  return live.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Count how many live projects a user currently has.
 */
export async function getUserProjectCount(userId) {
  const projects = await getUserProjects(userId);
  return projects.length;
}

/**
 * Create a new project. Returns the project or null if the user is at the limit.
 */
export async function createProject(userId, name, language, defaultCode) {
  const count = await getUserProjectCount(userId);
  if (count >= MAX_PROJECTS) return null;

  const now = Date.now();
  const project = {
    id: generateId(),
    userId,
    name,
    language,
    code: defaultCode,
    createdAt: now,
    expiresAt: now + PROJECT_TTL * 1000,
  };

  const pipeline = redis.pipeline();
  pipeline.set(projectKey(project.id), JSON.stringify(project), 'EX', PROJECT_TTL);
  pipeline.sadd(userProjectsKey(userId), project.id);
  pipeline.expire(userProjectsKey(userId), PROJECT_TTL + 3600); // set +1h buffer
  await pipeline.exec();

  return project;
}

/**
 * Update mutable fields of a project (name, language, code).
 * Refreshes the TTL to its original 24 h window from creation.
 */
export async function updateProject(id, patch) {
  const project = await getProject(id);
  if (!project) return null;

  const updated = { ...project, ...patch };

  // Calculate remaining TTL so we don't extend past the original expiry
  const ttlSeconds = Math.max(1, Math.floor((updated.expiresAt - Date.now()) / 1000));
  await redis.set(projectKey(id), JSON.stringify(updated), 'EX', ttlSeconds);

  return updated;
}

/**
 * Delete a project by ID. Verifies ownership via userId.
 */
export async function deleteProject(id, userId) {
  const project = await getProject(id);
  if (!project) return false;
  if (project.userId !== userId) return false;

  const pipeline = redis.pipeline();
  pipeline.del(projectKey(id));
  pipeline.srem(userProjectsKey(userId), id);
  await pipeline.exec();

  return true;
}
