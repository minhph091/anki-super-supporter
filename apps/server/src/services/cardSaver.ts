import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  slugifyFilename,
  type AppSettings,
  type SaveCardPayload,
} from '@ass/shared';
import {
  clearAllAudioTakes,
  clearAllTempImages,
  clearCambridgeTempAudios,
  getAudioTake,
  getTempImage,
  TMP_CAMBRIDGE_AUDIO_DIR,
} from '../store.js';
import { resolveDownloadAudioPath } from './downloadsScanner.js';
import { addNoteToAnki, storeMediaFile, updateNoteInAnki } from './ankiconnect.js';
import { broadcastCambridgeTempAudioList } from './dictionary/syncBuffer.js';
import { buildAnkiTextFields } from './cardFieldBuilder.js';

export { buildAnkiTextFields } from './cardFieldBuilder.js';

export class CardSaveError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CardSaveError';
    this.statusCode = statusCode;
  }
}

export interface SaveCardResult {
  ok: true;
  mode: 'create' | 'update';
  noteId: number;
  uploadedWordFile?: string;
  uploadedExampleFile?: string;
  uploadedImageFile?: string;
}

export async function saveCardToAnki(
  payload: SaveCardPayload,
  settings: AppSettings,
): Promise<SaveCardResult> {
  const { lang, cleanWord, fieldsToWrite } = buildAnkiTextFields(payload, settings);
  const profile = settings.languageProfiles[lang] ?? settings;
  const mapping = profile.fieldMapping;
  const vis = profile.visibleFields;
  const isCreate = payload.mode === 'create';

  let uploadedWordFile: string | undefined;
  let uploadedExampleFile: string | undefined;
  let uploadedImageFile: string | undefined;
  const sourcePathsToCleanup: string[] = [];

  if (payload.imageTempId && mapping.image?.trim()) {
    const imgRec = getTempImage(payload.imageTempId);
    if (!imgRec) {
      throw new CardSaveError('Ảnh đã chọn không còn tồn tại, vui lòng gửi hoặc chọn lại.', 400);
    }
    const buffer = fs.readFileSync(imgRec.filePath);
    const ext = path.extname(imgRec.filePath).toLowerCase() || '.png';
    const slug = slugifyFilename(cleanWord, 'image', 24);
    const shortId = crypto.randomBytes(4).toString('hex');
    const ankiFilename = `ass_img_${slug}_${shortId}${ext}`;

    uploadedImageFile = await storeMediaFile(settings.ankiConnectUrl, ankiFilename, buffer);
    fieldsToWrite[mapping.image.trim()] = `<img src="${uploadedImageFile}">`;
  } else if (isCreate && vis.image && mapping.image?.trim() && !payload.keepExistingImage) {
    fieldsToWrite[mapping.image.trim()] = '';
  }

  if (payload.wordAudioTakeId && mapping.wordAudio?.trim()) {
    const take = getAudioTake(payload.wordAudioTakeId);
    if (!take) {
      throw new CardSaveError('Bản thu âm từ vựng đã hết hạn, vui lòng tạo lại.', 400);
    }
    const buffer = fs.readFileSync(take.filePath);
    uploadedWordFile = await storeMediaFile(settings.ankiConnectUrl, take.meta.filename, buffer);
    fieldsToWrite[mapping.wordAudio.trim()] = `[sound:${uploadedWordFile}]`;
  } else if (payload.wordDownloadFileId && mapping.wordAudio?.trim()) {
    const fromTempCam = resolveDownloadAudioPath(
      TMP_CAMBRIDGE_AUDIO_DIR,
      payload.wordDownloadFileId,
    );
    const resolved =
      fromTempCam ??
      resolveDownloadAudioPath(
        settings.wordAudioDownloads.downloadsDir,
        payload.wordDownloadFileId,
      );
    if (!resolved) {
      throw new CardSaveError(
        'File âm thanh từ vựng đã chọn không còn trong thư mục, hãy quét lại.',
        400,
      );
    }
    const buffer = fs.readFileSync(resolved.filePath);
    const ext = path.extname(resolved.filename).toLowerCase() || '.mp3';
    const slug = slugifyFilename(cleanWord, 'word', 24);
    const shortId = crypto.randomBytes(4).toString('hex');
    const ankiFilename = `ass_word_${slug}_${shortId}${ext}`;

    uploadedWordFile = await storeMediaFile(settings.ankiConnectUrl, ankiFilename, buffer);
    fieldsToWrite[mapping.wordAudio.trim()] = `[sound:${uploadedWordFile}]`;
    if (!fromTempCam && settings.wordAudioDownloads.deleteSourceAfterSave) {
      sourcePathsToCleanup.push(resolved.filePath);
    }
  } else if (
    isCreate &&
    vis.wordAudio &&
    mapping.wordAudio?.trim() &&
    !payload.keepExistingWordAudio
  ) {
    fieldsToWrite[mapping.wordAudio.trim()] = '';
  }

  if (payload.exampleDownloadFileId && mapping.exampleAudio?.trim()) {
    const resolved = resolveDownloadAudioPath(
      settings.elevenlabsDownloads.downloadsDir,
      payload.exampleDownloadFileId,
    );
    if (!resolved) {
      throw new CardSaveError(
        'File âm thanh đã chọn không còn trong thư mục Downloads, hãy quét lại.',
        400,
      );
    }
    const buffer = fs.readFileSync(resolved.filePath);
    const ext = path.extname(resolved.filename).toLowerCase() || '.mp3';
    const slug = slugifyFilename(cleanWord, 'example', 24);
    const shortId = crypto.randomBytes(4).toString('hex');
    const ankiFilename = `ass_ex_${slug}_${shortId}${ext}`;

    uploadedExampleFile = await storeMediaFile(settings.ankiConnectUrl, ankiFilename, buffer);
    fieldsToWrite[mapping.exampleAudio.trim()] = `[sound:${uploadedExampleFile}]`;
    if (settings.elevenlabsDownloads.deleteSourceAfterSave) {
      sourcePathsToCleanup.push(resolved.filePath);
    }
  } else if (
    isCreate &&
    vis.exampleAudio &&
    mapping.exampleAudio?.trim() &&
    !payload.keepExistingExampleAudio
  ) {
    fieldsToWrite[mapping.exampleAudio.trim()] = '';
  }

  const cleanupSourceFiles = () => {
    for (const filePath of sourcePathsToCleanup) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup failure
        }
      }
    }
    // Automatically delete temporary images and audio takes once the card has been saved to Anki
    clearAllTempImages();
    clearAllAudioTakes();
    if (clearCambridgeTempAudios() > 0) {
      broadcastCambridgeTempAudioList();
    }
  };

  if (isCreate) {
    const deckName = payload.deckName?.trim() || profile.defaultDeck;
    const modelName = payload.modelName?.trim() || profile.defaultNoteType;
    if (!deckName || !modelName) {
      throw new CardSaveError('Vui lòng chọn Deck và Note Type mặc định trong Cài đặt.', 400);
    }
    const noteId = await addNoteToAnki(
      settings.ankiConnectUrl,
      deckName,
      modelName,
      fieldsToWrite,
      payload.tags,
    );
    cleanupSourceFiles();
    return {
      ok: true,
      mode: 'create',
      noteId,
      uploadedWordFile,
      uploadedExampleFile,
      uploadedImageFile,
    };
  }

  if (!payload.noteId) {
    throw new CardSaveError('Thiếu noteId để cập nhật thẻ.', 400);
  }

  await updateNoteInAnki(settings.ankiConnectUrl, payload.noteId, fieldsToWrite);
  cleanupSourceFiles();
  return {
    ok: true,
    mode: 'update',
    noteId: payload.noteId,
    uploadedWordFile,
    uploadedExampleFile,
    uploadedImageFile,
  };
}
