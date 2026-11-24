import type { ServerResponse } from 'node:http';
import type {
  DictionarySyncEvent,
  DownloadsScanResponse,
  InboxMessage,
  TempImageMedia,
} from '@ass/shared';

const clients = new Set<ServerResponse>();
const recentMessages: InboxMessage[] = [];
const MAX_HISTORY = 25;

export function registerSseClient(res: ServerResponse): void {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

function broadcastEvent(eventName: string, data: unknown): void {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function broadcastInboxMessage(message: InboxMessage): void {
  recentMessages.unshift(message);
  if (recentMessages.length > MAX_HISTORY) {
    recentMessages.length = MAX_HISTORY;
  }
  broadcastEvent('inbox', message);
}

export function broadcastInboxImage(image: TempImageMedia): void {
  broadcastEvent('inbox_image', image);
}

export function broadcastDictionarySync(syncEvent: DictionarySyncEvent): void {
  broadcastEvent('dictionary_sync', syncEvent);
}

export function broadcastDownloadsUpdated(scan: DownloadsScanResponse): void {
  broadcastEvent('downloads_updated', scan);
}

export function broadcastWordDownloadsUpdated(scan: DownloadsScanResponse): void {
  broadcastEvent('word_downloads_updated', scan);
}

export function getRecentInboxMessages(): InboxMessage[] {
  return [...recentMessages];
}

export function getConnectedClientCount(): number {
  return clients.size;
}

export function closeAllSseClients(): void {
  for (const client of clients) {
    try {
      client.end();
    } catch {
      // ignore close errors
    }
  }
  clients.clear();
}
