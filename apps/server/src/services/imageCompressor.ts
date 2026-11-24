import sharp, { type Sharp } from 'sharp';

export type ImageEncodingMode =
  | 'lossless'
  | 'near-lossless'
  | 'lossy'
  | 'animated-webp'
  | 'original';

export interface CompressedImageResult {
  compressedBytes: Buffer;
  extension: string;
  mimeType: string;
  isGraphic: boolean;
  uniqueColors: number;
  topColorCoverage: number;
  encodingMode: ImageEncodingMode;
  strippedAlpha: boolean;
  resized: boolean;
  keptOriginal: boolean;
  originalSizeBytes: number;
  finalSizeBytes: number;
}

export interface CompressImageOptions {
  /** Maximum width/height for graphic/text images (default: 1400px). */
  maxWidth?: number;
  /** Maximum width/height for photographic/AI images (default: 1200px, or maxWidth if explicitly provided). */
  maxPhotoEdge?: number;
  fallbackExtension?: string;
}

const DEFAULT_MAX_GRAPHIC_EDGE = 1400;
const DEFAULT_MAX_PHOTO_EDGE = 1200;
const CLASSIFY_SAMPLE_SIZE = 200;
const QUANTIZED_GRAPHIC_COLOR_THRESHOLD = 1200;
const TOP_COLOR_BUCKETS = 32;
const TOP_COLOR_COVERAGE_THRESHOLD = 0.72;
const GRAPHIC_NEAR_LOSSLESS_TRIGGER_BYTES = 200 * 1024; // 200 KB

export function detectImageExtension(buffer: Buffer, fallback = 'png'): string {
  if (buffer.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpg';
    }
    // WebP: RIFF....WEBP
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'webp';
    }
    // GIF: GIF87a / GIF89a
    if (buffer.toString('ascii', 0, 3) === 'GIF') {
      return 'gif';
    }
    // BMP: BM
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return 'bmp';
    }
  }
  const clean = fallback.replace(/^\./, '').toLowerCase();
  return clean === 'jpeg' ? 'jpg' : clean || 'png';
}

export function mimeTypeFromExtension(ext: string): string {
  const clean = ext.replace(/^\./, '').toLowerCase();
  if (clean === 'webp') return 'image/webp';
  if (clean === 'jpg' || clean === 'jpeg') return 'image/jpeg';
  if (clean === 'gif') return 'image/gif';
  if (clean === 'bmp') return 'image/bmp';
  return 'image/png';
}

/**
 * Pure-Buffer decoder for standard uncompressed 24-bit and 32-bit Windows BMP files
 * so BMP inputs work even when libvips is built without libMagick/BMP support.
 */
function decodeUncompressedBmp(buffer: Buffer): {
  data: Buffer;
  width: number;
  height: number;
  channels: 3 | 4;
} | null {
  if (buffer.length < 54 || buffer[0] !== 0x42 || buffer[1] !== 0x4d) return null;

  const pixelOffset = buffer.readUInt32LE(10);
  const dibHeaderSize = buffer.readUInt32LE(14);
  if (dibHeaderSize < 40 || pixelOffset >= buffer.length) return null;

  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const planes = buffer.readUInt16LE(26);
  const bpp = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);

  if (width <= 0 || rawHeight === 0 || planes !== 1) return null;
  if (compression !== 0 && compression !== 3) return null;
  if (bpp !== 24 && bpp !== 32) return null;

  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const bytesPerPixel = bpp / 8;
  const rowStride = Math.floor((width * bpp + 31) / 32) * 4;
  if (pixelOffset + rowStride * height > buffer.length) return null;

  const channels: 3 | 4 = bpp === 32 ? 4 : 3;
  const out = Buffer.allocUnsafe(width * height * channels);

  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    const srcRowOffset = pixelOffset + srcRow * rowStride;
    const dstRowOffset = y * width * channels;

    for (let x = 0; x < width; x++) {
      const si = srcRowOffset + x * bytesPerPixel;
      const di = dstRowOffset + x * channels;
      // BMP stores BGR(A); convert to RGB(A)
      out[di] = buffer[si + 2];
      out[di + 1] = buffer[si + 1];
      out[di + 2] = buffer[si];
      if (channels === 4) {
        out[di + 3] = buffer[si + 3];
      }
    }
  }

  return { data: out, width, height, channels };
}

function createSharpFromBytes(
  rawBytes: Buffer,
  detectedExt: string,
  animated = false,
): Sharp {
  if (detectedExt === 'bmp') {
    const bmp = decodeUncompressedBmp(rawBytes);
    if (bmp) {
      return sharp(bmp.data, {
        raw: {
          width: bmp.width,
          height: bmp.height,
          channels: bmp.channels,
        },
      });
    }
  }
  return sharp(rawBytes, { failOn: 'none', animated });
}

/**
 * Strips the alpha channel from an RGBA raw buffer in a single linear memory pass
 * without re-decoding the source image.
 */
function stripAlphaChannelInMemory(rgbaData: Buffer, pixelCount: number): Buffer {
  const rgb = Buffer.allocUnsafe(pixelCount * 3);
  let src = 0;
  let dst = 0;
  for (let p = 0; p < pixelCount; p++) {
    rgb[dst] = rgbaData[src];
    rgb[dst + 1] = rgbaData[src + 1];
    rgb[dst + 2] = rgbaData[src + 2];
    src += 4;
    dst += 3;
  }
  return rgb;
}

/**
 * Pre-resize classification directly on the decoded full-resolution pixel buffer.
 * Samples a 200x200 grid with exact NEAREST-neighbor coordinates (zero color blending),
 * quantizes each channel to 5 bits (immune to 1-bit JPEG/dithering noise),
 * and computes both unique quantized color count and Top-32 dominant color coverage.
 */
function classifyOriginalPixels(
  pixelData: Buffer,
  width: number,
  height: number,
  channels: 3 | 4,
): { uniqueColors: number; topColorCoverage: number; isGraphic: boolean } {
  const counts = new Map<number, number>();
  const sampleW = CLASSIFY_SAMPLE_SIZE;
  const sampleH = CLASSIFY_SAMPLE_SIZE;
  const totalSamples = sampleW * sampleH;

  for (let sy = 0; sy < sampleH; sy++) {
    const y = Math.min(height - 1, Math.floor((sy * height) / sampleH));
    const rowOffset = y * width * channels;

    for (let sx = 0; sx < sampleW; sx++) {
      const x = Math.min(width - 1, Math.floor((sx * width) / sampleW));
      const idx = rowOffset + x * channels;

      // 5-bit per channel quantization (0..31) prevents 1-bit JPEG noise from inflating color counts
      const r = pixelData[idx] >> 3;
      const g = pixelData[idx + 1] >> 3;
      const b = pixelData[idx + 2] >> 3;
      const key =
        channels === 4
          ? ((r << 15) | (g << 10) | (b << 5) | (pixelData[idx + 3] >> 3)) >>> 0
          : (r << 10) | (g << 5) | b;

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const uniqueColors = counts.size;

  // Sum frequency of Top-K most frequent quantized colors
  const freqs = Array.from(counts.values());
  freqs.sort((a, b) => b - a);
  let topSum = 0;
  const limit = Math.min(TOP_COLOR_BUCKETS, freqs.length);
  for (let i = 0; i < limit; i++) {
    topSum += freqs[i];
  }
  const topColorCoverage = totalSamples > 0 ? topSum / totalSamples : 0;

  const isGraphic =
    uniqueColors <= QUANTIZED_GRAPHIC_COLOR_THRESHOLD ||
    topColorCoverage >= TOP_COLOR_COVERAGE_THRESHOLD;

  return { uniqueColors, topColorCoverage, isGraphic };
}

/**
 * Adaptive WebP Compression Pipeline (v2):
 * 1. Animated Guard: detects multi-frame GIF/WebP and preserves animation via animated WebP (or keeps original if smaller).
 * 2. Single-Pass Decode + EXIF Auto-Rotate + Color Mode Normalization:
 *    - Decodes source bytes ONCE (with EXIF `.rotate()`).
 *    - Checks real alpha transparency (`minAlpha < 255`); drops fully opaque alpha in memory (RGBA -> RGB).
 * 3. Pre-Resize Classification (strictly BEFORE downscale):
 *    - Exact 200x200 NEAREST sampling on original pixels + 5-bit quantization + Top-32 color coverage.
 * 4. 2D Aspect-Ratio Downscale (`LANCZOS`):
 *    - Caps both width AND height (`fit: 'inside'`) to prevent oversized vertical/portrait screenshots.
 *    - Graphic/Text -> max 1400px; Photo/AI -> max 1200px (or custom `maxWidth`).
 * 5. Adaptive WebP Encoding + Dual-Candidate Race + Safety Size Guard:
 *    - Graphic: WebP Lossless (`effort: 6`); if still > 200KB or >= rawBytes, races Near-Lossless (`quality: 80`)
 *      and high-quality Lossy (`quality: 88, smartSubsample`) to pick the smallest sharp result.
 *    - Photo: WebP Lossy (`quality: 82, effort: 5, smartSubsample: true`).
 *    - Safety Guard: returns original `rawBytes` & extension untouched if no WebP candidate is strictly smaller.
 */
export async function compressImageAdaptive(
  rawBytes: Buffer,
  options: CompressImageOptions = {},
): Promise<CompressedImageResult> {
  const maxGraphicEdge = options.maxWidth ?? DEFAULT_MAX_GRAPHIC_EDGE;
  const maxPhotoEdge = options.maxPhotoEdge ?? options.maxWidth ?? DEFAULT_MAX_PHOTO_EDGE;
  const origExt = detectImageExtension(rawBytes, options.fallbackExtension);
  const origMime = mimeTypeFromExtension(origExt);

  const fallbackResult = (
    partial: Partial<CompressedImageResult> = {},
  ): CompressedImageResult => ({
    compressedBytes: rawBytes,
    extension: origExt,
    mimeType: origMime,
    isGraphic: false,
    uniqueColors: 0,
    topColorCoverage: 0,
    encodingMode: 'original',
    strippedAlpha: false,
    resized: false,
    keptOriginal: true,
    originalSizeBytes: rawBytes.length,
    finalSizeBytes: rawBytes.length,
    ...partial,
  });

  try {
    // Lightweight header-only inspection (checks dimensions, alpha, animation frames)
    const meta = await createSharpFromBytes(rawBytes, origExt, true).metadata();
    const pages = meta.pages ?? 1;

    // 1. Preserve animated GIF / animated WebP
    if (pages > 1) {
      try {
        const animWebp = await sharp(rawBytes, { failOn: 'none', animated: true })
          .webp({ quality: 82, effort: 4 })
          .toBuffer();
        if (animWebp.length < rawBytes.length) {
          return {
            compressedBytes: animWebp,
            extension: 'webp',
            mimeType: 'image/webp',
            isGraphic: false,
            uniqueColors: 0,
            topColorCoverage: 0,
            encodingMode: 'animated-webp',
            strippedAlpha: false,
            resized: false,
            keptOriginal: false,
            originalSizeBytes: rawBytes.length,
            finalSizeBytes: animWebp.length,
          };
        }
      } catch {
        // fall through to keep original animation
      }
      return fallbackResult();
    }

    if (!meta.width || !meta.height) {
      return fallbackResult();
    }

    // 2. Single-pass decode + EXIF auto-rotate + Color Mode Normalization
    let normalizedData: Buffer;
    let width: number;
    let height: number;
    let channels: 3 | 4;
    let strippedAlpha = false;

    if (meta.hasAlpha) {
      const decoded = await createSharpFromBytes(rawBytes, origExt)
        .rotate()
        .ensureAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true });

      width = decoded.info.width;
      height = decoded.info.height;

      let hasRealTransparency = false;
      for (let i = 3; i < decoded.data.length; i += 4) {
        if (decoded.data[i] < 255) {
          hasRealTransparency = true;
          break;
        }
      }

      if (hasRealTransparency) {
        normalizedData = decoded.data;
        channels = 4;
      } else {
        normalizedData = stripAlphaChannelInMemory(decoded.data, width * height);
        channels = 3;
        strippedAlpha = true;
      }
    } else {
      const decoded = await createSharpFromBytes(rawBytes, origExt)
        .rotate()
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true });

      width = decoded.info.width;
      height = decoded.info.height;
      normalizedData = decoded.data;
      channels = 3;
    }

    if (width <= 0 || height <= 0) {
      return fallbackResult();
    }

    // 3. Pre-Resize Classification (strictly on full-res normalized pixels, 200x200 NEAREST)
    const { uniqueColors, topColorCoverage, isGraphic } = classifyOriginalPixels(
      normalizedData,
      width,
      height,
      channels,
    );

    // 4. 2D Aspect-Ratio Downscale (LANCZOS, caps both width & height)
    const maxEdge = isGraphic ? maxGraphicEdge : maxPhotoEdge;
    const resized = width > maxEdge || height > maxEdge;

    const buildFinalSharp = () => {
      let p = sharp(normalizedData, {
        raw: { width, height, channels },
      });
      if (resized) {
        p = p.resize(maxEdge, maxEdge, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        });
      }
      return p;
    };

    // 5. Adaptive WebP Encoding
    let bestBytes: Buffer;
    let bestMode: ImageEncodingMode;

    if (isGraphic) {
      const losslessBytes = await buildFinalSharp()
        .webp({ lossless: true, effort: 6 })
        .toBuffer();

      bestBytes = losslessBytes;
      bestMode = 'lossless';

      // If lossless output is still heavy (>200KB) or larger than rawBytes, try Near-Lossless
      if (
        losslessBytes.length > GRAPHIC_NEAR_LOSSLESS_TRIGGER_BYTES ||
        losslessBytes.length >= rawBytes.length
      ) {
        const nearLosslessBytes = await buildFinalSharp()
          .webp({ nearLossless: true, quality: 80, effort: 5 })
          .toBuffer();

        if (nearLosslessBytes.length < bestBytes.length) {
          bestBytes = nearLosslessBytes;
          bestMode = 'near-lossless';
        }

        // For flat cartoon/JPG illustrations that still exceed rawBytes, try high-quality smartSubsample lossy
        if (bestBytes.length >= rawBytes.length) {
          const highQLossyBytes = await buildFinalSharp()
            .webp({ quality: 88, effort: 5, smartSubsample: true })
            .toBuffer();

          if (highQLossyBytes.length < bestBytes.length) {
            bestBytes = highQLossyBytes;
            bestMode = 'lossy';
          }
        }
      }
    } else {
      bestBytes = await buildFinalSharp()
        .webp({ quality: 82, effort: 5, smartSubsample: true })
        .toBuffer();
      bestMode = 'lossy';
    }

    // Safety Size Guard: never return a file larger than or equal to the original input
    if (bestBytes.length >= rawBytes.length) {
      return fallbackResult({
        isGraphic,
        uniqueColors,
        topColorCoverage,
        strippedAlpha,
        resized,
      });
    }

    return {
      compressedBytes: bestBytes,
      extension: 'webp',
      mimeType: 'image/webp',
      isGraphic,
      uniqueColors,
      topColorCoverage,
      encodingMode: bestMode,
      strippedAlpha,
      resized,
      keptOriginal: false,
      originalSizeBytes: rawBytes.length,
      finalSizeBytes: bestBytes.length,
    };
  } catch {
    return fallbackResult();
  }
}
