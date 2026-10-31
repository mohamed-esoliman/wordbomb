import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  io.on('connection', (socket) => {
    socket.on('ping', (ack: (reply: string) => void) => ack('pong'));
  });

  const webDist = process.env.WEB_DIST ?? path.resolve(here, '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return { app, httpServer, io };
}
