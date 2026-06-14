import { getPalette, normalizePalette } from "./palettes.js";

const BLANK = 65535;
const SAVE_KEY = "sdneedle.point.autosave.v1";
const SYMBOLS = "●▲■◆✚✦✿○△□◇+×/\\|—ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
const SIZE_PRESETS = {
  "5x7": [5, 7],
  "8x10": [8, 10],
  "9x12": [9, 12],
  "11x14": [11, 14]
};
const DETAIL_COLORS = {
  simple: 12,
  balanced: 24,
  detailed: 36,
  max: 48
};

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

const state = {
  image: null,
  imageDataUrl: "",
  imageName: "untitled",
  customPalette: null,
  pattern: null,
  generateTimer: null,
  isGenerating: false
};

init();

function init() {
  bindEvents();
  syncDetailSlider();
  updateStaticStats();
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

  const settingInputs = [
    dom.sizePreset,
    dom.customWidth,
    dom.customHeight,
    dom.meshCount,
    dom.threadType,
    dom.fitMode,
    dom.maxColors,
    dom.cleanupThreshold,
    dom.ditherToggle
  ];

  settingInputs.forEach((input) => input.addEventListener("input", () => {
    if (input === dom.sizePreset) syncCustomSizeFields();
    syncOutputs();
    queueGenerate();
  }));

  dom.detailLevel.addEventListener("input", () => {
    syncDetailSlider();
    syncOutputs();
    queueGenerate();
  });

  dom.previewMode.addEventListener("input", renderPatternPreview);
  dom.zoomRange.addEventListener("input", renderPatternPreview);

  dom.copyLegendButton.addEventListener("click", copyLegend);
  dom.printPatternButton.addEventListener("click", () => printPattern("chart"));
  dom.printCanvasButton.addEventListener("click", () => printPattern("canvas"));
  dom.downloadChartPngButton.addEventListener("click", downloadChartPng);
  dom.downloadCanvasPngButton.addEventListener("click", downloadCanvasPrintPng);
  dom.downloadSvgButton.addEventListener("click", downloadSvg);
  dom.downloadStlButton.addEventListener("click", downloadStl);
  dom.saveProjectButton.addEventListener("click", () => saveProject(true));
  dom.loadSavedButton.addEventListener("click", loadSavedProject);
  dom.resetButton.addEventListener("click", resetProject);
}

function syncDetailSlider() {
  const value = DETAIL_COLORS[dom.detailLevel.value] ?? 24;
  dom.maxColors.value = String(value);
  syncOutputs();
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
    maxColors: clamp(Number(dom.maxColors.value) || 24, 4, 64),
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
  dom.detailLevel.value = settings.detailLevel || "balanced";
  dom.maxColors.value = String(settings.maxColors || 24);
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

function queueGenerate(delay = 180) {
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
      updatePatternStats();
      updateExportButtons();
      saveProject(false);
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
  ctx.fillStyle = "rgba(255, 250, 244, 0)";
  ctx.clearRect(0, 0, stitchesWide, stitchesHigh);

  const draw = computeImageDrawRect(image, stitchesWide, stitchesHigh, settings.fitMode);
  if (settings.fitMode === "contain") {
    ctx.fillStyle = "#fffaf4";
    ctx.fillRect(0, 0, stitchesWide, stitchesHigh);
  }
  ctx.drawImage(image, draw.sx, draw.sy, draw.sw, draw.sh, draw.dx, draw.dy, draw.dw, draw.dh);

  const imageData = ctx.getImageData(0, 0, stitchesWide, stitchesHigh);
  const histogram = buildHistogram(imageData, settings.dither);
  const centers = weightedKMeans(histogram.bins, settings.maxColors);
  const palette = preparePalette(settings.threadType);
  const centerThreads = centers.map((center) => nearestThread(center.rgb, palette.colors));
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
    const key = thread.number;
    cellsByThreadKey[index] = key;
    threadByKey.set(key, thread);
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
      return {
        index,
        brand: palette.label,
        number: thread.number,
        name: thread.name,
        hex: thread.hex,
        rgb: thread.rgb,
        lab: thread.lab,
        stitchCount: count,
        symbol: SYMBOLS[index % SYMBOLS.length]
      };
    });

  const indexByKey = new Map(paletteEntries.map((entry) => [entry.number, entry.index]));
  const cells = new Uint16Array(stitchesWide * stitchesHigh);
  for (let i = 0; i < cells.length; i++) {
    const key = cellsByThreadKey[i];
    cells[i] = key ? indexByKey.get(key) ?? BLANK : BLANK;
  }

  const warnings = getPatternWarnings({
    settings,
    stitchesWide,
    stitchesHigh,
    paletteEntries,
    cells,
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
    paletteNote: palette.note
  });

  return {
    version: 1,
    title: state.imageName || "sdneedle pattern",
    createdAt: new Date().toISOString(),
    canvas: {
      meshCount: settings.mesh,
      finishedWidthIn: settings.width,
      finishedHeightIn: settings.height,
      stitchesWide,
      stitchesHigh,
      totalStitches: stitchesWide * stitchesHigh
    },
    settings,
    sourceImage: {
      name: state.imageName,
      width: image.naturalWidth,
      height: image.naturalHeight,
      fitMode: settings.fitMode
    },
    threadLibrary: {
      id: palette.id,
      label: palette.label,
      note: palette.note
    },
    palette: paletteEntries,
    grid: {
      width: stitchesWide,
      height: stitchesHigh,
      cells
    },
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

  const normalizedBins = [...bins.values()].map((bin) => ({
    count: bin.count,
    rgb: [bin.sum[0] / bin.count, bin.sum[1] / bin.count, bin.sum[2] / bin.count]
  }));

  return { bins: normalizedBins };
}

function weightedKMeans(bins, maxColors) {
  if (!bins.length) return [{ rgb: [255, 250, 244], count: 1 }];
  const ordered = [...bins].sort((a, b) => b.count - a.count);
  const k = Math.min(maxColors, ordered.length);
  let centers = ordered.slice(0, k).map((bin) => ({ rgb: [...bin.rgb], count: bin.count }));

  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = centers.map(() => ({ count: 0, sum: [0, 0, 0] }));
    for (const bin of bins) {
      const nearest = nearestCenter(bin.rgb, centers);
      const target = sums[nearest];
      target.count += bin.count;
      target.sum[0] += bin.rgb[0] * bin.count;
      target.sum[1] += bin.rgb[1] * bin.count;
      target.sum[2] += bin.rgb[2] * bin.count;
    }
    centers = centers.map((center, index) => {
      const sum = sums[index];
      if (!sum.count) return center;
      return {
        count: sum.count,
        rgb: [sum.sum[0] / sum.count, sum.sum[1] / sum.count, sum.sum[2] / sum.count]
      };
    });
  }

  return centers;
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
    return {
      ...color,
      rgb,
      lab: rgbToLab(rgb)
    };
  });
  return { ...palette, colors };
}

function nearestThread(rgb, colors) {
  const lab = rgbToLab(rgb);
  let best = colors[0];
  let bestDistance = Infinity;
  for (const color of colors) {
    const distance = labDistance(lab, color.lab);
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }
  return best;
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
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function getPatternWarnings({ settings, stitchesWide, stitchesHigh, paletteEntries, cells, sourceWidth, sourceHeight, paletteNote }) {
  const warnings = [];
  const total = stitchesWide * stitchesHigh;
  const rareCount = paletteEntries.filter((entry) => entry.stitchCount < Math.max(8, settings.cleanupThreshold)).length;
  const isolatedRatio = estimateIsolatedRatio(cells, stitchesWide, stitchesHigh);

  warnings.push({ severity: "info", message: `Direct canvas printing is enabled. Print at 100% scale and test alignment on paper first.` });

  if (paletteNote?.toLowerCase().includes("scaffold")) {
    warnings.push({ severity: "warning", message: paletteNote });
  }

  if (total > 50000) {
    warnings.push({ severity: "warning", message: `${total.toLocaleString()} stitches is a large chart. Exports may take longer and the piece will be a long-term project.` });
  }

  if (paletteEntries.length > 36) {
    warnings.push({ severity: "warning", message: `${paletteEntries.length} colors may create frequent thread changes. Consider Balanced or Simple detail.` });
  } else {
    warnings.push({ severity: "info", message: `${paletteEntries.length} mapped thread colors is manageable for most printed charts.` });
  }

  if (rareCount > 0) {
    warnings.push({ severity: "warning", message: `${rareCount} colors appear only a few times. Use cleanup or merge them manually after export.` });
  }

  if (isolatedRatio > 0.14) {
    warnings.push({ severity: "warning", message: `The pattern has many isolated stitches. Turn off dithering or reduce detail for easier stitching.` });
  }

  if (Math.min(stitchesWide, stitchesHigh) < 70 && Math.max(sourceWidth, sourceHeight) > 800) {
    warnings.push({ severity: "warning", message: `Fine image detail will be compressed into a small stitch grid. Try a larger size or higher mesh count.` });
  }

  warnings.push({ severity: "info", message: `Stitch grid: ${stitchesWide} × ${stitchesHigh}; source image: ${sourceWidth} × ${sourceHeight}px.` });
  return warnings;
}

function estimateIsolatedRatio(cells, width, height) {
  let checked = 0;
  let isolated = 0;
  const stride = Math.max(1, Math.floor((width * height) / 12000));
  for (let i = 0; i < cells.length; i += stride) {
    const value = cells[i];
    if (value === BLANK) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    checked++;
    const sameNeighbor = [
      y > 0 ? cells[i - width] : BLANK,
      y < height - 1 ? cells[i + width] : BLANK,
      x > 0 ? cells[i - 1] : BLANK,
      x < width - 1 ? cells[i + 1] : BLANK
    ].some((neighbor) => neighbor === value);
    if (!sameNeighbor) isolated++;
  }
  return checked ? isolated / checked : 0;
}

function renderPatternPreview() {
  if (!state.pattern) return;
  dom.emptyState.hidden = true;
  dom.canvasScroll.hidden = false;
  drawPatternToCanvas(dom.patternCanvas, state.pattern, {
    cellSize: Number(dom.zoomRange.value),
    mode: dom.previewMode.value,
    labels: true,
    grid: true
  });
}

function drawPatternToCanvas(canvas, pattern, options = {}) {
  const { width, height, cells } = pattern.grid;
  const cell = options.cellSize || 10;
  const labels = options.labels ?? true;
  const mode = options.mode || "color-symbol";
  const margin = labels ? 34 : 0;
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
  const showGrid = options.grid !== false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = cells[y * width + x];
      const px = margin + x * cell;
      const py = margin + y * cell;
      if (index === BLANK) {
        ctx.fillStyle = "#fffaf4";
      } else if (symbolOnly) {
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.fillStyle = palette[index]?.hex || "#ffffff";
      }
      ctx.fillRect(px, py, cell, cell);
    }
  }

  if (showGrid) drawGrid(ctx, width, height, cell, margin, mode === "canvas-print");

  if (showSymbols) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(7, Math.floor(cell * 0.58))}px Inter, Arial, sans-serif`;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = cells[y * width + x];
        if (index === BLANK) continue;
        const entry = palette[index];
        const rgb = hexToRgb(entry.hex);
        ctx.fillStyle = relativeLuminance(rgb) < 0.45 && !symbolOnly ? "rgba(255,255,255,0.88)" : "rgba(20,20,20,0.86)";
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
    ctx.lineWidth = x % 10 === 0 ? 1.25 : 0.45;
    ctx.strokeStyle = x % 10 === 0 ? "rgba(38,31,26,0.48)" : canvasPrintMode ? "rgba(38,31,26,0.24)" : "rgba(38,31,26,0.18)";
    const px = margin + x * cell + 0.5;
    ctx.moveTo(px, margin);
    ctx.lineTo(px, margin + height * cell);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.lineWidth = y % 10 === 0 ? 1.25 : 0.45;
    ctx.strokeStyle = y % 10 === 0 ? "rgba(38,31,26,0.48)" : canvasPrintMode ? "rgba(38,31,26,0.24)" : "rgba(38,31,26,0.18)";
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
  for (let x = 0; x < width; x += 10) {
    ctx.fillText(String(x + 1), margin + x * cell + cell / 2, margin / 2);
  }
  ctx.textAlign = "right";
  for (let y = 0; y < height; y += 10) {
    ctx.fillText(String(y + 1), margin - 7, margin + y * cell + cell / 2);
  }
  ctx.restore();
}

function renderSwatches() {
  if (!state.pattern?.palette.length) {
    renderEmptyLegend();
    return;
  }

  dom.swatchList.innerHTML = state.pattern.palette.map((entry) => `
    <article class="swatch-row">
      <span class="swatch-chip" style="background:${entry.hex}" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(entry.brand)} ${escapeHtml(entry.number)} — ${escapeHtml(entry.name)}</strong>
        <small>${entry.hex.toUpperCase()} · ${entry.stitchCount.toLocaleString()} stitches</small>
      </div>
      <span class="symbol-pill" aria-label="Symbol ${escapeHtml(entry.symbol)}">${escapeHtml(entry.symbol)}</span>
    </article>
  `).join("");
}

function renderEmptyLegend() {
  dom.swatchList.innerHTML = `<p class="muted">Thread matches will appear here after upload.</p>`;
}

function renderWarnings() {
  const warnings = state.pattern?.warnings || [{ severity: "info", message: "Choose an image to calculate stitchability." }];
  dom.warningsList.innerHTML = warnings.map((warning) => {
    const label = warning.severity === "warning" ? "Note" : "Info";
    return `<li><strong>${label}:</strong> ${escapeHtml(warning.message)}</li>`;
  }).join("");
}

function updateStaticStats() {
  const settings = getSettings();
  const stitchesWide = Math.round(settings.width * settings.mesh);
  const stitchesHigh = Math.round(settings.height * settings.mesh);
  dom.patternStats.innerHTML = `
    <div><dt>Size</dt><dd>${formatInches(settings.width)} × ${formatInches(settings.height)} in</dd></div>
    <div><dt>Grid</dt><dd>${stitchesWide} × ${stitchesHigh} stitches</dd></div>
    <div><dt>Total</dt><dd>${(stitchesWide * stitchesHigh).toLocaleString()} stitches</dd></div>
    <div><dt>Colors</dt><dd>${state.pattern ? state.pattern.palette.length : "Waiting for image"}</dd></div>
  `;
}

function updatePatternStats() {
  updateStaticStats();
}

function updateExportButtons() {
  const disabled = !state.pattern;
  [
    dom.copyLegendButton,
    dom.printPatternButton,
    dom.printCanvasButton,
    dom.downloadChartPngButton,
    dom.downloadCanvasPngButton,
    dom.downloadSvgButton,
    dom.downloadStlButton,
    dom.saveProjectButton
  ].forEach((button) => { button.disabled = disabled; });
}

function createChartCanvas(pattern, cellSize = 12, mode = "color-symbol") {
  const canvas = document.createElement("canvas");
  drawPatternToCanvas(canvas, pattern, { cellSize, mode, labels: true, grid: true });
  return canvas;
}

function createCanvasPrintCanvas(pattern, dpi = 300) {
  const { finishedWidthIn, finishedHeightIn, meshCount, stitchesWide, stitchesHigh } = pattern.canvas;
  const cell = dpi / meshCount;
  const margin = Math.round(dpi * 0.25);
  const labelBand = Math.round(dpi * 0.38);
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

  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.30)";
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
  ctx.strokeStyle = "rgba(0,0,0,0.68)";
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

  drawRegistrationMarks(ctx, originX, originY, finishedWidthIn * dpi, finishedHeightIn * dpi, dpi);
  ctx.fillStyle = "#111111";
  ctx.font = `${Math.round(dpi * 0.045)}px Arial, sans-serif`;
  ctx.fillText(`sdneedle.point direct canvas guide · ${formatInches(finishedWidthIn)} × ${formatInches(finishedHeightIn)} in · ${meshCount} mesh · print at 100%`, margin, heightPx - Math.round(dpi * 0.22));
  ctx.fillText(`Calibration square: 1 in × 1 in. Test on paper before printing canvas.`, margin, heightPx - Math.round(dpi * 0.1));
  return { canvas, dpi };
}

function drawRegistrationMarks(ctx, x, y, w, h, dpi) {
  const mark = Math.round(dpi * 0.12);
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  ctx.save();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = Math.max(2, dpi / 120);
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx - mark, cy);
    ctx.lineTo(cx + mark, cy);
    ctx.moveTo(cx, cy - mark);
    ctx.lineTo(cx, cy + mark);
    ctx.stroke();
  }
  ctx.strokeRect(x, y + h + Math.round(dpi * 0.07), dpi, dpi);
  ctx.restore();
}

function downloadChartPng() {
  if (!state.pattern) return;
  const total = state.pattern.canvas.totalStitches;
  const cellSize = total > 45000 ? 8 : 12;
  const canvas = createChartCanvas(state.pattern, cellSize, "color-symbol");
  downloadCanvas(canvas, `${slugify(state.pattern.title)}-chart.png`);
}

function downloadCanvasPrintPng() {
  if (!state.pattern) return;
  const { canvas } = createCanvasPrintCanvas(state.pattern, 300);
  downloadCanvas(canvas, `${slugify(state.pattern.title)}-canvas-print-300dpi.png`);
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, filename);
  }, "image/png");
}

function downloadSvg() {
  if (!state.pattern) return;
  const svg = createPatternSvg(state.pattern);
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${slugify(state.pattern.title)}-layered.svg`);
}

function createPatternSvg(pattern) {
  const { width, height, cells } = pattern.grid;
  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${pattern.canvas.finishedWidthIn}in" height="${pattern.canvas.finishedHeightIn}in" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(pattern.title)} needlepoint pattern">`);
  parts.push(`<title>${escapeHtml(pattern.title)} needlepoint pattern</title>`);
  parts.push(`<desc>${width} by ${height} stitches, ${pattern.canvas.meshCount} mesh, ${pattern.threadLibrary.label}</desc>`);
  parts.push(`<g id="color-cells">`);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = cells[y * width + x];
      if (index === BLANK) continue;
      parts.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${pattern.palette[index].hex}" data-thread="${escapeAttribute(pattern.palette[index].number)}"/>`);
    }
  }
  parts.push(`</g>`);
  parts.push(`<g id="grid-minor" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="0.025">`);
  for (let x = 0; x <= width; x++) parts.push(`<path d="M${x} 0V${height}"/>`);
  for (let y = 0; y <= height; y++) parts.push(`<path d="M0 ${y}H${width}"/>`);
  parts.push(`</g>`);
  parts.push(`<g id="grid-major" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="0.05">`);
  for (let x = 0; x <= width; x += 10) parts.push(`<path d="M${x} 0V${height}"/>`);
  for (let y = 0; y <= height; y += 10) parts.push(`<path d="M0 ${y}H${width}"/>`);
  parts.push(`</g>`);
  parts.push(`<g id="symbols" font-family="Arial, sans-serif" font-size="0.62" text-anchor="middle" dominant-baseline="central" fill="#111">`);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = cells[y * width + x];
      if (index === BLANK) continue;
      parts.push(`<text x="${x + 0.5}" y="${y + 0.52}">${escapeHtml(pattern.palette[index].symbol)}</text>`);
    }
  }
  parts.push(`</g>`);
  parts.push(`<g id="legend" transform="translate(0 ${height + 2})">`);
  pattern.palette.forEach((entry, index) => {
    const y = index * 1.4;
    parts.push(`<rect x="0" y="${y}" width="1" height="1" fill="${entry.hex}"/>`);
    parts.push(`<text x="1.4" y="${y + 0.78}" font-family="Arial" font-size="0.75">${escapeHtml(`${entry.symbol} ${entry.brand} ${entry.number} — ${entry.name} (${entry.stitchCount})`)}</text>`);
  });
  parts.push(`</g>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

function downloadStl() {
  if (!state.pattern) return;
  const stl = createGridStl(state.pattern);
  downloadBlob(new Blob([stl], { type: "model/stl" }), `${slugify(state.pattern.title)}-grid-stencil.stl`);
}

function createGridStl(pattern) {
  const { stitchesWide, stitchesHigh, meshCount } = pattern.canvas;
  const cellMm = 25.4 / meshCount;
  const widthMm = stitchesWide * cellMm;
  const heightMm = stitchesHigh * cellMm;
  const bar = Math.max(0.28, cellMm * 0.16);
  const z = 0.85;
  const facets = ["solid sdneedle_point_grid_stencil"];
  for (let x = 0; x <= stitchesWide; x++) {
    const cx = x * cellMm - bar / 2;
    addCuboid(facets, cx, 0, 0, bar, heightMm, z);
  }
  for (let y = 0; y <= stitchesHigh; y++) {
    const cy = y * cellMm - bar / 2;
    addCuboid(facets, 0, cy, 0, widthMm, bar, z);
  }
  facets.push("endsolid sdneedle_point_grid_stencil");
  return facets.join("\n");
}

function addCuboid(out, x, y, z, w, d, h) {
  const p = [
    [x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z],
    [x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]
  ];
  const faces = [
    [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]
  ];
  faces.forEach((face) => {
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

function printPattern(kind) {
  if (!state.pattern) return;
  dom.printArea.innerHTML = "";
  const sheet = document.createElement("section");
  sheet.className = "print-sheet";
  const title = document.createElement("h1");
  title.textContent = kind === "canvas" ? "Direct canvas print guide" : `${state.pattern.title} chart`;
  sheet.appendChild(title);
  sheet.appendChild(createPrintMeta(state.pattern));

  if (kind === "canvas") {
    const { canvas, dpi } = createCanvasPrintCanvas(state.pattern, 300);
    const img = document.createElement("img");
    img.className = "canvas-print-image";
    img.src = canvas.toDataURL("image/png");
    img.alt = "Direct canvas print guide";
    img.style.width = `${canvas.width / dpi}in`;
    img.style.height = `${canvas.height / dpi}in`;
    sheet.appendChild(img);
  } else {
    const chartCanvas = createChartCanvas(state.pattern, state.pattern.canvas.totalStitches > 45000 ? 7 : 10, "color-symbol");
    const img = document.createElement("img");
    img.className = "print-image";
    img.src = chartCanvas.toDataURL("image/png");
    img.alt = "Printable needlepoint chart";
    sheet.appendChild(img);
    sheet.appendChild(createPrintLegend(state.pattern));
  }

  dom.printArea.appendChild(sheet);
  document.body.classList.add("printing");
  const after = () => {
    document.body.classList.remove("printing");
    dom.printArea.innerHTML = "";
    window.removeEventListener("afterprint", after);
  };
  window.addEventListener("afterprint", after);
  window.print();
}

function createPrintMeta(pattern) {
  const meta = document.createElement("div");
  meta.className = "print-meta";
  const rows = [
    ["Finished size", `${formatInches(pattern.canvas.finishedWidthIn)} × ${formatInches(pattern.canvas.finishedHeightIn)} in`],
    ["Mesh", `${pattern.canvas.meshCount} count`],
    ["Grid", `${pattern.canvas.stitchesWide} × ${pattern.canvas.stitchesHigh}`],
    ["Threads", pattern.threadLibrary.label]
  ];
  rows.forEach(([term, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<strong>${escapeHtml(term)}</strong><br>${escapeHtml(value)}`;
    meta.appendChild(item);
  });
  return meta;
}

function createPrintLegend(pattern) {
  const legend = document.createElement("div");
  legend.className = "print-legend";
  pattern.palette.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "print-legend-row";
    row.innerHTML = `<span class="print-chip" style="background:${entry.hex}"></span><span>${escapeHtml(entry.symbol)} ${escapeHtml(entry.brand)} ${escapeHtml(entry.number)} — ${escapeHtml(entry.name)} · ${entry.stitchCount}</span>`;
    legend.appendChild(row);
  });
  return legend;
}

async function copyLegend() {
  if (!state.pattern) return;
  const text = state.pattern.palette
    .map((entry) => `${entry.symbol}\t${entry.brand} ${entry.number}\t${entry.name}\t${entry.hex}\t${entry.stitchCount} stitches`)
    .join("\n");
  await navigator.clipboard.writeText(text);
  showToast("Legend copied.");
}

async function importPaletteCsv(file) {
  const text = await file.text();
  const rows = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine)
    .filter((row) => row.length >= 3);

  const withoutHeader = rows[0]?.join(",").toLowerCase().includes("hex") ? rows.slice(1) : rows;
  const palette = normalizePalette(withoutHeader, "custom", file.name.replace(/\.csv$/i, ""));
  if (palette.colors.length < 2) {
    showToast("Palette CSV needs at least two valid colors.");
    return;
  }
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
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function saveProject(manual) {
  const payload = {
    settings: getSettings(),
    imageDataUrl: state.imageDataUrl,
    imageName: state.imageName,
    savedAt: new Date().toISOString()
  };
  try {
    await saveToIndexedDb(payload);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...payload, imageDataUrl: payload.imageDataUrl.length < 4000000 ? payload.imageDataUrl : "" }));
    if (manual) showToast("Project saved locally in this browser.");
  } catch (error) {
    console.warn(error);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      if (manual) showToast("Project saved locally.");
    } catch {
      if (manual) showToast("Local save failed. Try a smaller image.");
    }
  }
}

async function loadSavedProject() {
  try {
    const indexed = await loadFromIndexedDb();
    const payload = indexed || JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!payload) {
      showToast("No saved project found in this browser.");
      return;
    }
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

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sdneedle.point", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDb(payload) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put({ id: "autosave", ...payload });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadFromIndexedDb() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const request = tx.objectStore("projects").get("autosave");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rgbDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function labDistance(a, b) {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function rgbToLab(rgb) {
  let [r, g, b] = rgb.map((value) => value / 255);
  [r, g, b] = [r, g, b].map((value) => value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const [fx, fy, fz] = [x, y, z].map((value) => value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + 16 / 116);
  return [(116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function addDitherNoise(rgb, x, y) {
  const noise = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 18 - 9;
  return rgb.map((value) => clamp(Math.round(value + noise), 0, 255));
}

function formatInches(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function slugify(value) {
  return String(value || "sdneedle-pattern").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sdneedle-pattern";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

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
  toast._timer = setTimeout(() => toast.remove(), 2800);
}
