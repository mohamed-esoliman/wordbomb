import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { loadDefaultDictionary, type Dictionary } from './dictionary/dictionary.ts';
import { buildPromptIndex, createPromptPicker, type PromptPicker } from './dictionary/prompts.ts';
import { RoomManager } from './rooms/roomManager.ts';
import { registerSocketHandlers, type IoServer, type Limits } from './rooms/socketHandlers.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  dictionary?: Dictionary;
  prompts?: PromptPicker;
  cleanupIntervalMs?: number;
  webDist?: string;
  limits?: Partial<Limits>;
}

interface LooseEmitter {
  emit(event: string, payload: unknown): boolean;
}

export function createApp(options: AppOptions = {}) {
  const dictionary = options.dictionary ?? loadDefaultDictionary();
  const prompts = options.prompts ?? createPromptPicker(buildPromptIndex(dictionary.words));

  const app = express();
  const httpServer = createServer(app);
  const io: IoServer = new Server(httpServer, { serveClient: false });

  const manager = new RoomManager({
    now: Date.now,
    rng: Math.random,
    dictionary,
    prompts,
    emit: (roomId, event, payload, volatile) => {
      const target = io.to(roomId);
      const operator = (volatile ? target.volatile : target) as unknown as LooseEmitter;
      operator.emit(event, payload);
    },
  });
  registerSocketHandlers(io, manager, options.limits);
  manager.startCleanup(options.cleanupIntervalMs ?? 60_000);

  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: manager.rooms.size });
  });
  app.get('/api/rooms', (_req, res) => {
    res.json(manager.listPublic());
  });

  const webDist = options.webDist ?? process.env.WEB_DIST ?? path.resolve(here, '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  const close = async () => {
    manager.stop();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { app, httpServer, io, manager, dictionary, close };
}
