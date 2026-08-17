export type Locale = 'en' | 'ja'

/**
 * English is the default; Japanese is used only when the browser itself is set
 * to Japanese. `navigator.language` is the top preference, so a visitor whose
 * primary language is English keeps English even with ja further down the list.
 */
function detectLocale(): Locale {
  const preferred = globalThis.navigator?.language ?? 'en'
  return preferred.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

const en = {
  documentTitle: 'XCAssetsForge - @1x/@2x/@3x asset export',
  documentDescription:
    'Encode PNG and JPEG for real, compare them side by side, and build @1x/@2x/@3x assets. Images are processed in your browser and never uploaded.',

  // Sidebar
  imageCount: (count: number) => `${count} image${count === 1 ? '' : 's'}`,
  chooseImages: 'Click to choose images',
  removeFromList: 'Remove from list',
  removeImage: (fileName: string) => `Remove ${fileName} from the list`,

  // Stage
  noImageTitle: 'No image selected',
  noImageBodyLine1: 'Add an image by clicking or dropping one',
  noImageBodyLine2: 'to compare PNG and JPEG side by side',
  comparisonSlider: 'Comparison slider',
  comparisonScale: 'Comparison scale',
  encoding: 'Encoding…',
  scaleUnavailableForCompare: (limit: number) =>
    `Available once the 1x short side is ${limit}px or less`,

  // Inspector
  format: 'Format',
  quality: 'Quality',
  jpegQuality: 'JPEG quality',
  jpegQualityNumber: 'JPEG quality (number)',
  size1x: 'Size (1x)',
  width: 'Width',
  height: 'Height',
  lockAspectRatio: 'Lock aspect ratio',
  aspectLocked: 'Aspect ratio locked',
  aspectUnlocked: 'Aspect ratio unlocked',
  scaleUnavailableForExport: (limit: number, current: number) =>
    `Exportable once the 1x short side is ${limit}px or less (currently ${current}px)`,
  capNote: (scales: string, max: number, shortSide: number) =>
    `${scales} would exceed the ${max}px short-side limit, so they can't be exported. The 1x short side is currently ${shortSide}px.`,
  fileName: 'File name',
  exportSize: 'Export size',
  total: 'Total',
  download: 'Download',
  downloading: 'Downloading…',

  // App
  dropToAdd: 'Drop to add',
  close: 'Close',
  downloaded: (fileName: string, count: number) =>
    `Downloaded ${fileName} (${count} file${count === 1 ? '' : 's'})`,

  // Errors
  unsupportedFormat: 'Unsupported image format. Choose PNG, JPEG, WebP or AVIF.',
  couldNotLoad: (fileName: string) => `Could not load ${fileName}.`,
  imageNotFound: 'Image not found',
}

/** The English table defines the contract; Japanese must satisfy it exactly. */
type Dictionary = typeof en

const ja: Dictionary = {
  documentTitle: 'XCAssetsForge - @1x/@2x/@3x アセット書き出し',
  documentDescription:
    'PNG と JPEG を実際に書き出して並べて比較し、@1x/@2x/@3x のアセットを作るツール。画像はブラウザ内で処理され、どこにも送信されません。',

  imageCount: (count) => `画像 ${count} 枚`,
  chooseImages: 'クリックして画像を選択',
  removeFromList: 'リストから削除',
  removeImage: (fileName) => `${fileName} をリストから削除`,

  noImageTitle: '画像が選択されていません',
  noImageBodyLine1: 'クリックまたはドラッグ＆ドロップで追加すると',
  noImageBodyLine2: 'PNG と JPEG を並べて比較できます',
  comparisonSlider: '比較スライダー',
  comparisonScale: '比較する倍率',
  encoding: 'エンコード中…',
  scaleUnavailableForCompare: (limit) => `1x の短辺が ${limit}px 以下のときに比較できます`,

  format: '形式',
  quality: 'クオリティ',
  jpegQuality: 'JPEG クオリティ',
  jpegQualityNumber: 'JPEG クオリティ（数値）',
  size1x: 'サイズ (1x)',
  width: '幅',
  height: '高さ',
  lockAspectRatio: '縦横比を固定',
  aspectLocked: '縦横比を固定中',
  aspectUnlocked: '縦横比の固定を解除中',
  scaleUnavailableForExport: (limit, current) =>
    `1x の短辺が ${limit}px 以下のときに書き出せます（現在 ${current}px）`,
  capNote: (scales, max, shortSide) =>
    `短辺が ${max}px を超えるため ${scales} は書き出せません。1x の短辺は現在 ${shortSide}px です。`,
  fileName: 'ファイル名',
  exportSize: '書き出しサイズ',
  total: '計',
  download: 'ダウンロード',
  downloading: 'ダウンロード中…',

  dropToAdd: 'ドロップして追加',
  close: '閉じる',
  downloaded: (fileName, count) => `${fileName}（${count} ファイル）をダウンロードしました`,

  unsupportedFormat: '対応していない画像形式です。PNG / JPEG / WebP / AVIF を選んでください。',
  couldNotLoad: (fileName) => `${fileName} を読み込めませんでした。`,
  imageNotFound: '画像が見つかりません',
}

export const locale = detectLocale()
export const t: Dictionary = locale === 'ja' ? ja : en
