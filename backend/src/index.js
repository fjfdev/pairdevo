import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import projectsRouter from './routes/projects.js';
import { handleWsConnection } from './ws/handler.js';
import redis from './redis.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4321';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
app.use(express.json());

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/projects', projectsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleWsConnection);

// ── Start ─────────────────────────────────────────────────────────────────────
await redis.connect();

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
