import { useCallback, useEffect, useState } from 'react'
import { Inspector } from './components/Inspector'
import { Sidebar } from './components/Sidebar'
import { Stage } from './components/Stage'
import { sanitizeBaseName } from './lib/domain'
import { downloadZip } from './lib/exporter'
import { useForge } from './state/useForge'
import { t } from './lib/i18n'

export default function App() {
  const forge = useForge()
  const [notice, setNotice] = useState<string | null>(null)

  // Dropping anywhere in the window adds images; the sidebar zone just shows it.
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      forge.setDropTargeted(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) forge.setDropTargeted(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files.length) return
      event.preventDefault()
      forge.setDropTargeted(false)
      void forge.add(Array.from(event.dataTransfer.files))
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [forge])

  const onExport = useCallback(async () => {
    if (!forge.selected || !forge.canExport) return

    forge.setExporting(true)
    try {
      const files = await forge.client.export(forge.selected.baseName, {
        id: forge.selected.id,
        width: forge.width,
        height: forge.height,
        quality: forge.quality,
        format: forge.format,
        scales: forge.effectiveScales,
      })
      const result = downloadZip(files, sanitizeBaseName(forge.selected.baseName))
      if (result) {
        setNotice(t.downloaded(result.fileName, result.count))
      }
    } catch (cause) {
      forge.setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      forge.setExporting(false)
    }
  }, [forge])

  // Long enough that the sponsor link can be reached, not merely read.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <>
      <div className="app">
        <Sidebar forge={forge} />
        <Stage forge={forge} />
        <Inspector forge={forge} onExport={onExport} />
      </div>

      {/* Files can be dropped anywhere in the window, so the affordance covers
          the whole window rather than just the sidebar zone. */}
      {forge.isDropTargeted && (
        <div className="drop-overlay" aria-hidden="true">
          <span className="drop-overlay__label">{t.dropToAdd}</span>
        </div>
      )}

      {forge.error && (
        <div className="toast" role="alert">
          <span>{forge.error}</span>
          <button onClick={() => forge.setError(null)}>{t.close}</button>
        </div>
      )}
      {/* The only place the app asks for anything, and it asks once the work is
          done. COEP blocks subresources rather than navigations, so a plain link
          belongs here where an external badge image would be refused. */}
      {!forge.error && notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <a
            className="toast__link"
            href="https://github.com/sponsors/famio"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.supportThisTool}
          </a>
        </div>
      )}
    </>
  )
}
