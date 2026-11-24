import type { AnkiNoteItem } from '@ass/shared';

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export async function invokeAnki<T>(
  ankiConnectUrl: string,
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ankiConnectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        version: 6,
        ...(params ? { params } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(
      `Không kết nối được tới AnkiConnect (${ankiConnectUrl}). Hãy chắc chắn Anki Desktop đang mở và đã cài add-on AnkiConnect (mã 2055492159).`,
    );
  }

  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP lỗi ${response.status}`);
  }

  const payload = (await response.json()) as AnkiConnectResponse<T>;
  if (payload.error) {
    throw new Error(`AnkiConnect: ${payload.error}`);
  }
  return payload.result;
}

export async function getAnkiStatus(ankiConnectUrl: string): Promise<{
  connected: boolean;
  version?: number;
  error?: string;
}> {
  try {
    const version = await invokeAnki<number>(ankiConnectUrl, 'version');
    return { connected: true, version };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getDeckNames(ankiConnectUrl: string): Promise<string[]> {
  return invokeAnki<string[]>(ankiConnectUrl, 'deckNames');
}

export async function getModelNames(ankiConnectUrl: string): Promise<string[]> {
  return invokeAnki<string[]>(ankiConnectUrl, 'modelNames');
}

export async function getModelFieldNames(
  ankiConnectUrl: string,
  modelName: string,
): Promise<string[]> {
  return invokeAnki<string[]>(ankiConnectUrl, 'modelFieldNames', { modelName });
}

export async function findAndLoadNotes(
  ankiConnectUrl: string,
  query: string,
  limit = 100,
): Promise<AnkiNoteItem[]> {
  const ids = await invokeAnki<number[]>(ankiConnectUrl, 'findNotes', { query });
  if (!ids || ids.length === 0) return [];
  const sliced = ids.slice(0, limit);
  return invokeAnki<AnkiNoteItem[]>(ankiConnectUrl, 'notesInfo', { notes: sliced });
}

export async function storeMediaFile(
  ankiConnectUrl: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  return invokeAnki<string>(ankiConnectUrl, 'storeMediaFile', {
    filename,
    data: buffer.toString('base64'),
  });
}

export async function addNoteToAnki(
  ankiConnectUrl: string,
  deckName: string,
  modelName: string,
  fields: Record<string, string>,
  tags: string[] = ['AnkiSuperSupporter'],
): Promise<number> {
  return invokeAnki<number>(ankiConnectUrl, 'addNote', {
    note: {
      deckName,
      modelName,
      fields,
      options: {
        allowDuplicate: true,
      },
      tags,
    },
  });
}

export async function updateNoteInAnki(
  ankiConnectUrl: string,
  noteId: number,
  fields: Record<string, string>,
): Promise<null> {
  return invokeAnki<null>(ankiConnectUrl, 'updateNoteFields', {
    note: {
      id: noteId,
      fields,
    },
  });
}
