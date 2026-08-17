import {
  FORMAT_LABEL,
  MAX_SHORT_SIDE,
  SCALES,
  clampQuality,
  shortSideLimitFor,
  type ExportFormat,
  type Scale,
} from '../lib/domain'
import type { Forge } from '../state/useForge'
import { SizeTable } from './SizeTable'
import { t } from '../lib/i18n'

interface Props {
  forge: Forge
  onExport: () => void
}

const FORMATS: ExportFormat[] = ['png', 'jpeg']

export function Inspector({ forge, onExport }: Props) {
  const noImage = forge.selected === null
  const qualityDisabled = forge.format === 'png'
  const shortSide = Math.min(forge.width, forge.height)
  const blockedScales = SCALES.filter((scale) => !forge.availableScales.includes(scale))

  return (
    <aside className="inspector">
      <div className="group">
        <span className="section-label">{t.format}</span>
        <div className="segmented" role="radiogroup" aria-label={t.format}>
          {FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              role="radio"
              aria-checked={forge.format === format}
              className="segmented__option"
              onClick={() => forge.setFormat(format)}
            >
              {FORMAT_LABEL[format]}
            </button>
          ))}
        </div>
      </div>

      <div className="group group--quality" data-disabled={qualityDisabled}>
        <span className="section-label">{t.quality}</span>
        <div className="quality-row">
          <input
            type="range"
            min={10}
            max={100}
            aria-label={t.jpegQuality}
            value={forge.quality}
            disabled={qualityDisabled}
            onChange={(event) => forge.setQuality(clampQuality(Number(event.target.value)))}
          />
          <input
            className="field quality-number"
            inputMode="numeric"
            aria-label={t.jpegQualityNumber}
            value={forge.qualityText}
            disabled={qualityDisabled}
            onChange={(event) => forge.setQualityText(event.target.value)}
            onBlur={forge.commitQualityText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') forge.commitQualityText()
            }}
          />
        </div>
      </div>

      <div className="group group--size" data-disabled={noImage}>
        <span className="section-label">{t.size1x}</span>

        <div className="size-row">
          <input
            className="field field--compact size-input"
            inputMode="numeric"
            aria-label={t.width}
            value={forge.widthText}
            onChange={(event) => forge.onWidthChange(event.target.value)}
          />
          <span className="size-row__times">×</span>
          <input
            className="field field--compact size-input"
            inputMode="numeric"
            aria-label={t.height}
            value={forge.heightText}
            onChange={(event) => forge.onHeightChange(event.target.value)}
          />

          <button
            type="button"
            className="lock-toggle"
            role="switch"
            aria-checked={forge.lockAspect}
            aria-label={t.lockAspectRatio}
            title={forge.lockAspect ? t.aspectLocked : t.aspectUnlocked}
            onClick={forge.toggleLock}
          >
            <ChainIcon linked={forge.lockAspect} />
          </button>
        </div>

        <div className="chips">
          {SCALES.map((scale) => (
            <ScaleChip key={scale} forge={forge} scale={scale} />
          ))}
        </div>

        {blockedScales.length > 0 && shortSide > 0 && (
          <p className="cap-note">
            {t.capNote(blockedScales.map((s) => `${s}x`).join(' / '), MAX_SHORT_SIDE, shortSide)}
          </p>
        )}
      </div>

      <div className="group">
        <span className="section-label">{t.fileName}</span>
        <input
          className="field"
          aria-label={t.fileName}
          value={forge.selected?.baseName ?? ''}
          disabled={noImage}
          placeholder="asset"
          onChange={(event) => forge.setBaseName(event.target.value)}
        />
      </div>

      <SizeTable forge={forge} />

      <button
        className="export-button"
        disabled={!forge.canExport || forge.isExporting}
        onClick={onExport}
      >
        {forge.isExporting ? t.downloading : t.download}
      </button>
    </aside>
  )
}

/** Linked / broken chain, the usual way image editors show an aspect lock. */
function ChainIcon({ linked }: { linked: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {linked ? (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      ) : (
        <>
          <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          <line x1="8" y1="2" x2="8" y2="5" />
          <line x1="16" y1="19" x2="16" y2="22" />
        </>
      )}
    </svg>
  )
}

function ScaleChip({ forge, scale }: { forge: Forge; scale: Scale }) {
  const available = forge.availableScales.includes(scale)
  const active = available && forge.enabledScales.includes(scale)
  const limit = shortSideLimitFor(scale)

  return (
    <button
      type="button"
      className="chip"
      aria-pressed={active}
      disabled={!available}
      title={
        available
          ? undefined
          : t.scaleUnavailableForExport(limit, Math.min(forge.width, forge.height))
      }
      onClick={() => forge.toggleScale(scale)}
    >
      <span className="chip__label">{scale}x</span>
      <span className="chip__dims">
        {forge.width * scale}×{forge.height * scale}
      </span>
    </button>
  )
}
