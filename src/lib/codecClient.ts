import type { ExportFormat, Scale } from './domain'
import type {
  CodecRequest,
  CodecResponse,
  ExportedFile,
  PreviewRequest,
  TotalRequest,
} from '../workers/protocol'

export interface SizeCell {
  format: ExportFormat
  scale: Scale
  bytes: number
}

export interface LoadedImage {
  width: number
  height: number
  thumb: ImageBitmap
}

export interface PreviewResult {
  png: ImageBitmap | null
  jpeg: ImageBitmap | null
}

type Pending =
  | { kind: 'load'; resolve: (value: LoadedImage) => void; reject: (error: Error) => void }
  | { kind: 'preview'; resolve: (value: PreviewResult) => void; reject: (error: Error) => void }
  | {
      kind: 'sizes'
      onCell: (cell: SizeCell) => void
      resolve: () => void
      reject: (error: Error) => void
    }
  | { kind: 'export'; resolve: (value: ExportedFile[]) => void; reject: (error: Error) => void }

/**
 * Thin promise wrapper over the codec worker. All decoding, resizing and
 * encoding happens off the main thread, and the preview and the running total
 * are separate round trips so the stage never waits on the 2x/3x encodes.
 */
export class CodecClient {
  private readonly worker: Worker
  private readonly byToken = new Map<number, Pending>()
  private readonly byId = new Map<string, Pending>()
  private nextToken = 1

  codecName = 'unknown'

  constructor() {
    this.worker = new Worker(new URL('../workers/codec.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (event: MessageEvent<CodecResponse>) => this.receive(event.data)
  }

  load(id: string, file: File): Promise<LoadedImage> {
    return new Promise((resolve, reject) => {
      this.byId.set(id, { kind: 'load', resolve, reject })
      this.send({ kind: 'load', id, file })
    })
  }

  preview(request: PreviewRequest): Promise<PreviewResult> {
    const token = this.nextToken++
    return new Promise((resolve, reject) => {
      this.byToken.set(token, { kind: 'preview', resolve, reject })
      this.send({ kind: 'preview', token, ...request })
    })
  }

  /** Streams the size table; `onCell` fires per combination as it finishes. */
  sizes(request: PreviewRequest, onCell: (cell: SizeCell) => void): Promise<void> {
    const token = this.nextToken++
    return new Promise((resolve, reject) => {
      this.byToken.set(token, { kind: 'sizes', onCell, resolve, reject })
      this.send({ kind: 'sizes', token, ...request })
    })
  }

  export(baseName: string, request: TotalRequest): Promise<ExportedFile[]> {
    const token = this.nextToken++
    return new Promise((resolve, reject) => {
      this.byToken.set(token, { kind: 'export', resolve, reject })
      this.send({ kind: 'export', token, baseName, ...request })
    })
  }

  release(id: string) {
    this.send({ kind: 'release', id })
  }

  private send(request: CodecRequest) {
    this.worker.postMessage(request)
  }

  private receive(response: CodecResponse) {
    switch (response.kind) {
      case 'ready':
        this.codecName = response.codec
        return
      case 'loaded': {
        const pending = this.take(this.byId, response.id)
        if (pending?.kind === 'load') {
          pending.resolve({ width: response.width, height: response.height, thumb: response.thumb })
        }
        return
      }
      case 'load-failed': {
        this.take(this.byId, response.id)?.reject(new Error(response.message))
        return
      }
      case 'preview': {
        const pending = this.take(this.byToken, response.token)
        if (pending?.kind === 'preview') {
          pending.resolve({ png: response.png, jpeg: response.jpeg })
        }
        return
      }
      case 'size': {
        // Intermediate result — keep the entry until 'sizes-done' arrives.
        const pending = this.byToken.get(response.token)
        if (pending?.kind === 'sizes') {
          pending.onCell({ format: response.format, scale: response.scale, bytes: response.bytes })
        }
        return
      }
      case 'sizes-done': {
        const pending = this.take(this.byToken, response.token)
        if (pending?.kind === 'sizes') pending.resolve()
        return
      }
      case 'exported': {
        const pending = this.take(this.byToken, response.token)
        if (pending?.kind === 'export') pending.resolve(response.files)
        return
      }
      case 'failed': {
        this.take(this.byToken, response.token)?.reject(new Error(response.message))
        return
      }
    }
  }

  private take<K>(map: Map<K, Pending>, key: K): Pending | undefined {
    const pending = map.get(key)
    map.delete(key)
    return pending
  }
}
