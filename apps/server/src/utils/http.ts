import type { FastifyReply, FastifyRequest } from 'fastify';

export function sendAudioBuffer(
  req: FastifyRequest,
  reply: FastifyReply,
  buffer: Buffer,
  contentType: string,
) {
  const total = buffer.length;
  const rangeHeader = req.headers.range;

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const [rawStart, rawEnd] = rangeHeader.replace(/^bytes=/, '').split('-');
    const start = rawStart ? Number.parseInt(rawStart, 10) : 0;
    const end = rawEnd ? Math.min(Number.parseInt(rawEnd, 10), total - 1) : total - 1;

    if (!Number.isNaN(start) && !Number.isNaN(end) && start >= 0 && start <= end && end < total) {
      const chunk = buffer.subarray(start, end + 1);
      return reply
        .code(206)
        .header('Content-Type', contentType)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Range', `bytes ${start}-${end}/${total}`)
        .header('Content-Length', chunk.length)
        .header('Cache-Control', 'no-store')
        .send(chunk);
    }
  }

  return reply
    .code(200)
    .header('Content-Type', contentType)
    .header('Accept-Ranges', 'bytes')
    .header('Content-Length', total)
    .header('Cache-Control', 'no-store')
    .send(buffer);
}

export function replaceFilenameExtension(filename: string | undefined, nextExt: string): string {
  const cleanExt = nextExt.replace(/^\./, '');
  if (!filename?.trim()) return `image_${Date.now()}.${cleanExt}`;
  const base = filename.trim().replace(/\.[^.]+$/, '');
  return `${base || `image_${Date.now()}`}.${cleanExt}`;
}

export async function resolveIncomingImageBuffer(payload: {
  dataUrl?: string;
  imageUrl?: string;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const dataUrl = payload.dataUrl?.trim();
  if (dataUrl) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!match) {
      throw new Error('Định dạng dữ liệu ảnh (dataUrl) không hợp lệ.');
    }
    const mimeType = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
      throw new Error('Dữ liệu ảnh trống.');
    }
    return { buffer, mimeType };
  }

  const imageUrl = payload.imageUrl?.trim();
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    const resp = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      throw new Error(`Không tải được ảnh từ URL (mã ${resp.status}).`);
    }
    const ct = resp.headers.get('content-type') || 'image/png';
    const mimeType = ct.split(';')[0].trim().toLowerCase();
    if (!mimeType.startsWith('image/')) {
      throw new Error('URL không trả về dữ liệu hình ảnh hợp lệ.');
    }
    const arrayBuf = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length === 0) {
      throw new Error('Ảnh tải về bị trống.');
    }
    return { buffer, mimeType };
  }

  throw new Error('Thiếu dữ liệu hình ảnh (dataUrl hoặc imageUrl).');
}
