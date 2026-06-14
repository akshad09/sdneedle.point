# sdneedle.point

A local-first web app for turning uploaded images into needlepoint patterns, printable canvas guides, SVG cutter files, and 3D grid-stencil models.

The project is intentionally built as a static site so it can run for free on GitHub Pages and keep user images in the browser.

## Live site

Active GitHub Pages URL:

```txt
https://akshad09.github.io/sdneedle.point/
```

A custom domain can be added later after purchasing a valid domain name.

## Current features

- Upload PNG, JPG, or WebP images
- Choose finished size: 5×7, 8×10, 9×12, 11×14, or custom
- Choose mesh count: 10, 12, 14, or 18 count canvas
- Choose thread type: DMC Floss or Waverly Wool palette scaffold
- Crop-to-fill or fit-with-border image handling
- Dominant color extraction and palette reduction
- Perceptual nearest-thread matching using Lab color distance
- Color swatch legend with thread number, name, hex value, symbol, and stitch count
- Zoomable browser preview with color, symbol, and canvas-print modes
- Stitchability warnings for large charts, high color counts, rare colors, and detail loss
- Local save/load in the browser through IndexedDB with localStorage fallback
- Export targets:
  - Print / save chart PDF through the browser print dialog
  - Print direct canvas guide through the browser print dialog
  - Download chart PNG
  - Download 300 DPI direct canvas print PNG
  - Download layered SVG for print, CNC, and circuit-cutter workflows
  - Download STL grid stencil for 3D printing experiments
- Custom palette CSV import

## Privacy model

Images are decoded and processed client-side. The static site does not upload images to a server.

## Direct canvas printing notes

Canvas printing is included from day one, but physical output depends on the printer, canvas material, feed alignment, and browser print settings.

Recommended workflow:

1. Download or print the direct canvas guide.
2. Print at **100% scale**.
3. Disable **fit to page** or **scale to printable area**.
4. Test on paper first.
5. Measure the 1 inch calibration square.
6. Only print canvas after the scale and alignment are correct.

## Custom palette CSV

The advanced panel supports CSV palette import. Expected columns:

```csv
number,name,hex
321,Red,#C72B3B
310,Black,#000000
```

Imported palettes temporarily replace the selected built-in palette in the current browser session.

## Repository structure

This first release is dependency-free and deploys as static files:

```txt
index.html                     App shell and semantic layout
styles.css                     Visual design, responsive layout, and print styles
palettes.js                    Thread palette data and palette normalization
app.js                         Pattern engine, rendering, exports, and local saves
.github/workflows/static.yml   GitHub Pages deployment workflow
```

A future package-based structure can split `app.js` into `pattern-core`, `thread-palettes`, `exporters`, and `ui` packages once the product behavior stabilizes.

## Development

Open `index.html` directly in a browser or serve the folder with any static server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## License

MIT.
