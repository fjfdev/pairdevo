import { getProject, updateProject } from '../db.js';

/**
 * rooms: Map<projectId, Set<WebSocket>>
 * Tracks all live connections grouped by project room.
 */
const rooms = new Map();

function getRoomSize(projectId) {
  return rooms.get(projectId)?.size ?? 0;
}

function broadcast(projectId, message, exclude = null) {
  const room = rooms.get(projectId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const client of room) {
    if (client !== exclude && client.readyState === 1 /* OPEN */) {
      client.send(payload);
    }
  }
}

function broadcastPeers(projectId) {
  broadcast(projectId, { type: 'peers', count: getRoomSize(projectId) });
}

/**
 * Main WebSocket connection handler.
 * Expected URL query params: ?projectId=xxx&userId=xxx
 */
export function handleWsConnection(ws, req) {
  const url = new URL(req.url, 'http://localhost');
  const projectId = url.searchParams.get('projectId');
  const userId = url.searchParams.get('userId');

  if (!projectId || !userId) {
    ws.close(4000, 'projectId and userId are required');
    return;
  }

  // Verify project exists before admitting the client
  getProject(projectId).then((project) => {
    if (!project) {
      ws.close(4004, 'project not found or expired');
      return;
    }

    // Join the room
    if (!rooms.has(projectId)) rooms.set(projectId, new Set());
    rooms.get(projectId).add(ws);

    // Send the current project state to the joining client
    ws.send(JSON.stringify({ type: 'init', project }));

    // Notify all peers (including the new client) of updated count
    broadcastPeers(projectId);

    // ── Message handler ──────────────────────────────────────────────────────
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // ignore malformed messages
      }

      switch (msg.type) {
        case 'code:change': {
          if (typeof msg.code !== 'string') break;
          await updateProject(projectId, { code: msg.code });
          broadcast(projectId, { type: 'code:change', code: msg.code }, ws);
          break;
        }

        case 'language:change': {
          if (typeof msg.language !== 'string') break;
          const patch = { language: msg.language };
          // Include the new default code when language changes
          if (typeof msg.code === 'string') patch.code = msg.code;
          await updateProject(projectId, patch);
          broadcast(projectId, { type: 'language:change', language: msg.language, code: msg.code ?? null }, ws);
          break;
        }

        case 'name:change': {
          if (typeof msg.name !== 'string' || !msg.name.trim()) break;
          await updateProject(projectId, { name: msg.name.trim().slice(0, 50) });
          broadcast(projectId, { type: 'name:change', name: msg.name.trim().slice(0, 50) }, ws);
          break;
        }

        default:
          break;
      }
    });

    // ── Disconnect handler ───────────────────────────────────────────────────
    ws.on('close', () => {
      const room = rooms.get(projectId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(projectId);
        } else {
          broadcastPeers(projectId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[ws] error for project ${projectId}:`, err.message);
    });
  });
}
