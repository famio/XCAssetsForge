/// <reference lib="webworker" />
import type { ExportFormat, Scale } from '../lib/domain'
import { isScaleAvailable, outputFileName } from '../lib/domain'
import { flattenOntoWhite, type Codec } from './codec'
import { LruCache } from './lruCache'
import { wasmCodec } from './wasmCodec'
import type {
  CodecRequest,
  CodecResponse,
  ExportedFile,
  PreviewRequest,
  TotalRequest,
} from './protocol'
import { t } from '../lib/i18n'

const codec: Codec = wasmCodec

/** Full-resolution pixels, because every render re-samples from them. */
const pixels = new Map<string, ImageData>()

/**
 * Lanczos resampling and OxiPNG are the expensive steps, and neither depends on
 * JPEG quality. Caching them is what makes dragging the quality slider cost one
 * JPEG encode instead of a full re-run.
 */
const resized = new LruCache<ImageData>(8)
const encoded = new LruCache<Uint8Array>(16)

const MIME: Record<ExportFormat, string> = { png: 'image/png', jpeg: 'image/jpeg' }

function post(message: CodecResponse, transfer: Transferable[] = []) {
  ;(self as DedicatedWorkerGlobalScope).postMessage(message, transfer)
}

function imageDataOf(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

async function resizedPixels(id: string, width: number, height: number): Promise<ImageData> {
  const key = `${id}|${width}x${height}`
  const hit = resized.get(key)
  if (hit) return hit

  const source = pixels.get(id)
  if (!source) throw new Error(t.imageNotFound)
  const value =
    source.width === width && source.height === height
      ? source
      : await codec.resize(source, width, height)
  resized.set(key, value)
  return value
}

async function encodedBytes(
  id: string,
  width: number,
  height: number,
  format: ExportFormat,
  quality: number,
): Promise<Uint8Array> {
  // PNG output does not depend on quality, so it is keyed without it and survives
  // every slider move.
  const key =
    format === 'png' ? `${id}|${width}x${height}|png` : `${id}|${width}x${height}|jpeg@${quality}`
  const hit = encoded.get(key)
  if (hit) return hit

  const pixelsAt = await resizedPixels(id, width, height)
  const prepared = format === 'jpeg' ? flattenOntoWhite(pixelsAt) : pixelsAt
  const value = await codec.encode(prepared, format, quality)
  encoded.set(key, value)
  return value
}

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

/** Decoding the encoded bytes back is what makes the stage show real artifacts. */
async function decodePreview(bytes: Uint8Array, format: ExportFormat): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([toBuffer(bytes)], { type: MIME[format] }))
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function forget(id: string) {
  for (const key of [...resized.keys(), ...encoded.keys()]) {
    if (key.startsWith(`${id}|`)) {
      resized.delete(key)
      encoded.delete(key)
    }
  }
}

// MARK: - Handlers

async function handleLoad(id: string, file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    pixels.set(id, imageDataOf(bitmap))

    const factor = Math.min(1, 128 / Math.max(bitmap.width, bitmap.height))
    const thumb = await createImageBitmap(bitmap, {
      resizeWidth: Math.max(1, Math.round(bitmap.width * factor)),
      resizeHeight: Math.max(1, Math.round(bitmap.height * factor)),
      resizeQuality: 'high',
    })
    const { width, height } = bitmap
    // Nothing reads the bitmap after this — the pixels and the thumbnail are the
    // only things kept. Holding it would double the memory cost of every image.
    bitmap.close()

    post({ kind: 'loaded', id, width, height, thumb }, [thumb])
  } catch (error) {
    post({ kind: 'load-failed', id, message: describe(error) })
  }
}

async function handlePreview(token: number, request: PreviewRequest) {
  const { id, width, height, quality } = request
  try {
    if (width <= 0 || height <= 0 || !pixels.has(id)) {
      post({ kind: 'preview', token, png: null, jpeg: null })
      return
    }

    const pngData = await encodedBytes(id, width, height, 'png', 100)
    const jpegData = await encodedBytes(id, width, height, 'jpeg', quality)
    const [png, jpeg] = await Promise.all([
      decodePreview(pngData, 'png'),
      decodePreview(jpegData, 'jpeg'),
    ])

    post({ kind: 'preview', token, png, jpeg }, [png, jpeg])
  } catch (error) {
    post({ kind: 'failed', token, message: describe(error) })
  }
}

/**
 * Fills the size table. Every combination is a separate post so the UI can show
 * each figure the moment it lands — encoding all six up front would mean several
 * seconds of blank cells. Cheapest first, so the common cases appear quickly.
 */
async function handleSizes(token: number, request: PreviewRequest) {
  const { id, width, height, quality } = request
  try {
    if (width <= 0 || height <= 0 || !pixels.has(id)) {
      post({ kind: 'sizes-done', token })
      return
    }

    const jobs: Array<{ format: ExportFormat; scale: Scale }> = []
    for (const scale of [1, 2, 3] as Scale[]) {
      // Past the cap the scale can never be exported, and its encode is the most
      // expensive one there is — a 3x of a 3000px short side is 81 megapixels.
      if (!isScaleAvailable(width, height, scale)) continue
      jobs.push({ format: 'jpeg', scale })
      jobs.push({ format: 'png', scale })
    }
    jobs.sort((a, b) => a.scale - b.scale)

    for (const { format, scale } of jobs) {
      const data = await encodedBytes(
        id,
        width * scale,
        height * scale,
        format,
        format === 'png' ? 100 : quality,
      )
      post({ kind: 'size', token, format, scale, bytes: data.byteLength })
    }
    post({ kind: 'sizes-done', token })
  } catch (error) {
    post({ kind: 'failed', token, message: describe(error) })
  }
}

async function handleExport(token: number, baseName: string, request: TotalRequest) {
  const { id, width, height, quality, format, scales } = request
  try {
    const files: ExportedFile[] = []
    const transfer: Transferable[] = []
    for (const scale of [...scales].sort((a, b) => a - b) as Scale[]) {
      const bytes = await encodedBytes(id, width * scale, height * scale, format, quality)
      const buffer = toBuffer(bytes)
      files.push({ name: outputFileName(baseName, scale, format), data: buffer, type: MIME[format] })
      transfer.push(buffer)
    }
    post({ kind: 'exported', token, files }, transfer)
  } catch (error) {
    post({ kind: 'failed', token, message: describe(error) })
  }
}

self.onmessage = (event: MessageEvent<CodecRequest>) => {
  const request = event.data
  switch (request.kind) {
    case 'load':
      void handleLoad(request.id, request.file)
      break
    case 'preview':
      void handlePreview(request.token, request)
      break
    case 'sizes':
      void handleSizes(request.token, request)
      break
    case 'export':
      void handleExport(request.token, request.baseName, request)
      break
    case 'release':
      pixels.delete(request.id)
      forget(request.id)
      break
  }
}

post({ kind: 'ready', codec: codec.name })
