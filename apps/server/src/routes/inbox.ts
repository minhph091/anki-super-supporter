import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  sanitizeAnkiBoldText,
  stripHtmlToPlainText,
  type InboxInsertMode,
  type InboxMessage,
  type InboxTargetField,
} from '@ass/shared';
import { cleanCambridgeDefinitionText } from '../services/dictionary/registry.js';
import {
  broadcastInboxMessage,
  getConnectedClientCount,
  getRecentInboxMessages,
  registerSseClient,
} from '../inboxHub.js';

const VALID_TARGETS = new Set<InboxTargetField>([
  'word',
  'example_en',
  'example_vi',
  'definition',
  'ipa',
]);

export async function registerInboxRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      target: InboxTargetField;
      text: string;
      mode?: InboxInsertMode;
      cleanWrapper?: boolean;
      sourceUrl?: string;
      sourceTitle?: string;
    };
  }>('/api/inbox', async (req, reply) => {
    const { target, text, mode = 'replace', cleanWrapper = true, sourceUrl, sourceTitle } =
      req.body ?? ({} as never);

    if (!target || !VALID_TARGETS.has(target)) {
      return reply.code(400).send({ error: 'Trường đích target không hợp lệ.' });
    }

    const isExampleTarget = target === 'example_en' || target === 'example_vi';
    let rawPlain = isExampleTarget
      ? sanitizeAnkiBoldText(String(text ?? ''), false)
      : stripHtmlToPlainText(String(text ?? ''), cleanWrapper);
    if (isExampleTarget && cleanWrapper && rawPlain) {
      rawPlain = rawPlain.replace(/^(?:[-•*–—]|\d+[.)])\s+/, '');
      if (
        (rawPlain.startsWith('"') && rawPlain.endsWith('"')) ||
        (rawPlain.startsWith('“') && rawPlain.endsWith('”')) ||
        (rawPlain.startsWith("'") && rawPlain.endsWith("'"))
      ) {
        rawPlain = rawPlain.slice(1, -1).trim();
      }
    }
    const plainText =
      target === 'definition' ? cleanCambridgeDefinitionText(rawPlain) : rawPlain;
    if (!plainText) {
      return reply.code(400).send({ error: 'Nội dung gửi lên trống sau khi lọc HTML.' });
    }

    const message: InboxMessage = {
      id: crypto.randomUUID(),
      target,
      text: plainText,
      mode: mode === 'append' ? 'append' : 'replace',
      sourceUrl,
      sourceTitle,
      receivedAt: new Date().toISOString(),
    };

    broadcastInboxMessage(message);

    return {
      ok: true,
      deliveredToClients: getConnectedClientCount(),
      message,
    };
  });

  app.get('/api/inbox/history', async () => ({
    messages: getRecentInboxMessages(),
  }));

  app.get('/api/inbox/stream', async (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    registerSseClient(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 20000);

    res.on('close', () => {
      clearInterval(heartbeat);
    });
  });
}
