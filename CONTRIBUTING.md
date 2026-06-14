# Contributing to sdneedle.point

sdneedle.point is designed for contributors who care about creative tools, craft workflows, browser-based image processing, and accessible UI.

## Priorities

1. Keep the app local-first unless a feature truly requires a backend.
2. Preserve beginner-friendly defaults.
3. Put advanced controls behind progressive disclosure.
4. Treat physical exports as calibration-sensitive workflows.
5. Keep thread palette data sourceable and replaceable.
6. Avoid one-DOM-node-per-stitch rendering; use canvas/SVG exports instead.

## Useful contribution areas

- More accurate DMC and Waverly palette data
- Palette source citations and licensing review
- Better color quantization
- Manual color merge/replace tools
- Export pagination for very large chart PDFs
- Real-world direct canvas print calibration tests
- SVG presets for Cricut, Silhouette, laser, and CNC tools
- 3D stencil variants and slicer-tested models
- Accessibility review and keyboard interaction improvements

## Code style

This initial version uses plain browser JavaScript to keep deployment simple. Keep functions small, deterministic where practical, and easy to move into packages later.
