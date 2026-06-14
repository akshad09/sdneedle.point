import { getPalette, normalizePalette } from "./palettes.js";

const BLANK = 65535;
const SAVE_KEY = "sdneedle.point.autosave.v2";
const SYMBOLS = "●▲■◆✚✦✿○△□◇+×/\\|—ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
const SIZE_PRESETS = { "5x7": [5, 7], "8x10": [8, 10], "9x12": [9, 12], "11x14": [11, 14] };
const DETAIL_COLORS = { simple: 14, balanced: 28, portrait: 36, detailed: 42, max: 56 };

const dom = {
  imageInput: document.querySelector("#imageInput"),
  paletteUpload: document.querySelector("#paletteUpload"),
  dropzone: document.querySelector("#dropzone"),
  sourcePreview: document.querySelector("#sourcePreview"),
  sizePreset: document.querySelector("#sizePreset"),
  customSizeFields: document.querySelector("#customSizeFields"),
  customWidth: document.querySelector("#customWidth"),
  customHeight: document.querySelector("#customHeight"),
  meshCount: document.querySelector("#meshCount"),
  threadType: document.querySelector("#threadType"),
  fitMode: document.querySelector("#fitMode"),
  detailLevel: document.querySelector("#detailLevel"),
  maxColors: document.querySelector("#maxColors"),
  maxColorsOut: document.querySelector("#maxColorsOut"),
  cleanupThreshold: document.querySelector("#cleanupThreshold"),
  cleanupOut: document.querySelector("#cleanupOut"),
  ditherToggle: document.querySelector("#ditherToggle"),
  patternStats: document.querySelector("#patternStats"),
  previewMode: document.querySelector("#previewMode"),
  zoomRange: document.querySelector("#zoomRange"),
  emptyState: document.querySelector("#emptyState"),
  canvasScroll: document.querySelector("#canvasScroll"),
  patternCanvas: document.querySelector("#patternCanvas"),
  warningsList: document.querySelector("#warningsList"),
  swatchList: document.querySelector("#swatchList"),
  copyLegendButton: document.querySelector("#copyLegendButton"),
  printPatternButton: document.querySelector("#printPatternButton"),
  printCanvasButton: document.querySelector("#printCanvasButton"),
  downloadChartPngButton: document.querySelector("#downloadChartPngButton"),
  downloadCanvasPngButton: document.querySelector("#downloadCanvasPngButton"),
  downloadSvgButton: document.querySelector("#downloadSvgButton"),
  downloadStlButton: document.querySelector("#downloadStlButton"),
  saveProjectButton: document.querySelector("#saveProjectButton"),
  loadSavedButton: document.querySelector("#loadSavedButton"),
  resetButton: document.querySelector("#resetButton"),
  printArea: document.querySelector("#printArea")
};

const state = { image: null, imageDataUrl: "", imageName: "untitled", customPalette: null, pattern: null, generateTimer: null, isGenerating: false };

init();

function init() {
  bindEvents();
  ensureExportLabels();
  syncCustomSizeFields();
  syncDetailSlider(false);
  syncOutputs();
  updateExportButtons();
  renderEmptyLegend();
}

function bindEvents() {
  dom.imageInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadImageFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropzone.classList.remove("dragover");
    });
  });

  dom.dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) loadImageFile(file);
  });

  dom.paletteUpload.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importPaletteCsv(file);
  });

  [dom.sizePreset, dom.customWidth, dom.customHeight, dom.meshCount, dom.threadType, dom.fitMode, dom.maxColors, dom.cleanupThreshold, dom.ditherToggle].forEach((input) => {
    input.addEventListener("input", () => {
      if (input === dom.sizePreset) syncCustomSizeFields();
      syncOutputs();
      queueGenerate();
    });
  });

  dom.detailLevel.addEventListener("input", () => {
    syncDetailSlider(true);
    syncOutputs();
    queueGenerate();
  });
  dom.previewMode.addEventListener("input", renderPatternPreview);
  dom.zoomRange.addEventListener("input", renderPatternPreview);

  dom.copyLegendButton.addEventListener("click", copyLegend);
  dom.printPatternButton.addEventListener("click", downloadChartPdf);
  dom.printCanvasButton.addEventListener("click", downloadCanvasPrintPdf);
  dom.downloadChartPngButton.addEventListener("click", downloadChartPng);
  dom.downloadCanvasPngButton.addEventListener("click", downloadCanvasPrintPng);
  dom.downloadSvgButton.addEventListener("click", downloadSvg);
  dom.downloadStlButton.addEventListener("click", downloadStl);
  dom.saveProjectButton.addEventListener("click", () => saveProject(true));
  dom.loadSavedButton.addEventListener("click", loadSavedProject);
  dom.resetButton.addEventListener("click", resetProject);
}

function ensureExportLabels() {
  dom.printPatternButton.textContent = "Download clean chart PDF";
  dom.printCanvasButton.textContent = "Download exact canvas PDF";
}

function syncDetailSlider(force = true) {
  const value = DETAIL_COLORS[dom.detailLevel.value] ?? 28;
  if (force || !dom.maxColors.value) dom.maxColors.value = String(value);
  if (dom.detailLevel.value === "portrait" && Number(dom.cleanupThreshold.value) > 10) dom.cleanupThreshold.value = "6";
}

function syncCustomSizeFields() {
  dom.customSizeFields.hidden = dom.sizePreset.value !== "custom";
}

function syncOutputs() {
  dom.maxColorsOut.value = dom.maxColors.value;
  dom.cleanupOut.value = `${dom.cleanupThreshold.value} stitches`;
  updateStaticStats();
}

function getSettings() {
  const preset = SIZE_PRESETS[dom.sizePreset.value];
  const width = preset ? preset[0] : clamp(Number(dom.customWidth.value) || 8, 1, 24);
  const height = preset ? preset[1] : clamp(Number(dom.customHeight.value) || 10, 1, 24);
  const mesh = Number(dom.meshCount.value);
  return {
    width,
    height,
    mesh,
    threadType: dom.threadType.value,
    fitMode: dom.fitMode.value,
    maxColors: clamp(Number(dom.maxColors.value) || 28, 4, 64),
    cleanupThreshold: clamp(Number(dom.cleanupThreshold.value) || 0, 0, 30),
    dither: Boolean(dom.ditherToggle.checked),
    sizePreset: dom.sizePreset.value,
    detailLevel: dom.detailLevel.value
  };
}

function setSettings(settings) {
  if (!settings) return;
  dom.sizePreset.value = settings.sizePreset || "custom";
  dom.customWidth.value = String(settings.width || 8);
  dom.customHeight.value = String(settings.height || 10);
  dom.meshCount.value = String(settings.mesh || 14);
  dom.threadType.value = settings.threadType || "dmc";
  dom.fitMode.value = settings.fitMode || "crop";
  dom.detailLevel.value = settings.detailLevel || "portrait";
  dom.maxColors.value = String(settings.maxColors || DETAIL_COLORS[dom.detailLevel.value] || 28);
  dom.cleanupThreshold.value = String(settings.cleanupThreshold ?? 6);
  dom.ditherToggle.checked = Boolean(settings.dither);
  syncCustomSizeFields();
  syncOutputs();
}

async function loadImageFile(file) {
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    showToast("Upload a PNG, JPG, or WebP image.");
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  await setImageFromDataUrl(dataUrl, file.name.replace(/\.[^.]+$/, ""));
  queueGenerate(0);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function setImageFromDataUrl(dataUrl, name = "untitled") {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      state.imageDataUrl = dataUrl;
      state.imageName = name || "untitled";
      dom.sourcePreview.src = dataUrl;
      dom.sourcePreview.hidden = false;
      dom.emptyState.hidden = true;
      dom.canvasScroll.hidden = false;
      resolve();
    };
    image.onerror = () => reject(new Error("Image could not be decoded."));
    image.src = dataUrl;
  });
}

function queueGenerate(delay = 160) {
  updateStaticStats();
  if (!state.image) return;
  clearTimeout(state.generateTimer);
  state.generateTimer = setTimeout(generatePattern, delay);
}

function generatePattern() {
  if (!state.image || state.isGenerating) return;
  state.isGenerating = true;
  requestAnimationFrame(() => {
    try {
      state.pattern = createPatternDocument(state.image, getSettings());
      renderPatternPreview();
      renderSwatches();
      renderWarnings();
      updateStaticStats();
      updateExportButtons();
      saveProject(false);
      showToast("Pattern regenerated with improved photo mapping.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Pattern generation failed.");
    } finally {
      state.isGenerating = false;
    }
  });
}

function createPatternDocument(image, settings) {
  const stitchesWide = Math.max(1, Math.round(settings.width * settings.mesh));
  const stitchesHigh = Math.max(1, Math.round(settings.height * settings.mesh));
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = stitchesWide;
  baseCanvas.height = stitchesHigh;
  const ctx = baseCanvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, stitchesWide, stitchesHigh);
  if (settings.fitMode === "contain") {
    ctx.fillStyle = "#fffaf4";
    ctx.fillRect(0, 0, stitchesWide, stitchesHigh);
  }
  const draw = computeImageDrawRect(image, stitchesWide, stitchesHigh, settings.fitMode);
  ctx.drawImage(image, draw.sx, draw.sy, draw.sw, draw.sh, draw.dx, draw.dy, draw.dw, draw.dh);

  const imageData = ctx.getImageData(0, 0, stitchesWide, stitchesHigh);
  const histogram = buildHistogram(imageData, settings.dither);
  const centers = weightedKMeans(histogram.bins, settings.maxColors).map((center, index) => ({ ...center, index }));
  const palette = preparePalette(settings.threadType);
  const centerThreads = assignCentersToThreads(centers, palette.colors);
  const threadByKey = new Map();
  const cellsByThreadKey = new Array(stitchesWide * stitchesHigh).fill(null);

  for (let index = 0; index < cellsByThreadKey.length; index++) {
    const offset = index * 4;
    const alpha = imageData.data[offset + 3];
    if (alpha < 24) continue;
    const x = index % stitchesWide;
    const y = Math.floor(index / stitchesWide);
    const rgb = [imageData.data[offset], imageData.data[offset + 1], imageData.data[offset + 2]];
    const adjusted = settings.dither ? addDitherNoise(rgb, x, y) : rgb;
    const centerIndex = nearestCenter(adjusted, centers);
    const thread = centerThreads[centerIndex];
    if (!thread) continue;
    cellsByThreadKey[index] = thread.number;
    threadByKey.set(thread.number, thread);
  }

  let counts = countKeys(cellsByThreadKey);
  if (settings.cleanupThreshold > 0) {
    cleanupRareColors(cellsByThreadKey, counts, threadByKey, settings.cleanupThreshold);
    counts = countKeys(cellsByThreadKey);
  }

  const paletteEntries = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count], index) => {
      const thread = threadByKey.get(key);
      return { index, brand: palette.label, number: thread.number, name: thread.name, hex: thread.hex, rgb: thread.rgb, lab: thread.lab, stitchCount: count, symbol: SYMBOLS[index % SYMBOLS.length] };
    });

  const indexByKey = new Map(paletteEntries.map((entry) => [entry.number, entry.index]));
  const cells = new Uint16Array(stitchesWide * stitchesHigh);
  for (let i = 0; i < cells.length; i++) {
    const key = cellsByThreadKey[i];
    cells[i] = key ? indexByKey.get(key) ?? BLANK : BLANK;
  }

  const warnings = getPatternWarnings({ settings, stitchesWide, stitchesHigh, paletteEntries, cells, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, paletteNote: palette.note });
  return {
    version: 2,
    title: state.imageName || "sdneedle pattern",
    createdAt: new Date().toISOString(),
    canvas: { meshCount: settings.mesh, finishedWidthIn: settings.width, finishedHeightIn: settings.height, stitchesWide, stitchesHigh, totalStitches: stitchesWide * stitchesHigh },
    settings,
    sourceImage: { name: state.imageName, width: image.naturalWidth, height: image.naturalHeight, fitMode: settings.fitMode },
    threadLibrary: { id: palette.id, label: palette.label, note: palette.note },
    palette: paletteEntries,
    grid: { width: stitchesWide, height: stitchesHigh, cells },
    warnings
  };
}

function computeImageDrawRect(image, targetW, targetH, fitMode) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const sourceRatio = iw / ih;
  const targetRatio = targetW / targetH;
  if (fitMode === "contain") {
    const scale = Math.min(targetW / iw, targetH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    return { sx: 0, sy: 0, sw: iw, sh: ih, dx: (targetW - dw) / 2, dy: (targetH - dh) / 2, dw, dh };
  }
  if (sourceRatio > targetRatio) {
    const sw = ih * targetRatio;
    return { sx: (iw - sw) / 2, sy: 0, sw, sh: ih, dx: 0, dy: 0, dw: targetW, dh: targetH };
  }
  const sh = iw / targetRatio;
  return { sx: 0, sy: (ih - sh) / 2, sw: iw, sh, dx: 0, dy: 0, dw: targetW, dh: targetH };
}

function buildHistogram(imageData, dither) {
  const bins = new Map();
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 24) continue;
      const rgb = dither ? addDitherNoise([data[i], data[i + 1], data[i + 2]], x, y) : [data[i], data[i + 1], data[i + 2]];
      const key = `${rgb[0] >> 3},${rgb[1] >> 3},${rgb[2] >> 3}`;
      const bin = bins.get(key) || { count: 0, sum: [0, 0, 0], rgb: [0, 0, 0] };
      bin.count += 1;
      bin.sum[0] += rgb[0];
      bin.sum[1] += rgb[1];
      bin.sum[2] += rgb[2];
      bins.set(key, bin);
    }
  }
  return { bins: [...bins.values()].map((bin) => ({ count: bin.count, rgb: [bin.sum[0] / bin.count, bin.sum[1] / bin.count, bin.sum[2] / bin.count] })) };
}

function weightedKMeans(bins, maxColors) {
  if (!bins.length) return [{ rgb: [255, 250, 244], count: 1 }];
  const ordered = [...bins].sort((a, b) => b.count - a.count);
  const k = Math.min(maxColors, ordered.length);
  const centers = [ordered[0]];
  while (centers.length < k) {
    let best = ordered[centers.length % ordered.length];
    let bestScore = -Infinity;
    for (const bin of ordered) {
      const nearest = Math.min(...centers.map((center) => rgbDistance(bin.rgb, center.rgb)));
      const score = nearest * Math.sqrt(bin.count);
      if (score > bestScore) {
        best = bin;
        bestScore = score;
      }
    }
    centers.push({ rgb: [...best.rgb], count: best.count });
  }
  let current = centers.map((center) => ({ rgb: [...center.rgb], count: center.count }));
  for (let iteration = 0; iteration < 9; iteration++) {
    const sums = current.map(() => ({ count: 0, sum: [0, 0, 0] }));
    for (const bin of bins) {
      const nearest = nearestCenter(bin.rgb, current);
      const target = sums[nearest];
      target.count += bin.count;
      target.sum[0] += bin.rgb[0] * bin.count;
      target.sum[1] += bin.rgb[1] * bin.count;
      target.sum[2] += bin.rgb[2] * bin.count;
    }
    current = current.map((center, index) => {
      const sum = sums[index];
      if (!sum.count) return center;
      return { count: sum.count, rgb: [sum.sum[0] / sum.count, sum.sum[1] / sum.count, sum.sum[2] / sum.count] };
    });
  }
  return current;
}

function assignCentersToThreads(centers, colors) {
  const used = new Set();
  const assigned = [];
  const ordered = centers.map((center, index) => ({ ...center, lab: rgbToLab(center.rgb), index })).sort((a, b) => b.count - a.count);
  for (const center of ordered) {
    const ranked = colors.map((color) => ({ color, distance: labDistance(center.lab, color.lab) })).sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    const unused = ranked.find((item) => !used.has(item.color.number));
    let chosen = best.color;
    if (unused && (unused.distance <= best.distance * 5 + 180 || used.size < Math.ceil(centers.length * 0.82))) {
      chosen = unused.color;
    }
    assigned[center.index] = chosen;
    used.add(chosen.number);
  }
  return assigned;
}

function nearestCenter(rgb, centers) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const distance = rgbDistance(rgb, centers[i].rgb);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function preparePalette(threadType) {
  const palette = state.customPalette || getPalette(threadType);
  const colors = palette.colors.map((color) => {
    const rgb = hexToRgb(color.hex);
    return { ...color, rgb, lab: rgbToLab(rgb) };
  });
  return { ...palette, colors };
}

function cleanupRareColors(cells, counts, threadByKey, threshold) {
  const rareKeys = [...counts.entries()].filter(([, count]) => count > 0 && count < threshold).map(([key]) => key);
  if (!rareKeys.length) return;
  const rareSet = new Set(rareKeys);
  const majorKeys = [...counts.entries()].filter(([key, count]) => count >= threshold && !rareSet.has(key)).map(([key]) => key);
  if (!majorKeys.length) return;
  for (let i = 0; i < cells.length; i++) {
    const key = cells[i];
    if (!rareSet.has(key)) continue;
    const source = threadByKey.get(key);
    let bestKey = majorKeys[0];
    let bestDistance = Infinity;
    for (const candidateKey of majorKeys) {
      const candidate = threadByKey.get(candidateKey);
      const distance = labDistance(source.lab, candidate.lab);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKey = candidateKey;
      }
    }
    cells[i] = bestKey;
  }
}

function countKeys(cells) {
  const counts = new Map();
  for (const key of cells) {
    if (key === null || key === undefined) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function getPatternWarnings({ settings, stitchesWide, stitchesHigh, paletteEntries, cells, sourceWidth, sourceHeight, paletteNote }) {
  const warnings = [];
  const total = stitchesWide * stitchesHigh;
  const isolatedRatio = estimateIsolatedRatio(cells, stitchesWide, stitchesHigh);
  warnings.push({ severity: "info", message: "Clean PDF export is now generated directly, without browser URL/date headers." });
  warnings.push({ severity: "info", message: "Direct canvas PDF and PNG include 1 inch calibration and registration marks. Print at 100% scale." });
  if (paletteNote?.toLowerCase().includes("scaffold")) warnings.push({ severity: "warning", message: paletteNote });
  if (total > 50000) warnings.push({ severity: "warning", message: `${total.toLocaleString()} stitches is a large chart. Exports may take longer.` });
  if (paletteEntries.length < 16 && settings.detailLevel !== "simple") warnings.push({ severity: "warning", message: "The selected palette collapsed to a low color count. Increase detail or reduce cleanup for portraits." });
  if (paletteEntries.length > 42) warnings.push({ severity: "warning", message: `${paletteEntries.length} colors may create frequent thread changes.` });
  if (isolatedRatio > 0.14) warnings.push({ severity: "warning", message: "Many isolated stitches detected. Turn off dithering or reduce detail for easier stitching." });
  if (Math.min(stitchesWide, stitchesHigh) < 70 && Math.max(sourceWidth, sourceHeight) > 800) warnings.push({ severity: "warning", message: "Fine image detail will be compressed into a small stitch grid. Try a larger size or higher mesh count." });
  warnings.push({ severity: "info", message: `Stitch grid: ${stitchesWide} × ${stitchesHigh}; source image: ${sourceWidth} × ${sourceHeight}px; thread colors: ${paletteEntries.length}.` });
  return warnings;
}

function estimateIsolatedRatio(cells, width, height) {
  let checked = 0;
  let isolated = 0;
  const stride = Math.max(1, Math.floor((width * height) / 14000));
  for (let i = 0; i < cells.length; i += stride) {
    const value = cells[i];
    if (value === BLANK) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    checked++;
    const sameNeighbor = [y > 0 ? cells[i - width] : BLANK, y < height - 1 ? cells[i + width] : BLANK, x > 0 ? cells[i - 1] : BLANK, x < width - 1 ? cells[i + 1] : BLANK].some((neighbor) => neighbor === value);
    if (!sameNeighbor) isolated++;
  }
  return checked ? isolated / checked : 0;
}

function renderPatternPreview() {
  if (!state.pattern) return;
  dom.emptyState.hidden = true;
  dom.canvasScroll.hidden = false;
  drawPatternToCanvas(dom.patternCanvas, state.pattern, { cellSize: Number(dom.zoomRange.value), mode: dom.previewMode.value, labels: true, grid: true });
}

function drawPatternToCanvas(canvas, pattern, options = {}) {
  const { width, height, cells } = pattern.grid;
  const cell = options.cellSize || 10;
  const labels = options.labels ?? true;
  const mode = options.mode || "color-symbol";
  const margin = labels ? Math.max(34, Math.round(cell * 3.6)) : 0;
  const canvasWidth = margin + width * cell + 1;
  const canvasHeight = margin + height * cell + 1;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#fffaf4";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  const palette = pattern.palette;
  const symbolOnly = mode === "symbol";
  const colorOnly = mode === "color" || mode === "canvas-print";
  const showSymbols = !colorOnly && cell >= 7;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = cells[y * width + x];
      const px = margin + x * cell;
      const py = margin + y * cell;
      ctx.fillStyle = index === BLANK ? "#fffaf4" : symbolOnly ? "#ffffff" : palette[index]?.hex || "#ffffff";
      ctx.fillRect(px, py, cell, cell);
    }
  }
  if (options.grid !== false) drawGrid(ctx, width, height, cell, margin, mode === "canvas-print");
  if (showSymbols) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(7, Math.floor(cell * 0.58))}px Inter, Arial, sans-serif`;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = cells[y * width + x];
        if (index === BLANK) continue;
        const entry = palette[index];
        ctx.fillStyle = relativeLuminance(hexToRgb(entry.hex)) < 0.45 && !symbolOnly ? "rgba(255,255,255,0.88)" : "rgba(20,20,20,0.86)";
        ctx.fillText(entry.symbol, margin + x * cell + cell / 2, margin + y * cell + cell / 2 + 0.5);
      }
    }
  }
  if (labels) drawLabels(ctx, width, height, cell, margin);
}

function drawGrid(ctx, width, height, cell, margin, canvasPrintMode = false) {
  ctx.save();
  for (let x = 0; x <= width; x++) {
    ctx.beginPath();
    ctx.lineWidth = x % 10 === 0 ? 1.35 : 0.45;
    ctx.strokeStyle = x % 10 === 0 ? "rgba(38,31,26,0.58)" : canvasPrintMode ? "rgba(38,31,26,0.25)" : "rgba(38,31,26,0.18)";
    const px = margin + x * cell + 0.5;
    ctx.moveTo(px, margin);
    ctx.lineTo(px, margin + height * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.lineWidth = y % 10 === 0 ? 1.35 : 0.45;
    ctx.strokeStyle = y % 10 === 0 ? "rgba(38,31,26,0.58)" : canvasPrintMode ? "rgba(38,31,26,0.25)" : "rgba(38,31,26,0.18)";
    const py = margin + y * cell + 0.5;
    ctx.moveTo(margin, py);
    ctx.lineTo(margin + width * cell, py);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabels(ctx, width, height, cell, margin) {
  ctx.save();
  ctx.fillStyle = "#4b3b31";
  ctx.font = "10px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 0; x < width; x += 10) ctx.fillText(String(x + 1), margin + x * cell + cell / 2, margin / 2);
  ctx.textAlign = "right";
  for (let y = 0; y < height; y += 10) ctx.fillText(String(y + 1), margin - 7, margin + y * cell + cell / 2);
  ctx.restore();
}

function renderSwatches() {
  if (!state.pattern?.palette.length) return renderEmptyLegend();
  dom.swatchList.innerHTML = state.pattern.palette.map((entry) => `
    <article class="swatch-row">
      <span class="swatch-chip" style="background:${entry.hex}" aria-hidden="true"></span>
      <div><strong>${escapeHtml(entry.brand)} ${escapeHtml(entry.number)} — ${escapeHtml(entry.name)}</strong><small>${entry.hex.toUpperCase()} · ${entry.stitchCount.toLocaleString()} stitches</small></div>
      <span class="symbol-pill" aria-label="Symbol ${escapeHtml(entry.symbol)}">${escapeHtml(entry.symbol)}</span>
    </article>`).join("");
}

function renderEmptyLegend() {
  dom.swatchList.innerHTML = `<p class="muted">Thread matches will appear here after upload.</p>`;
}

function renderWarnings() {
  const warnings = state.pattern?.warnings || [{ severity: "info", message: "Choose an image to calculate stitchability." }];
  dom.warningsList.innerHTML = warnings.map((warning) => `<li><strong>${warning.severity === "warning" ? "Note" : "Info"}:</strong> ${escapeHtml(warning.message)}</li>`).join("");
}

function updateStaticStats() {
  const settings = getSettings();
  const stitchesWide = Math.round(settings.width * settings.mesh);
  const stitchesHigh = Math.round(settings.height * settings.mesh);
  dom.patternStats.innerHTML = `
    <div><dt>Size</dt><dd>${formatInches(settings.width)} × ${formatInches(settings.height)} in</dd></div>
    <div><dt>Grid</dt><dd>${stitchesWide} × ${stitchesHigh} stitches</dd></div>
    <div><dt>Total</dt><dd>${(stitchesWide * stitchesHigh).toLocaleString()} stitches</dd></div>
    <div><dt>Colors</dt><dd>${state.pattern ? state.pattern.palette.length : "Waiting for image"}</dd></div>`;
}

function updateExportButtons() {
  const disabled = !state.pattern;
  [dom.copyLegendButton, dom.printPatternButton, dom.printCanvasButton, dom.downloadChartPngButton, dom.downloadCanvasPngButton, dom.downloadSvgButton, dom.downloadStlButton, dom.saveProjectButton].forEach((button) => { button.disabled = disabled; });
}

function createChartCanvas(pattern, cellSize = 10, mode = "color-symbol") {
  const canvas = document.createElement("canvas");
  drawPatternToCanvas(canvas, pattern, { cellSize, mode, labels: true, grid: true });
  return canvas;
}

function createCanvasPrintCanvas(pattern, dpi = 300) {
  const { finishedWidthIn, finishedHeightIn, meshCount, stitchesWide, stitchesHigh } = pattern.canvas;
  const cell = dpi / meshCount;
  const margin = Math.round(dpi * 0.32);
  const labelBand = Math.round(dpi * 0.72);
  const widthPx = Math.round(finishedWidthIn * dpi) + margin * 2;
  const heightPx = Math.round(finishedHeightIn * dpi) + margin * 2 + labelBand;
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, widthPx, heightPx);
  const originX = margin;
  const originY = margin;
  for (let y = 0; y < stitchesHigh; y++) {
    for (let x = 0; x < stitchesWide; x++) {
      const index = pattern.grid.cells[y * stitchesWide + x];
      ctx.fillStyle = index === BLANK ? "#fffaf4" : pattern.palette[index]?.hex || "#ffffff";
      ctx.fillRect(Math.round(originX + x * cell), Math.round(originY + y * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
  drawPhysicalGrid(ctx, originX, originY, stitchesWide, stitchesHigh, cell, dpi);
  drawRegistrationMarks(ctx, originX, originY, finishedWidthIn * dpi, finishedHeightIn * dpi, dpi);
  ctx.fillStyle = "#111111";
  ctx.font = `${Math.round(dpi * 0.055)}px Arial, sans-serif`;
  ctx.fillText(`sdneedle.point direct canvas guide · ${formatInches(finishedWidthIn)} × ${formatInches(finishedHeightIn)} in · ${meshCount} mesh · print at 100%`, margin, heightPx - Math.round(dpi * 0.42));
  ctx.font = `${Math.round(dpi * 0.045)}px Arial, sans-serif`;
  ctx.fillText(`Calibration square below must measure exactly 1 in × 1 in. Test on paper before printing canvas.`, margin, heightPx - Math.round(dpi * 0.25));
  ctx.strokeStyle = "#111";
  ctx.lineWidth = Math.max(3, dpi / 100);
  ctx.strokeRect(widthPx - margin - dpi, heightPx - Math.round(dpi * 0.62), dpi, dpi);
  ctx.font = `${Math.round(dpi * 0.04)}px Arial, sans-serif`;
  ctx.fillText("1 inch", widthPx - margin - dpi, heightPx - Math.round(dpi * 0.66));
  return { canvas, dpi };
}

function drawPhysicalGrid(ctx, originX, originY, stitchesWide, stitchesHigh, cell, dpi) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= stitchesWide; x++) {
    const px = originX + x * cell;
    ctx.beginPath();
    ctx.moveTo(px, originY);
    ctx.lineTo(px, originY + stitchesHigh * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= stitchesHigh; y++) {
    const py = originY + y * cell;
    ctx.beginPath();
    ctx.moveTo(originX, py);
    ctx.lineTo(originX + stitchesWide * cell, py);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.72)";
  ctx.lineWidth = Math.max(1, dpi / 150);
  for (let x = 0; x <= stitchesWide; x += 10) {
    const px = originX + x * cell;
    ctx.beginPath();
    ctx.moveTo(px, originY);
    ctx.lineTo(px, originY + stitchesHigh * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= stitchesHigh; y += 10) {
    const py = originY + y * cell;
    ctx.beginPath();
    ctx.moveTo(originX, py);
    ctx.lineTo(originX + stitchesWide * cell, py);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRegistrationMarks(ctx, x, y, w, h, dpi) {
  const mark = Math.round(dpi * 0.16);
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  ctx.save();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = Math.max(2, dpi / 100);
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx - mark, cy);
    ctx.lineTo(cx + mark, cy);
    ctx.moveTo(cx, cy - mark);
    ctx.lineTo(cx, cy + mark);
    ctx.stroke();
  }
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

async function downloadChartPdf() {
  if (!state.pattern) return;
  showToast("Building clean chart PDF...");
  const sheets = [createChartPdfSheet(state.pattern), createLegendPdfSheet(state.pattern)];
  const pdf = await createPdfFromCanvases(sheets.map((canvas) => ({ canvas, pageWidthPt: 612, pageHeightPt: 792, marginPt: 0 })));
  downloadBlob(pdf, `${slugify(state.pattern.title)}-clean-chart.pdf`);
}

async function downloadCanvasPrintPdf() {
  if (!state.pattern) return;
  showToast("Building exact canvas PDF...");
  const { canvas, dpi } = createCanvasPrintCanvas(state.pattern, 300);
  const pdf = await createPdfFromCanvases([{ canvas, pageWidthPt: canvas.width / dpi * 72, pageHeightPt: canvas.height / dpi * 72, marginPt: 0 }]);
  downloadBlob(pdf, `${slugify(state.pattern.title)}-exact-canvas-guide.pdf`);
}

function createChartPdfSheet(pattern) {
  const sheet = document.createElement("canvas");
  sheet.width = 1700;
  sheet.height = 2200;
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = "#261f1a";
  ctx.font = "700 54px Arial, sans-serif";
  ctx.fillText(`${pattern.title} chart`, 90, 95);
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText(`${formatInches(pattern.canvas.finishedWidthIn)} × ${formatInches(pattern.canvas.finishedHeightIn)} in · ${pattern.canvas.meshCount} mesh · ${pattern.grid.width} × ${pattern.grid.height} stitches · ${pattern.threadLibrary.label}`, 90, 140);
  const availableW = sheet.width - 180;
  const availableH = sheet.height - 260;
  const cell = Math.max(3, Math.floor(Math.min((availableW - 60) / pattern.grid.width, (availableH - 60) / pattern.grid.height)));
  const chart = createChartCanvas(pattern, cell, "color-symbol");
  const x = Math.round((sheet.width - chart.width) / 2);
  ctx.drawImage(chart, x, 180);
  return sheet;
}

function createLegendPdfSheet(pattern) {
  const sheet = document.createElement("canvas");
  sheet.width = 1700;
  sheet.height = 2200;
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = "#261f1a";
  ctx.font = "700 56px Arial, sans-serif";
  ctx.fillText("Thread legend", 90, 100);
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText(`${pattern.palette.length} colors · ${pattern.threadLibrary.label}`, 90, 145);
  const colW = 760;
  const rowH = 82;
  pattern.palette.forEach((entry, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 90 + col * colW;
    const y = 220 + row * rowH;
    ctx.fillStyle = entry.hex;
    ctx.fillRect(x, y, 54, 54);
    ctx.strokeStyle = "#222";
    ctx.strokeRect(x, y, 54, 54);
    ctx.fillStyle = "#111";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText(`${entry.symbol} ${entry.brand} ${entry.number}`, x + 74, y + 22);
    ctx.font = "24px Arial, sans-serif";
    ctx.fillText(`${entry.name} · ${entry.hex.toUpperCase()} · ${entry.stitchCount.toLocaleString()} stitches`, x + 74, y + 53);
  });
  return sheet;
}

async function createPdfFromCanvases(pages) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let offset = 0;
  const add = (part) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const obj = (number, parts) => {
    offsets[number] = offset;
    add(`${number} 0 obj\n`);
    parts.forEach(add);
    add(`\nendobj\n`);
  };
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageObjects = [];
  const prepared = [];
  for (const page of pages) prepared.push({ ...page, image: await canvasToJpegBytes(page.canvas, 0.92) });
  const totalObjects = 2 + prepared.length * 3;
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  prepared.forEach((page, index) => pageObjects.push(3 + index * 3));
  obj(2, [`<< /Type /Pages /Kids [${pageObjects.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`]);
  prepared.forEach((page, index) => {
    const pageObj = 3 + index * 3;
    const contentObj = pageObj + 1;
    const imageObj = pageObj + 2;
    const pageW = page.pageWidthPt || 612;
    const pageH = page.pageHeightPt || 792;
    const margin = page.marginPt ?? 0;
    const fit = fitBox(page.image.width, page.image.height, pageW - margin * 2, pageH - margin * 2);
    const x = margin + (pageW - margin * 2 - fit.width) / 2;
    const y = margin + (pageH - margin * 2 - fit.height) / 2;
    const content = `q\n${fit.width.toFixed(2)} 0 0 ${fit.height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im${index + 1} Do\nQ`;
    obj(pageObj, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im${index + 1} ${imageObj} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentObj} 0 R >>`]);
    obj(contentObj, [`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`]);
    obj(imageObj, [`<< /Type /XObject /Subtype /Image /Width ${page.image.width} /Height ${page.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.image.bytes.length} >>\nstream\n`, page.image.bytes, "\nendstream"]);
  });
  const xrefOffset = offset;
  add(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= totalObjects; i++) add(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  add(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

function canvasToJpegBytes(canvas, quality) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, copy.width, copy.height);
  ctx.drawImage(canvas, 0, 0);
  const base64 = copy.toDataURL("image/jpeg", quality).split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Promise.resolve({ bytes, width: copy.width, height: copy.height });
}

function fitBox(srcW, srcH, maxW, maxH) {
  const ratio = Math.min(maxW / srcW, maxH / srcH);
  return { width: srcW * ratio, height: srcH * ratio };
}

function downloadChartPng() {
  if (!state.pattern) return;
  const total = state.pattern.canvas.totalStitches;
  const cellSize = total > 45000 ? 8 : 12;
  downloadCanvas(createChartCanvas(state.pattern, cellSize, "color-symbol"), `${slugify(state.pattern.title)}-chart.png`);
}

function downloadCanvasPrintPng() {
  if (!state.pattern) return;
  const { canvas } = createCanvasPrintCanvas(state.pattern, 300);
  downloadCanvas(canvas, `${slugify(state.pattern.title)}-canvas-print-300dpi.png`);
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => { if (blob) downloadBlob(blob, filename); }, "image/png");
}

function downloadSvg() {
  if (!state.pattern) return;
  downloadBlob(new Blob([createPatternSvg(state.pattern)], { type: "image/svg+xml" }), `${slugify(state.pattern.title)}-layered.svg`);
}

function createPatternSvg(pattern) {
  const { width, height, cells } = pattern.grid;
  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${pattern.canvas.finishedWidthIn}in" height="${pattern.canvas.finishedHeightIn}in" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(pattern.title)} needlepoint pattern">`);
  parts.push(`<title>${escapeHtml(pattern.title)} needlepoint pattern</title>`);
  parts.push(`<desc>${width} by ${height} stitches, ${pattern.canvas.meshCount} mesh, ${pattern.threadLibrary.label}</desc>`);
  parts.push(`<g id="color-cells">`);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = cells[y * width + x];
    if (index !== BLANK) parts.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${pattern.palette[index].hex}" data-thread="${escapeAttribute(pattern.palette[index].number)}"/>`);
  }
  parts.push(`</g><g id="grid-minor" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="0.025">`);
  for (let x = 0; x <= width; x++) parts.push(`<path d="M${x} 0V${height}"/>`);
  for (let y = 0; y <= height; y++) parts.push(`<path d="M0 ${y}H${width}"/>`);
  parts.push(`</g><g id="grid-major" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="0.05">`);
  for (let x = 0; x <= width; x += 10) parts.push(`<path d="M${x} 0V${height}"/>`);
  for (let y = 0; y <= height; y += 10) parts.push(`<path d="M0 ${y}H${width}"/>`);
  parts.push(`</g><g id="symbols" font-family="Arial, sans-serif" font-size="0.62" text-anchor="middle" dominant-baseline="central" fill="#111">`);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = cells[y * width + x];
    if (index !== BLANK) parts.push(`<text x="${x + 0.5}" y="${y + 0.52}">${escapeHtml(pattern.palette[index].symbol)}</text>`);
  }
  parts.push(`</g><g id="registration" fill="none" stroke="#000" stroke-width="0.08"><path d="M0 0H${width}V${height}H0Z"/></g></svg>`);
  return parts.join("\n");
}

function downloadStl() {
  if (!state.pattern) return;
  downloadBlob(new Blob([createGridStl(state.pattern)], { type: "model/stl" }), `${slugify(state.pattern.title)}-grid-stencil.stl`);
}

function createGridStl(pattern) {
  const { stitchesWide, stitchesHigh, meshCount } = pattern.canvas;
  const cellMm = 25.4 / meshCount;
  const widthMm = stitchesWide * cellMm;
  const heightMm = stitchesHigh * cellMm;
  const bar = Math.max(0.42, cellMm * 0.20);
  const z = 1.05;
  const facets = ["solid sdneedle_point_grid_stencil"];
  addCuboid(facets, -bar, -bar, 0, widthMm + bar * 2, bar * 2, z);
  addCuboid(facets, -bar, heightMm - bar, 0, widthMm + bar * 2, bar * 2, z);
  addCuboid(facets, -bar, -bar, 0, bar * 2, heightMm + bar * 2, z);
  addCuboid(facets, widthMm - bar, -bar, 0, bar * 2, heightMm + bar * 2, z);
  for (let x = 0; x <= stitchesWide; x++) addCuboid(facets, x * cellMm - bar / 2, 0, 0, bar, heightMm, z);
  for (let y = 0; y <= stitchesHigh; y++) addCuboid(facets, 0, y * cellMm - bar / 2, 0, widthMm, bar, z);
  facets.push("endsolid sdneedle_point_grid_stencil");
  return facets.join("\n");
}

function addCuboid(out, x, y, z, w, d, h) {
  const p = [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z], [x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]];
  [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]].forEach((face) => {
    addFacet(out, p[face[0]], p[face[1]], p[face[2]]);
    addFacet(out, p[face[0]], p[face[2]], p[face[3]]);
  });
}

function addFacet(out, a, b, c) {
  const normal = triangleNormal(a, b, c);
  out.push(`facet normal ${normal[0].toFixed(6)} ${normal[1].toFixed(6)} ${normal[2].toFixed(6)}`);
  out.push("  outer loop");
  [a, b, c].forEach((point) => out.push(`    vertex ${point[0].toFixed(4)} ${point[1].toFixed(4)} ${point[2].toFixed(4)}`));
  out.push("  endloop");
  out.push("endfacet");
}

function triangleNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / length, n[1] / length, n[2] / length];
}

async function copyLegend() {
  if (!state.pattern) return;
  const text = state.pattern.palette.map((entry) => `${entry.symbol}\t${entry.brand} ${entry.number}\t${entry.name}\t${entry.hex}\t${entry.stitchCount} stitches`).join("\n");
  await navigator.clipboard.writeText(text);
  showToast("Legend copied.");
}

async function importPaletteCsv(file) {
  const text = await file.text();
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(parseCsvLine).filter((row) => row.length >= 3);
  const withoutHeader = rows[0]?.join(",").toLowerCase().includes("hex") ? rows.slice(1) : rows;
  const palette = normalizePalette(withoutHeader, "custom", file.name.replace(/\.csv$/i, ""));
  if (palette.colors.length < 2) return showToast("Palette CSV needs at least two valid colors.");
  state.customPalette = palette;
  showToast(`Imported ${palette.colors.length} custom colors.`);
  queueGenerate(0);
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

async function saveProject(manual) {
  const payload = { settings: getSettings(), imageDataUrl: state.imageDataUrl, imageName: state.imageName, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    if (manual) showToast("Project saved locally in this browser.");
  } catch {
    if (manual) showToast("Local save failed. Try a smaller image.");
  }
}

async function loadSavedProject() {
  try {
    const payload = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!payload) return showToast("No saved project found in this browser.");
    setSettings(payload.settings);
    if (payload.imageDataUrl) await setImageFromDataUrl(payload.imageDataUrl, payload.imageName || "saved-pattern");
    queueGenerate(0);
    showToast("Saved project loaded.");
  } catch (error) {
    console.error(error);
    showToast("Could not load saved project.");
  }
}

function resetProject() {
  state.image = null;
  state.imageDataUrl = "";
  state.imageName = "untitled";
  state.pattern = null;
  state.customPalette = null;
  dom.imageInput.value = "";
  dom.paletteUpload.value = "";
  dom.sourcePreview.hidden = true;
  dom.sourcePreview.removeAttribute("src");
  dom.emptyState.hidden = false;
  dom.canvasScroll.hidden = true;
  dom.patternCanvas.getContext("2d")?.clearRect(0, 0, dom.patternCanvas.width, dom.patternCanvas.height);
  renderEmptyLegend();
  renderWarnings();
  updateStaticStats();
  updateExportButtons();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rgbDistance(a, b) { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return dr * dr + dg * dg + db * db; }
function labDistance(a, b) { const dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2]; return dl * dl + da * da + db * db; }
function hexToRgb(hex) { const value = hex.replace("#", ""); return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]; }
function rgbToLab(rgb) {
  let [r, g, b] = rgb.map((value) => value / 255);
  [r, g, b] = [r, g, b].map((value) => value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const [fx, fy, fz] = [x, y, z].map((value) => value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + 16 / 116);
  return [(116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function addDitherNoise(rgb, x, y) { const noise = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 18 - 9; return rgb.map((value) => clamp(Math.round(value + noise), 0, 255)); }
function formatInches(value) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function slugify(value) { return String(value || "sdneedle-pattern").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sdneedle-pattern"; }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function escapeAttribute(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.style.cssText = "position:fixed;left:50%;bottom:1.2rem;transform:translateX(-50%);background:#261f1a;color:#fffaf4;border-radius:999px;padding:.78rem 1rem;box-shadow:0 14px 44px rgba(0,0,0,.24);font-weight:750;z-index:1000;max-width:min(92vw,720px);text-align:center";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.remove(), 2600);
}
