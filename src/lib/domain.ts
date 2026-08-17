export type ExportFormat = 'png' | 'jpeg'
export type Scale = 1 | 2 | 3

export const SCALES: readonly Scale[] = [1, 2, 3]

/**
 * Hard ceiling on the short side of anything we emit. Every scale is checked
 * against it, so a 1x short side of 1600 rules out 2x and 3x rather than asking
 * the browser to allocate a canvas it cannot back.
 */
export const MAX_SHORT_SIDE = 3000

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
}

export const FORMAT_EXTENSION: Record<ExportFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
}

export const MIN_QUALITY = 10
export const MAX_QUALITY = 100
export const DEFAULT_QUALITY = 90
export const DEFAULT_BASE_WIDTH = 360

/** Image types we accept. Decoding is delegated to the browser. */
export const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const

export function isAcceptedFile(file: { type: string; name: string }): boolean {
  if ((ACCEPTED_MIME as readonly string[]).includes(file.type)) return true
  // Some sources hand over files with an empty type; fall back to the extension.
  return /\.(png|jpe?g|webp|avif)$/i.test(file.name)
}

// MARK: - Size rules

/** Shrinks proportionally until the short side fits, leaving the long side free. */
export function clampShortSide(width: number, height: number): [number, number] {
  const short = Math.min(width, height)
  if (short <= MAX_SHORT_SIDE) return [width, height]
  const factor = MAX_SHORT_SIDE / short
  return [Math.max(1, Math.round(width * factor)), Math.max(1, Math.round(height * factor))]
}

/**
 * With the aspect unlocked only the edited side moves, so it is capped only when
 * it would become the short side — otherwise it is the long side and stays free.
 */
export function clampFreeSide(value: number, other: number): number {
  return Math.min(value, other) > MAX_SHORT_SIDE ? MAX_SHORT_SIDE : value
}

/** A scale is emittable only while its own short side stays within the cap. */
export function isScaleAvailable(width: number, height: number, scale: Scale): boolean {
  const short = Math.min(width, height)
  return short > 0 && short * scale <= MAX_SHORT_SIDE
}

/** The largest 1x short side that still allows the given scale. */
export function shortSideLimitFor(scale: Scale): number {
  return Math.floor(MAX_SHORT_SIDE / scale)
}

// MARK: - Naming

/**
 * Reduces the filename field to a single, harmless path component so it can't
 * escape the chosen folder or produce a hidden file.
 */
export function sanitizeBaseName(name: string): string {
  const joined = name
    .split(/[/\\:\0]/)
    .filter((part) => part !== '' && part !== '.' && part !== '..')
    .join('-')
    .trim()
  const cleaned = joined.replace(/^\.+/, '')
  return cleaned === '' ? 'asset' : cleaned
}

/** Xcode asset naming, with every scale carrying its own suffix. */
export function outputFileName(baseName: string, scale: Scale, format: ExportFormat): string {
  return `${sanitizeBaseName(baseName)}@${scale}x.${FORMAT_EXTENSION[format]}`
}

export function baseNameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}

// MARK: - Formatting

/** MB with two decimals above 1 MiB, whole KB below. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

// MARK: - Stage geometry

export interface FittedRect {
  x: number
  y: number
  width: number
  height: number
  magnified: boolean
}

/**
 * Aspect-fit: the asset always fills the stage on its constrained axis, scaling
 * up when it is smaller than the stage and down when it is larger.
 */
export function fitRect(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
  inset = 32,
): FittedRect {
  if (imageWidth <= 0 || imageHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, magnified: false }
  }
  const availableWidth = Math.max(1, boxWidth - inset * 2)
  const availableHeight = Math.max(1, boxHeight - inset * 2)
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: Math.round((boxWidth - width) / 2),
    y: Math.round((boxHeight - height) / 2),
    width,
    height,
    magnified: scale > 1,
  }
}

export function clampSplit(value: number): number {
  return Math.min(0.98, Math.max(0.02, value))
}

export function clampQuality(value: number): number {
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.round(value)))
}
