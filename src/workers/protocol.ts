import type { ExportFormat, Scale } from '../lib/domain'

export interface PreviewRequest {
  id: string
  width: number
  height: number
  quality: number
}

export interface TotalRequest extends PreviewRequest {
  format: ExportFormat
  scales: Scale[]
}

export type CodecRequest =
  | { kind: 'load'; id: string; file: File }
  | ({ kind: 'preview'; token: number } & PreviewRequest)
  | ({ kind: 'sizes'; token: number } & PreviewRequest)
  | ({ kind: 'export'; token: number; baseName: string } & TotalRequest)
  | { kind: 'release'; id: string }

export interface ExportedFile {
  name: string
  data: ArrayBuffer
  type: string
}

export type CodecResponse =
  | { kind: 'ready'; codec: string }
  | { kind: 'loaded'; id: string; width: number; height: number; thumb: ImageBitmap }
  | { kind: 'load-failed'; id: string; message: string }
  | { kind: 'preview'; token: number; png: ImageBitmap | null; jpeg: ImageBitmap | null }
  /** One cell of the size table, posted as soon as it is known. */
  | { kind: 'size'; token: number; format: ExportFormat; scale: Scale; bytes: number }
  | { kind: 'sizes-done'; token: number }
  | { kind: 'exported'; token: number; files: ExportedFile[] }
  | { kind: 'failed'; token: number; message: string }
