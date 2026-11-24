import dns from 'node:dns';
import Fastify from 'fastify';
import cors from '@fastify/cors';

// Prefer IPv4 first on Windows to avoid intermittent IPv6 (AAAA) connection timeouts to Google/OpenAI APIs
dns.setDefaultResultOrder('ipv4first');
import {
  clearAllAudioTakes,
  clearAllTempImages,
  clearCambridgeTempAudios,
} from './store.js';
import { getConnectedClientCount } from './inboxHub.js';
import { startAllWatchers, stopAllWatchers } from './services/watchers.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerDictionaryRoutes } from './routes/dictionary.js';
import { registerAudioRoutes } from './routes/audio.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerDownloadsRoutes } from './routes/downloads.js';
import { registerHandoffRoutes } from './routes/handoff.js';
import { registerAnkiRoutes } from './routes/anki.js';
import { registerInboxRoutes } from './routes/inbox.js';
import { registerGeminiRoutes } from './routes/gemini.js';

const PORT = Number(process.env.PORT || 3847);
const HOST = process.env.HOST || '127.0.0.1';

const app = Fastify({
  logger: false,
  bodyLimit: 25 * 1024 * 1024, // Support high-res images from Gemini / Grok / ChatGPT
  routerOptions: { maxParamLength: 1024 },
});

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Clean up all leftover temporary previews on boot
clearAllAudioTakes();
clearAllTempImages();
clearCambridgeTempAudios();

// Start background folder & clipboard watchers
startAllWatchers();

process.on('SIGINT', () => {
  stopAllWatchers();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAllWatchers();
  process.exit(0);
});
process.on('exit', stopAllWatchers);

app.get('/api/health', async () => ({
  ok: true,
  service: 'AnkiSuperSupporter',
  sseClients: getConnectedClientCount(),
}));

await app.register(registerSettingsRoutes);
await app.register(registerDictionaryRoutes);
await app.register(registerAudioRoutes);
await app.register(registerMediaRoutes);
await app.register(registerDownloadsRoutes);
await app.register(registerHandoffRoutes);
await app.register(registerAnkiRoutes);
await app.register(registerInboxRoutes);
await app.register(registerGeminiRoutes);

app.listen({ port: PORT, host: HOST }).then(() => {
  console.log(`AnkiSuperSupporter Server running at http://${HOST}:${PORT}`);
});
