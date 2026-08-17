import encodeJpeg from '@jsquash/jpeg/encode'
import optimisePng from '@jsquash/oxipng/optimise'
import encodePng from '@jsquash/png/encode'
import resizeImage from '@jsquash/resize'
import type { Codec } from './codec'

/**
 * OxiPNG effort, chosen by measurement on a 1080×1080 asset:
 *
 *   level 0   302ms   1,159,876 B
 *   level 1  1290ms   1,027,818 B   ← nearly all of the win
 *   level 2  2631ms   1,022,882 B   (+1.3s for 0.5%)
 *   level 3  7088ms   1,024,321 B   (slower *and* larger)
 *
 * Level 1 captures the compression that matters; everything above it trades
 * seconds for fractions of a percent.
 */
const OXIPNG_LEVEL = 1

/**
 * Phase 2 codec: MozJPEG and the Squoosh PNG encoder compiled to wasm, plus a
 * Lanczos3 resampler. The point is determinism — the byte counts shown next to
 * the comparison are the bytes every visitor gets, regardless of browser, and
 * they match what the export writes.
 */
export const wasmCodec: Codec = {
  name: 'wasm',

  async resize(image, width, height) {
    return resizeImage(image, {
      width,
      height,
      method: 'lanczos3',
      // Resampling straight RGBA darkens the edges of transparent artwork.
      premultiply: true,
      linearRGB: true,
    })
  },

  async encode(image, format, quality) {
    if (format === 'jpeg') {
      return new Uint8Array(await encodeJpeg(image, { quality }))
    }
    // The bare encoder writes a valid but unoptimised PNG; without this pass the
    // reported size would overstate what a real asset pipeline produces.
    const encoded = await encodePng(image)
    return new Uint8Array(await optimisePng(encoded, { level: OXIPNG_LEVEL }))
  },
}
