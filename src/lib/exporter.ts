import { zipSync } from 'fflate'
import type { ExportedFile } from '../workers/protocol'

export interface DownloadResult {
  fileName: string
  count: number
}

/**
 * Bundles the encoded assets into a zip and hands it to the browser.
 *
 * The File System Access API could write the files straight into a folder, but
 * Chrome refuses the Desktop, Documents and home folders themselves, so it
 * failed exactly where people expect it to work. One predictable route beats two
 * that behave differently per browser.
 */
export function downloadZip(files: ExportedFile[], baseName: string): DownloadResult | null {
  if (files.length === 0) return null

  const entries: Record<string, Uint8Array> = {}
  for (const file of files) entries[file.name] = new Uint8Array(file.data)
  // The payload is already-compressed PNG/JPEG, so store rather than deflate.
  const zipped = zipSync(entries, { level: 0 })
  const buffer = new ArrayBuffer(zipped.byteLength)
  new Uint8Array(buffer).set(zipped)

  const fileName = `${baseName}.zip`
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)

  return { fileName, count: files.length }
}
