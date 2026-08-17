import { FORMAT_LABEL, SCALES, formatBytes, type ExportFormat, type Scale } from '../lib/domain'
import type { Forge } from '../state/useForge'

const FORMATS: ExportFormat[] = ['png', 'jpeg']

/**
 * Every format at every scale, so the choice between PNG and JPEG can be made
 * from the actual numbers instead of by switching formats back and forth.
 */
export function SizeTable({ forge }: { forge: Forge }) {
  if (!forge.selected || forge.width <= 0 || forge.height <= 0) return null

  const cell = (format: ExportFormat, scale: Scale) => forge.sizeTable[`${format}@${scale}`]

  const totalFor = (format: ExportFormat) => {
    let sum = 0
    for (const scale of forge.effectiveScales) {
      const bytes = cell(format, scale)
      if (bytes === undefined) return undefined
      sum += bytes
    }
    return forge.effectiveScales.length === 0 ? 0 : sum
  }

  return (
    <div className="group">
      <span className="section-label">書き出しサイズ</span>

      <table className="size-table">
        <thead>
          <tr>
            <th scope="col" />
            {FORMATS.map((format) => (
              <th key={format} scope="col" data-active={forge.format === format}>
                {FORMAT_LABEL[format]}
                {format === 'jpeg' && <span className="size-table__quality"> {forge.quality}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SCALES.map((scale) => {
            const available = forge.availableScales.includes(scale)
            const included = forge.effectiveScales.includes(scale)
            return (
              <tr key={scale} data-included={included} data-available={available}>
                <th scope="row">{scale}x</th>
                {FORMATS.map((format) => {
                  const bytes = available ? cell(format, scale) : undefined
                  return (
                    <td key={format} data-active={forge.format === format}>
                      {!available ? '—' : bytes === undefined ? '…' : formatBytes(bytes)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">計</th>
            {FORMATS.map((format) => {
              const sum = totalFor(format)
              return (
                <td key={format} data-active={forge.format === format}>
                  {sum === undefined ? '…' : formatBytes(sum)}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
