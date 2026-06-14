# sdneedle.point architecture

## Product stance

sdneedle.point is a browser-native needlepoint digitizer. The product should remain usable by beginners while exposing enough control for experienced stitchers.

The current release is static and dependency-free. This keeps GitHub Pages deployment simple and makes the first open-source version easy to inspect.

## Data flow

```txt
Image upload
  -> browser decode
  -> mesh and finished-size calculation
  -> crop or contain transform
  -> high-quality downsample to stitch grid
  -> weighted color clustering
  -> Lab nearest-thread mapping
  -> rare-color cleanup
  -> PatternDocument
  -> canvas preview / swatch legend / exports
```

## Pattern document

The app builds an in-memory document with these conceptual sections:

- `canvas`: mesh, finished inches, stitch dimensions, total stitch count
- `settings`: selected size, fit mode, max colors, cleanup, dithering
- `sourceImage`: source dimensions and fit mode
- `threadLibrary`: selected palette and notes
- `palette`: matched colors with symbol, hex, thread number, name, and stitch count
- `grid`: typed-array stitch grid, where each cell references a palette index
- `warnings`: user-facing stitchability and printing notes

This model should become the boundary between future packages:

```txt
packages/pattern-core
packages/thread-palettes
packages/exporters
packages/ui
```

## Rendering

The main preview uses a single `<canvas>` element. The app should not render individual DOM nodes for stitches. Large charts should eventually use tiled canvas rendering or WebGL.

## Exports

- Chart PDF is handled through browser print/save PDF.
- Direct canvas print is handled through a 300 DPI canvas guide and print stylesheet.
- PNG exports use generated canvas elements.
- SVG export is layered for print, cutter, CNC, and design-tool workflows.
- STL export creates a physical grid-stencil prototype based on canvas mesh spacing.

## Known limitations

- Browser print behavior varies by operating system and browser.
- Direct canvas printing requires physical calibration.
- Waverly Wool data is currently a replaceable palette scaffold and should be swapped for verified official data.
- Chart PDF pagination is not yet optimized for very large patterns.
- STL grid stencils are prototypes and need slicer/printer validation.

## Recommended next package split

When the static prototype stabilizes, extract:

```txt
packages/pattern-core/src/createPatternDocument.ts
packages/pattern-core/src/color.ts
packages/thread-palettes/src/dmc.ts
packages/thread-palettes/src/waverly.ts
packages/exporters/src/svg.ts
packages/exporters/src/stl.ts
packages/exporters/src/png.ts
apps/web/src/App.tsx
```
