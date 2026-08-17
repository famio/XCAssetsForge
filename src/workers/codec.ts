import type { ExportFormat } from '../lib/domain'

export interface Codec {
  readonly name: string
  resize(image: ImageData, width: number, height: number): Promise<ImageData>
  encode(image: ImageData, format: ExportFormat, quality: number): Promise<Uint8Array>
}

/**
 * JPEG has no alpha channel. Compositing over white here — rather than leaving it
 * to the encoder — keeps the result identical across codecs and matches what the
 * exported file will look like.
 */
export function flattenOntoWhite(image: ImageData): ImageData {
  const src = image.data
  const out = new Uint8ClampedArray(src.length)
  for (let i = 0; i < src.length; i += 4) {
    const alpha = src[i + 3] / 255
    const inverse = 1 - alpha
    out[i] = src[i] * alpha + 255 * inverse
    out[i + 1] = src[i + 1] * alpha + 255 * inverse
    out[i + 2] = src[i + 2] * alpha + 255 * inverse
    out[i + 3] = 255
  }
  return new ImageData(out, image.width, image.height)
}
