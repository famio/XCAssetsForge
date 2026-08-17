import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '../lib/domain'
import type { Forge, SourceImage } from '../state/useForge'

interface Props {
  forge: Forge
}

/** ImageBitmap can't go in an <img>, so each thumbnail gets a tiny canvas. */
function Thumbnail({ image }: { image: SourceImage }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(34 * dpr)
    canvas.height = Math.round(26 * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, 34, 26)
    const scale = Math.min(32 / image.thumb.width, 24 / image.thumb.height)
    const width = image.thumb.width * scale
    const height = image.thumb.height * scale
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image.thumb, (34 - width) / 2, (26 - height) / 2, width, height)
  }, [image.thumb])

  return <canvas ref={ref} className="image-row__thumb" />
}

export function Sidebar({ forge }: Props) {
  const [dropTargeted, setDropTargeted] = useState(false)

  return (
    <aside className="sidebar">
      <header className="sidebar__brand">
        <h1>XCAssetsForge</h1>
      </header>

      <div className="sidebar__header section-label">画像 {forge.images.length} 枚</div>

      <div className="sidebar__list">
        {forge.images.map((image) => (
          <div
            key={image.id}
            className="image-row"
            role="option"
            aria-selected={image.id === forge.selectionId}
            tabIndex={0}
            onClick={() => forge.select(image.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                forge.select(image.id)
              }
            }}
          >
            <Thumbnail image={image} />
            <div className="image-row__text">
              <div className="image-row__name" title={image.fileName}>
                {image.fileName}
              </div>
              <div className="image-row__dims">
                {image.width}×{image.height} · {formatBytes(image.fileSize)}
              </div>
            </div>
            <button
              className="image-row__remove"
              title="リストから削除"
              aria-label={`${image.fileName} をリストから削除`}
              onClick={(event) => {
                event.stopPropagation()
                forge.remove(image.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Lights up only when the pointer is actually over the zone — the
          window-wide overlay covers the general "you can drop" case. */}
      <button
        className="dropzone"
        data-targeted={dropTargeted}
        onClick={forge.openFilePicker}
        onDragOver={(event) => {
          event.preventDefault()
          setDropTargeted(true)
        }}
        onDragLeave={() => setDropTargeted(false)}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDropTargeted(false)
          void forge.add(Array.from(event.dataTransfer.files))
        }}
      >
        クリックして画像を選択
      </button>

    </aside>
  )
}
