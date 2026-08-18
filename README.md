# XCAssetsForge

PNG と JPEG を**実際に書き出して**並べて比較し、`@1x` / `@2x` / `@3x` のアセットを作るツール。

画像はすべてブラウザ内で処理され、どこにも送信されません。Worker は静的ファイルを配信するだけです。

## 仕組み

- エンコードは Web Worker 内の **WASM コーデック**（MozJPEG / Squoosh PNG + OxiPNG level 1）、リサイズは Lanczos3。
  ブラウザ標準の `canvas.toBlob` と違い、どの環境でも同じバイト数・同じ画質になります。
- 表示しているサイズは推定値ではなく、実際に書き出されるファイルのバイト数です。
- 比較ビューの PNG 側は自前の背景を持つため、透過部分から JPEG が透けることはありません。
- 書き出しは `name@1x` / `@2x` / `@3x` を ZIP にまとめてダウンロードします。
- COOP/COEP でクロスオリジン分離を有効にしており、OxiPNG が全コアを使います（`public/_headers` と
  `vite.config.ts` の両方で設定。外部ドメインのリソースは読み込めなくなる点に注意）。

## サイズの上限

書き出す画像の**短辺は 3000px まで**です。各スケールは自分の短辺で判定され、超えるものは選べません。

| スケール | 必要な 1x の短辺 |
| --- | --- |
| 1x | 3000px 以下 |
| 2x | 1500px 以下 |
| 3x | 1000px 以下 |

## 開発

```sh
npm install
npm run dev       # Vite 開発サーバー
npm run build     # 型チェック + 本番ビルド
npm run serve     # ビルドして wrangler dev で配信
npm run deploy    # Cloudflare Workers へデプロイ
```

## ライセンス

MIT License（[LICENSE](LICENSE)）。

同梱している wasm コーデックなど第三者コンポーネントの表示は
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) にまとめています。
