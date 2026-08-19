import encodeJpeg from '@jsquash/jpeg/encode'
import optimisePng from '@jsquash/oxipng/optimise'
import encodePng from '@jsquash/png/encode'
import resizeImage from '@jsquash/resize'
import type { Codec } from './codec'

/**
 * OxiPNG effort. How much the levels buy depends heavily on the artwork, so a
 * single sample is not enough to choose from — measured against three:
 *
 *                       level 1     level 2            level 3
 *   photo with alpha     61,607     60,618  (-1.6%)    59,921  (-2.7%)
 *   opaque gradient      93,415     50,909 (-45.5%)    50,912  (-45.5%)
 *   flat artwork          3,056      2,906  (-4.9%)     2,787  (-8.8%)
 *
 * The gradient is the case that matters: level 1 leaves nearly half the file on
 * the table, and not because it settles for a worse colour type — both come out
 * RGB/8-bit, so the whole gap is row-filter choice, which level 1 barely
 * explores. Level 2 costs about twice the time and lost to level 1 on none of
 * the three. Level 3 doubles the time again for almost nothing beyond it.
 */
const OXIPNG_LEVEL = 2

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
