import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SCALES, clampSplit, fitRect, shortSideLimitFor } from '../lib/domain'
import type { Forge } from '../state/useForge'

interface Props {
  forge: Forge
}

/** Draws one encode into a canvas at the shared fitted rect. */
function useBitmapCanvas(
  bitmap: ImageBitmap | null,
  size: { width: number; height: number },
): React.RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas || size.width === 0 || size.height === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)
    if (!bitmap) return

    const rect = fitRect(bitmap.width, bitmap.height, size.width, size.height)
    // Smoothing a magnified asset would hide the very artifacts being compared.
    ctx.imageSmoothingEnabled = !rect.magnified
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height)
  }, [bitmap, size.width, size.height])

  return ref
}

export function Stage({ forge }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [isSliding, setSliding] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setSize({ width: box.width, height: box.height })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const jpegRef = useBitmapCanvas(forge.comparison.jpeg, size)
  const pngRef = useBitmapCanvas(forge.comparison.png, size)

  const moveSplit = useCallback(
    (clientX: number) => {
      const host = hostRef.current
      if (!host) return
      const box = host.getBoundingClientRect()
      if (box.width === 0) return
      forge.setSplit(clampSplit((clientX - box.left) / box.width))
    },
    [forge],
  )

  const onHandleDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setSliding(true)
      const move = (moveEvent: PointerEvent) => moveSplit(moveEvent.clientX)
      const up = () => {
        setSliding(false)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [moveSplit],
  )

  const hasImage = forge.selected !== null
  const splitPercent = `${forge.split * 100}%`

  return (
    <div
      ref={hostRef}
      className="stage"
      onPointerDown={(event) => {
        if (hasImage) moveSplit(event.clientX)
      }}
    >
      <div className="hatch" />

      {!hasImage && (
        <button type="button" className="stage__empty" onClick={forge.openFilePicker}>
          <span className="stage__empty-title">画像が選択されていません</span>
          <span className="stage__empty-body">
            クリックまたはドラッグ＆ドロップで追加すると
            <br />
            PNG と JPEG を並べて比較できます
          </span>
        </button>
      )}

      {hasImage && (
        <>
          <div style={{ opacity: forge.isRendering ? 0.65 : 1, transition: 'opacity .1s ease' }}>
            <canvas ref={jpegRef} className="stage__canvas" />

            {/* Clipped with its own backdrop so PNG transparency never reveals the JPEG. */}
            <div className="stage__png-side" style={{ clipPath: `inset(0 ${100 - forge.split * 100}% 0 0)` }}>
              <div className="hatch" />
              <canvas ref={pngRef} className="stage__canvas" />
            </div>
          </div>

          <div className="stage__divider" style={{ left: splitPercent }} />

          {/* The stage moves the wipe on pointerdown, so controls sitting on it
              have to keep their clicks to themselves. */}
          <div className="scale-picker" onPointerDown={(event) => event.stopPropagation()}>
            <div className="scale-picker__options" role="radiogroup" aria-label="比較する倍率">
              {SCALES.map((scale) => {
                const available = forge.availableScales.includes(scale)
                return (
                  <button
                    key={scale}
                    type="button"
                    role="radio"
                    aria-checked={forge.previewScale === scale}
                    disabled={!available}
                    title={
                      available
                        ? undefined
                        : `1x の短辺が ${shortSideLimitFor(scale)}px 以下のときに比較できます`
                    }
                    onClick={() => forge.setPreviewScale(scale)}
                  >
                    {scale}x
                  </button>
                )
              })}
            </div>
            <span className="scale-picker__dims">
              {forge.isRendering
                ? 'エンコード中…'
                : `${forge.previewWidth}×${forge.previewHeight}`}
            </span>
          </div>

          {/* Labels only — the byte counts live in the inspector's size table. */}
          <div className="badges">
            <span className="badge">PNG</span>
            <span className="badge">JPEG {forge.quality}</span>
          </div>

          <div
            className="stage__handle"
            data-sliding={isSliding}
            style={{ left: splitPercent }}
            onPointerDown={onHandleDown}
            role="separator"
            aria-label="比較スライダー"
            aria-orientation="vertical"
            aria-valuenow={Math.round(forge.split * 100)}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') forge.setSplit(clampSplit(forge.split - 0.02))
              if (event.key === 'ArrowRight') forge.setSplit(clampSplit(forge.split + 0.02))
            }}
          >
            <div className="stage__knob">
              <span className="stage__arrow stage__arrow--left" />
              <span className="stage__arrow stage__arrow--right" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
