import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodecClient, type PreviewResult, type SizeCell } from '../lib/codecClient'
import {
  ACCEPTED_MIME,
  DEFAULT_BASE_WIDTH,
  DEFAULT_QUALITY,
  SCALES,
  baseNameFromFileName,
  clampFreeSide,
  clampQuality,
  clampShortSide,
  isAcceptedFile,
  isScaleAvailable,
  type ExportFormat,
  type Scale,
} from '../lib/domain'
import { t } from '../lib/i18n'

export interface SourceImage {
  id: string
  fileName: string
  baseName: string
  width: number
  height: number
  fileSize: number
  thumb: ImageBitmap
}

const EMPTY_PREVIEW: PreviewResult = { png: null, jpeg: null }

const digitsOf = (raw: string) => raw.replace(/\D/g, '')

export function useForge() {
  const clientRef = useRef<CodecClient | null>(null)
  if (clientRef.current === null) clientRef.current = new CodecClient()
  const client = clientRef.current

  const [images, setImages] = useState<SourceImage[]>([])
  const [selectionId, setSelectionId] = useState<string | null>(null)

  const [format, setFormat] = useState<ExportFormat>('png')
  const [quality, setQualityValue] = useState(DEFAULT_QUALITY)
  const [qualityText, setQualityTextValue] = useState(String(DEFAULT_QUALITY))
  const [enabledScales, setEnabledScales] = useState<Scale[]>([...SCALES])

  const [widthText, setWidthText] = useState('')
  const [heightText, setHeightText] = useState('')
  const [lockAspect, setLockAspect] = useState(true)

  // Dead centre, so the wipe starts where the scale picker above it sits and
  // neither format opens with more of the stage than the other.
  const [split, setSplit] = useState(0.5)
  const [isDropTargeted, setDropTargeted] = useState(false)

  /**
   * Which scale the stage compares. Defaults to 3x because that is the densest
   * asset actually shipped — artifacts that survive there survive everywhere.
   */
  const [previewScale, setPreviewScaleState] = useState<Scale>(3)
  /** What the user actually asked for, so a forced fallback can be undone. */
  const preferredScaleRef = useRef<Scale>(3)

  const setPreviewScale = useCallback((scale: Scale) => {
    preferredScaleRef.current = scale
    setPreviewScaleState(scale)
  }, [])

  const [comparison, setComparisonState] = useState<PreviewResult>(EMPTY_PREVIEW)
  /** Size table cells, keyed `${format}@${scale}`; absent until measured. */
  const [sizeTable, setSizeTable] = useState<Record<string, number>>({})
  const [isMeasuring, setMeasuring] = useState(false)
  const [isRendering, setRendering] = useState(false)
  const [isExporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => images.find((image) => image.id === selectionId) ?? null,
    [images, selectionId],
  )

  const width = Number(widthText) || 0
  const height = Number(heightText) || 0

  /** Scales whose own short side still fits the cap — the rest cannot be emitted. */
  const availableScales = useMemo(
    () => SCALES.filter((scale) => isScaleAvailable(width, height, scale)),
    [width, height],
  )

  /** What will actually be written: selected, minus anything the cap rules out. */
  const effectiveScales = useMemo(
    () => availableScales.filter((scale) => enabledScales.includes(scale)),
    [availableScales, enabledScales],
  )

  const canExport = selected !== null && width > 0 && height > 0 && effectiveScales.length > 0

  // If the size cap rules out the preferred scale, drop to the densest one still
  // allowed — and climb back once the size allows it again.
  useEffect(() => {
    if (availableScales.length === 0) return
    const preferred = preferredScaleRef.current
    const next = availableScales.includes(preferred)
      ? preferred
      : availableScales[availableScales.length - 1]
    setPreviewScaleState((current) => (current === next ? current : next))
  }, [availableScales])

  const previewWidth = width * previewScale
  const previewHeight = height * previewScale

  // Replacing the previous bitmaps means closing them, or every slider tick leaks
  // a decoded frame.
  const setComparison = useCallback((next: PreviewResult) => {
    setComparisonState((previous) => {
      if (previous.png && previous.png !== next.png) previous.png.close()
      if (previous.jpeg && previous.jpeg !== next.jpeg) previous.jpeg.close()
      return next
    })
  }, [])

  // MARK: - Library

  const add = useCallback(
    async (files: File[]) => {
      const accepted = files.filter(isAcceptedFile)
      if (accepted.length === 0) {
        if (files.length > 0) setError(t.unsupportedFormat)
        return
      }

      const loaded: SourceImage[] = []
      for (const file of accepted) {
        const id = crypto.randomUUID()
        try {
          const info = await client.load(id, file)
          loaded.push({
            id,
            fileName: file.name,
            baseName: baseNameFromFileName(file.name),
            width: info.width,
            height: info.height,
            fileSize: file.size,
            thumb: info.thumb,
          })
        } catch {
          setError(t.couldNotLoad(file.name))
        }
      }
      if (loaded.length === 0) return

      setImages((previous) => [...previous, ...loaded])
      setSelectionId((previous) => previous ?? loaded[0].id)
    },
    [client],
  )

  /**
   * Opens the system file picker. Built on the fly rather than from a hidden
   * input in one component, so any surface — the drop zone, the empty stage —
   * can offer it. Must be called straight from a click to keep the activation.
   */
  const openFilePicker = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPTED_MIME.join(',')
    input.multiple = true
    input.addEventListener('change', () => {
      void add(Array.from(input.files ?? []))
    })
    input.click()
  }, [add])

  const setBaseName = useCallback(
    (name: string) => {
      setImages((previous) =>
        previous.map((image) => (image.id === selectionId ? { ...image, baseName: name } : image)),
      )
    },
    [selectionId],
  )

  // MARK: - Size

  const applyWidth = useCallback(
    (raw: string, source: SourceImage | null, locked: boolean) => {
      if (!source) {
        setWidthText(digitsOf(raw))
        return
      }
      const digits = digitsOf(raw)
      if (digits === '') {
        setWidthText('')
        if (locked) setHeightText('')
        return
      }
      const requested = Math.max(0, Number(digits))
      if (locked) {
        const ratio = source.width / source.height
        const paired = requested === 0 ? 0 : Math.max(1, Math.round(requested / ratio))
        const [w, h] = clampShortSide(requested, paired)
        setWidthText(String(w))
        setHeightText(String(h))
      } else {
        setWidthText(String(clampFreeSide(requested, Number(heightText) || 0)))
      }
    },
    [heightText],
  )

  const applyHeight = useCallback(
    (raw: string, source: SourceImage | null, locked: boolean) => {
      if (!source) {
        setHeightText(digitsOf(raw))
        return
      }
      const digits = digitsOf(raw)
      if (digits === '') {
        setHeightText('')
        if (locked) setWidthText('')
        return
      }
      const requested = Math.max(0, Number(digits))
      if (locked) {
        const ratio = source.width / source.height
        const paired = requested === 0 ? 0 : Math.max(1, Math.round(requested * ratio))
        const [w, h] = clampShortSide(paired, requested)
        setWidthText(String(w))
        setHeightText(String(h))
      } else {
        setHeightText(String(clampFreeSide(requested, Number(widthText) || 0)))
      }
    },
    [widthText],
  )

  const onWidthChange = useCallback(
    (raw: string) => applyWidth(raw, selected, lockAspect),
    [applyWidth, selected, lockAspect],
  )
  const onHeightChange = useCallback(
    (raw: string) => applyHeight(raw, selected, lockAspect),
    [applyHeight, selected, lockAspect],
  )

  const toggleLock = useCallback(() => {
    setLockAspect((previous) => {
      const next = !previous
      if (next) applyWidth(widthText, selected, true)
      return next
    })
  }, [applyWidth, widthText, selected])

  /**
   * Guards the seeding effect below so a width the user deliberately emptied is
   * left alone. Cleared when the library empties, because the next image then
   * has to seed its own size from scratch.
   */
  const seededRef = useRef(false)

  const select = useCallback(
    (id: string) => {
      setSelectionId(id)
      const image = images.find((candidate) => candidate.id === id)
      if (!image) return
      // The first image seeds the base width — never upscaling a small source by
      // default. Later selections keep the width and re-derive the height.
      const seed = widthText === '' ? Math.min(DEFAULT_BASE_WIDTH, image.width) : Number(widthText) || 0
      // Both sides are re-seeded from the new source even with the aspect
      // unlocked. Carrying the previous image's height across encodes the new
      // one squashed, and the size table reports those wrong bytes as fact.
      applyWidth(String(seed), image, true)
    },
    [images, widthText, applyWidth],
  )

  /**
   * Sits next to `select` rather than with the rest of the library, because
   * removing the selected image moves the selection and that has to go through
   * the same seeding — otherwise whatever is selected next inherits the removed
   * image's dimensions and gets encoded squashed.
   */
  const remove = useCallback(
    (id: string) => {
      const index = images.findIndex((image) => image.id === id)
      if (index < 0) return

      client.release(id)
      images[index].thumb.close()
      const next = images.filter((image) => image.id !== id)
      // Updater form, so two removals landing in one batch don't each rebuild
      // the list from the same starting array and lose one of the deletions.
      setImages((previous) => previous.filter((image) => image.id !== id))

      if (selectionId !== id) return

      const fallback = next[index] ?? next[next.length - 1] ?? null
      if (fallback) {
        select(fallback.id)
        return
      }
      // Emptying the library also clears the size, so the next image seeds from
      // itself instead of inheriting the dimensions of one that is gone.
      setSelectionId(null)
      setWidthText('')
      setHeightText('')
      seededRef.current = false
    },
    [client, images, selectionId, select],
  )

  // Seeding for the very first image has to wait until it is in `images`.
  useEffect(() => {
    if (seededRef.current || !selected || widthText !== '') return
    seededRef.current = true
    // Always derives the height, for the reason given in `select`.
    applyWidth(String(Math.min(DEFAULT_BASE_WIDTH, selected.width)), selected, true)
  }, [selected, widthText, applyWidth])

  // MARK: - Settings

  const setQuality = useCallback((value: number) => {
    const clamped = clampQuality(value)
    setQualityValue(clamped)
    setQualityTextValue(String(clamped))
  }, [])

  /** Live edits only reach the encoder once the typed value is actually in range. */
  const setQualityText = useCallback((raw: string) => {
    const digits = digitsOf(raw).slice(0, 3)
    setQualityTextValue(digits)
    const value = Number(digits)
    if (digits !== '' && value >= 10 && value <= 100) setQualityValue(value)
  }, [])

  const commitQualityText = useCallback(() => {
    const value = Number(qualityText)
    setQuality(Number.isFinite(value) && qualityText !== '' ? value : quality)
  }, [qualityText, quality, setQuality])

  const toggleScale = useCallback((scale: Scale) => {
    setEnabledScales((previous) =>
      previous.includes(scale) ? previous.filter((s) => s !== scale) : [...previous, scale],
    )
  }, [])

  // MARK: - Rendering

  /**
   * Renaming rewrites the image object, so depending on `selected` here would
   * re-run both encodes on every keystroke in the filename field. Only the id
   * reaches the worker; the name is a label the export puts on the result.
   */
  const selectedId = selected?.id ?? null

  // The comparison at the previewed scale. Independent of the export format, so
  // switching PNG/JPEG never re-encodes it, and the PNG half is cached across
  // quality changes.
  useEffect(() => {
    if (!selectedId || previewWidth <= 0 || previewHeight <= 0) {
      setComparison(EMPTY_PREVIEW)
      setRendering(false)
      return
    }

    let cancelled = false
    setRendering(true)

    // Debounced so dragging the quality slider doesn't queue an encode per frame.
    const timer = window.setTimeout(() => {
      client
        .preview({ id: selectedId, width: previewWidth, height: previewHeight, quality })
        .then((result) => {
          if (cancelled) {
            result.png?.close()
            result.jpeg?.close()
            return
          }
          setComparison(result)
        })
        .catch((cause: Error) => {
          if (!cancelled) setError(cause.message)
        })
        .finally(() => {
          if (!cancelled) setRendering(false)
        })
    }, 140)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [client, selectedId, previewWidth, previewHeight, quality, setComparison])

  // Every format/scale combination for the size table. Runs last and streams its
  // results in, so the stage and the total are never held up by it.
  useEffect(() => {
    setSizeTable({})
    if (!selectedId || width <= 0 || height <= 0) {
      setMeasuring(false)
      return
    }

    let cancelled = false
    setMeasuring(true)

    const timer = window.setTimeout(() => {
      client
        .sizes({ id: selectedId, width, height, quality }, (cell: SizeCell) => {
          if (cancelled) return
          setSizeTable((previous) => ({
            ...previous,
            [`${cell.format}@${cell.scale}`]: cell.bytes,
          }))
        })
        .catch((cause: Error) => {
          if (!cancelled) setError(cause.message)
        })
        .finally(() => {
          if (!cancelled) setMeasuring(false)
        })
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [client, selectedId, width, height, quality])

  return {
    client,
    images,
    selected,
    selectionId,
    format,
    quality,
    qualityText,
    enabledScales,
    availableScales,
    effectiveScales,
    widthText,
    heightText,
    lockAspect,
    split,
    isDropTargeted,
    previewScale,
    previewWidth,
    previewHeight,
    setPreviewScale,
    comparison,
    sizeTable,
    isMeasuring,
    isRendering,
    isExporting,
    error,
    canExport,
    width,
    height,
    add,
    openFilePicker,
    remove,
    select,
    setBaseName,
    setFormat,
    setQuality,
    setQualityText,
    commitQualityText,
    toggleScale,
    onWidthChange,
    onHeightChange,
    toggleLock,
    setSplit,
    setDropTargeted,
    setExporting,
    setError,
  }
}

export type Forge = ReturnType<typeof useForge>
