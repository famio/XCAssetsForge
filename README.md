# XCAssetsForge

**English** · [日本語](README.ja.md)

Encode PNG and JPEG **for real**, compare them side by side, and build
`@1x` / `@2x` / `@3x` assets.

**[xcassets.famio.dev](https://xcassets.famio.dev)**

Every image is processed in your browser and never uploaded. The Worker only
serves static files.

## How it works

- Encoding runs on **WASM codecs** in a Web Worker (MozJPEG / Squoosh PNG +
  OxiPNG level 1), with Lanczos3 for resizing. Unlike the browser's
  `canvas.toBlob`, every environment produces the same bytes at the same
  quality.
- The sizes on screen are not estimates. They are the byte counts of the files
  that actually get written.
- Export bundles `name@1x` / `@2x` / `@3x` into a ZIP.
- Cross-origin isolation is enabled through COOP/COEP so OxiPNG can use every
  core (set in both `public/_headers` and `vite.config.ts` — note that this
  makes cross-origin resources unloadable).

## Size limit

The **short side of anything emitted is capped at 3000px**. Each scale is
checked against its own short side, so anything above the cap cannot be
selected.

| Scale | Required 1x short side |
| --- | --- |
| 1x | 3000px or less |
| 2x | 1500px or less |
| 3x | 1000px or less |

## Development

```sh
npm install
npm run dev       # Vite dev server
npm run build     # Type check + production build
npm run serve     # Build and serve through wrangler dev
npm run deploy    # Deploy to Cloudflare Workers
```

Cloudflare is not a requirement. Any host works as long as it can serve
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` — without them SharedArrayBuffer is
unavailable and OxiPNG drops to a single core.

`public/_headers` uses the Cloudflare / Netlify format, so on another host you
will need to apply the equivalent configuration in whatever way that host
provides.

## License

MIT License ([LICENSE](LICENSE)).

Notices for the bundled third-party components, including the wasm codecs, are
collected in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
