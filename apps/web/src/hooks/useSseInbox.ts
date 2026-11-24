import { useEffect, useRef, useState } from 'react';
import type {
  DictionarySyncEvent,
  DownloadsScanResponse,
  InboxMessage,
  TempImageMedia,
} from '@ass/shared';

export interface SseInboxHandlers {
  onInbox: (msg: InboxMessage) => void;
  onInboxImage: (img: TempImageMedia) => void;
  onDictionarySync: (sync: DictionarySyncEvent) => void;
  onDownloadsUpdated: (scan: DownloadsScanResponse) => void;
  onWordDownloadsUpdated: (scan: DownloadsScanResponse) => void;
}

export function useSseInbox(handlers: SseInboxHandlers) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const es = new EventSource('/api/inbox/stream');
    es.addEventListener('connected', () => setConnected(true));
    es.onerror = () => setConnected(false);

    es.addEventListener('inbox', (event) => {
      try {
        const msg = JSON.parse((event as MessageEvent).data) as InboxMessage;
        handlersRef.current.onInbox(msg);
      } catch {
        // ignore malformed event
      }
    });

    es.addEventListener('inbox_image', (event) => {
      try {
        const img = JSON.parse((event as MessageEvent).data) as TempImageMedia;
        handlersRef.current.onInboxImage(img);
      } catch {
        // ignore malformed event
      }
    });

    es.addEventListener('dictionary_sync', (event) => {
      try {
        const sync = JSON.parse((event as MessageEvent).data) as DictionarySyncEvent;
        handlersRef.current.onDictionarySync(sync);
      } catch {
        // ignore malformed event
      }
    });

    es.addEventListener('downloads_updated', (event) => {
      try {
        const scan = JSON.parse((event as MessageEvent).data) as DownloadsScanResponse;
        handlersRef.current.onDownloadsUpdated(scan);
      } catch {
        // ignore malformed event
      }
    });

    es.addEventListener('word_downloads_updated', (event) => {
      try {
        const scan = JSON.parse((event as MessageEvent).data) as DownloadsScanResponse;
        handlersRef.current.onWordDownloadsUpdated(scan);
      } catch {
        // ignore malformed event
      }
    });

    return () => es.close();
  }, []);

  return connected;
}
