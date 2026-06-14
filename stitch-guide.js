const TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs";
const COCO_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";

const guideDom = {
  sourcePreview: document.querySelector("#sourcePreview"),
  imageInput: document.querySelector("#imageInput"),
  sizePreset: document.querySelector("#sizePreset"),
  customWidth: document.querySelector("#customWidth"),
  customHeight: document.querySelector("#customHeight"),
  meshCount: document.querySelector("#meshCount"),
  fitMode: document.querySelector("#fitMode"),
  generate: document.querySelector("#generateStitchGuideButton"),
  downloadGuide: document.querySelector("#downloadStitchGuideButton"),
  downloadRender: document.querySelector("#downloadFinishedRenderButton"),
  output: document.querySelector("#stitchGuideOutput"),
  status: document.querySelector("#visionStatus"),
  renderCanvas: document.querySelector("#finishedRenderCanvas"),
  skill: document.querySelector("#stitchSkill"),
  texture: document.querySelector("#texturePreference"),
  notes: document.querySelector("#sceneNotes")
};

const SIZE_PRESETS = { "5x7": [5, 7], "8x10": [8, 10], "9x12": [9, 12], "11x14": [11, 14] };
let cocoModelPromise = null;
let lastGuide = null;

initStitchGuide();

function initStitchGuide() {
  if (!guideDom.generate) return;
  guideDom.generate.addEventListener("click", generateStitchGuide);
  guideDom.downloadGuide.addEventListener("click", downloadGuideText);
  guideDom.downloadRender.addEventListener("click", downloadFinishedRender);
  guideDom.status.textContent = "Upload an image, then generate an AI-assisted stitch guide. Manual notes can refine the result.";
}

async function generateStitchGuide() {
  const image = guideDom.sourcePreview;
  if (!image || image.hidden || !image.src) {
    setGuideStatus("Upload an image first.");
    return;
  }

  setGuideStatus("Analyzing image objects and color regions...");
  const manualTags = extractManualTags(guideDom.notes.value);
  const scene = analyzeSceneColors(image);
  const detections = await detectObjects(image);
  const guide = buildGuide({ detections, manualTags, scene, skill: guideDom.skill.value, texture: guideDom.texture.value });
  lastGuide = guide;
  renderGuide(guide);
  renderFinishedCanvas(image, guide);
  guideDom.downloadGuide.disabled = false;
  guideDom.downloadRender.disabled = false;
  setGuideStatus(`Guide ready. Detected ${detections.length} object hint${detections.length === 1 ? "" : "s"}; used ${manualTags.length} manual note${manualTags.length === 1 ? "" : "s"}.`);
}

async function detectObjects(image) {
  try {
    const model = await loadCocoModel();
    const predictions = await model.detect(image, 18, 0.38);
    return predictions
      .filter((item) => item.score >= 0.38)
      .map((item) => ({ label: item.class, score: item.score, bbox: item.bbox }));
  } catch (error) {
    console.warn("Object detection fallback:", error);
    setGuideStatus("Object model unavailable. Using image color analysis and manual scene notes instead.");
    return [];
  }
}

async function loadCocoModel() {
  if (window.cocoSsd) return window.cocoSsd.load({ base: "lite_mobilenet_v2" });
  if (!cocoModelPromise) {
    cocoModelPromise = (async () => {
      await loadScript(TFJS_URL);
      await loadScript(COCO_URL);
      if (!window.cocoSsd) throw new Error("COCO-SSD did not load.");
      return window.cocoSsd.load({ base: "lite_mobilenet_v2" });
    })();
  }
  return cocoModelPromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((script) => script.src === src);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      if (window.tf || window.cocoSsd) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function analyzeSceneColors(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = Math.max(1, Math.round(96 * image.naturalHeight / image.naturalWidth));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = { sky: 0, foliage: 0, skin: 0, dark: 0, white: 0, warm: 0, neutral: 0, red: 0, blue: 0 };
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 16) continue;
    total++;
    const { h, s, v } = rgbToHsv(r, g, b);
    if (v < 0.16) buckets.dark++;
    else if (s < 0.12 && v > 0.78) buckets.white++;
    else if (h > 185 && h < 225 && s > 0.16 && v > 0.45) buckets.sky++;
    else if (h > 80 && h < 155 && s > 0.18) buckets.foliage++;
    else if (h > 18 && h < 48 && s > 0.18 && v > 0.36) buckets.skin++;
    else if (h >= 350 || h < 12) buckets.red++;
    else if (h > 205 && h < 260) buckets.blue++;
    else if (h > 25 && h < 70 && s > 0.18) buckets.warm++;
    else buckets.neutral++;
  }
  const pct = Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, total ? value / total : 0]));
  return { buckets, pct };
}

function extractManualTags(text) {
  const lower = text.toLowerCase();
  const tagMap = {
    background: ["background", "sky", "wall", "large area"],
    state: ["state", "map", "maryland", "florida", "texas", "california"],
    flightPath: ["flight", "flight path", "route", "path", "line"],
    martini: ["martini", "cocktail"],
    tequila: ["tequila", "shot glass", "salt rim", "glass"],
    music: ["music", "note", "notes", "song"],
    rocket: ["rocket", "space", "spaceship"],
    books: ["book", "books", "library"],
    pills: ["pill", "pills", "medicine", "capsule"],
    flowers: ["flower", "flowers", "floral", "bouquet"],
    orangeTree: ["orange tree", "orange", "oranges", "tree"],
    crab: ["crab", "maryland crab"],
    person: ["person", "people", "portrait", "face", "skin", "hair"],
    pet: ["dog", "cat", "pet"],
    car: ["car", "vehicle", "truck"],
    water: ["water", "ocean", "lake", "river"],
    food: ["food", "pizza", "cake", "dessert"]
  };
  const tags = [];
  for (const [tag, words] of Object.entries(tagMap)) {
    if (words.some((word) => lower.includes(word))) tags.push(tag);
  }
  return tags;
}

function buildGuide({ detections, manualTags, scene, skill, texture }) {
  const cards = [];
  const detectedTags = new Set(detections.map((item) => mapDetectionToTag(item.label)).filter(Boolean));
  manualTags.forEach((tag) => detectedTags.add(tag));
  if (scene.pct.sky > 0.08) detectedTags.add("background");
  if (scene.pct.foliage > 0.07) detectedTags.add("foliage");
  if (scene.pct.skin > 0.05) detectedTags.add("person");
  if (scene.pct.dark > 0.12) detectedTags.add("darkArea");
  if (scene.pct.warm > 0.12) detectedTags.add("warmArea");
  if (!detectedTags.size) detectedTags.add("background");

  cards.push(makeCard("Overall approach", overallRecommendation(skill, texture)));
  for (const tag of detectedTags) cards.push(recommendForTag(tag, skill, texture));
  cards.push(makeCard("Outlining and finishing", outlineRecommendation(skill, texture)));
  cards.push(makeCard("Thread strategy", threadRecommendation(skill, texture)));
  return { cards: mergeCards(cards), detections, manualTags, scene, skill, texture, generatedAt: new Date().toISOString() };
}

function mapDetectionToTag(label) {
  const map = {
    person: "person",
    tie: "clothing",
    handbag: "clothing",
    backpack: "clothing",
    suitcase: "clothing",
    "wine glass": "glassware",
    cup: "glassware",
    bottle: "glassware",
    vase: "flowers",
    "potted plant": "foliage",
    book: "books",
    dog: "pet",
    cat: "pet",
    bird: "pet",
    car: "car",
    truck: "car",
    bus: "car",
    airplane: "flightPath",
    boat: "water",
    chair: "furniture",
    couch: "furniture",
    dining: "furniture",
    pizza: "food",
    cake: "food",
    donut: "food",
    apple: "food",
    orange: "orangeTree",
    "sports ball": "roundObject"
  };
  return map[label] || null;
}

function recommendForTag(tag, skill, texture) {
  const advanced = skill === "advanced";
  const confident = skill === "confident" || advanced;
  const highTexture = texture === "high";
  const map = {
    background: ["Background", advanced ? "Basketweave base with open darning or Diagonal Mosaic in quiet areas; keep large regions calm so the subject remains the focus." : "Basketweave. It is stable, low-distortion, and best for large background areas."],
    state: ["States / map shapes", "Basketweave for filled areas; backstitch around borders. For flag details, use small mosaic blocks or continental stripes."],
    flightPath: ["Flight path / route lines", "Backstitch or couching. Use metallic braid only as an accent so the line reads clearly."],
    martini: ["Martini glass", confident ? "Skip Tent or T-Stitch for transparent glass; Smyrna Cross or French knots for olives; backstitch for rim and stem." : "Light Tent Stitch for glass with backstitch rim and stem; tiny cross stitches for olives."],
    tequila: ["Tequila / cocktail glass", confident ? "Cashmere or Scotch stitches for ice; French-knot salt rim; backstitch the glass edge." : "Tent Stitch for glass, backstitch edge, and simple knots for salt."],
    music: ["Music notes", "Mosaic Stitch for filled notes; backstitch for stems and fine lines."],
    rocket: ["Rocket / metallic accents", "Basketweave body with Silk Lamé or Kreinik highlights; upright Gobelin for flame direction; backstitch outlines."],
    books: ["Books", "Basketweave covers with long-stitch or Gobelin book spines; backstitch shelf edges and title lines."],
    pills: ["Pills / capsules", "Upright Gobelin for capsule bodies; backstitch division line; Smyrna Cross for shine dots if textured."],
    flowers: ["Flowers", highTexture ? "French knots for centers, Lazy Daisy petals, Smyrna Cross accent flowers, and Basketweave leaves." : "Basketweave petals with French-knot centers and simple backstitched stems."],
    orangeTree: ["Orange tree", "Random Mosaic or diagonal Mosaic leaves; padded satin or Smyrna Cross oranges; backstitch branches."],
    crab: ["Maryland crab", "Mosaic Stitch for shell texture; backstitch claws; small flag-color blocks for Maryland detailing."],
    person: ["Faces / skin / portrait areas", advanced ? "Basketweave for skin with very subtle color changes; reserve decorative stitches for clothing and background so facial detail is not distorted." : "Basketweave for faces and skin. Avoid heavy texture over eyes, lips, and noses."],
    clothing: ["Clothing", confident ? "Basketweave base, Cashmere or Nobuko for fabric texture, and backstitch on seams." : "Basketweave or Continental, with backstitch seams."],
    darkArea: ["Dark clothing / shadows", "Basketweave in dark colors; add a second dark thread for shape changes so black areas do not become flat blobs."],
    warmArea: ["Warm wood / tan areas", "Diagonal Mosaic or Cashmere for wood/floor texture; basketweave if the area is visually busy."],
    foliage: ["Leaves / greenery", highTexture ? "Random Mosaic leaves with a few Smyrna Cross accents. Use at least three greens." : "Basketweave leaves with occasional Mosaic clusters."],
    pet: ["Fur / animals", confident ? "Random long stitch or encroaching Gobelin following fur direction; tent stitch for small facial details." : "Basketweave for the body and short backstitch fur lines."],
    car: ["Vehicles / hard edges", "Basketweave large panels, backstitch outlines, and long satin-like Gobelin highlights along edges."],
    water: ["Water", "Horizontal Parisian or Cashmere bands; use subtle blues and backstitch only for strong wave lines."],
    furniture: ["Furniture / interiors", "Basketweave for structure; Cashmere or Mosaic for upholstery texture; backstitch legs and edges."],
    food: ["Food objects", confident ? "Mosaic and Smyrna Cross for texture; French knots for seeds, toppings, or sparkle details." : "Basketweave base with small cross-stitch accents."],
    glassware: ["Glassware", "Skip Tent or light Tent Stitch for transparency; backstitch rim and reflection lines; Cashmere for ice."],
    roundObject: ["Round objects", "Basketweave fill with backstitch curve; Smyrna Cross highlight at the brightest point."]
  };
  const [title, body] = map[tag] || [titleCase(tag), "Basketweave base with backstitch outlines; add decorative stitches only where texture helps the subject." ];
  return makeCard(title, body);
}

function overallRecommendation(skill, texture) {
  if (skill === "beginner") return "Use Basketweave/Tent Stitch for most areas, then add backstitch only where outlines need clarity. This keeps the canvas stable and the project stitchable.";
  if (skill === "advanced") return "Use Basketweave for detailed focal points and decorative stitches only in low-detail areas. Separate texture by material: glass, leaves, fabric, metallics, and background.";
  return texture === "high" ? "Use Basketweave for faces and small details, Mosaic/Cashmere for texture blocks, French knots or Smyrna Cross for accents, and backstitch for linework." : "Use Basketweave as the base stitch and add a small number of texture stitches in background, clothing, and decorative objects.";
}

function outlineRecommendation(skill) {
  return skill === "beginner" ? "Use backstitch sparingly around important edges after the main stitching is complete." : "Use backstitch, couching, or single-strand metallic accents to separate overlapping subjects, glass edges, outlines, and lettering.";
}

function threadRecommendation(skill, texture) {
  if (texture === "high") return "Keep the main image in cotton/wool/silk and reserve metallic, Silk Lamé, or specialty fibers for highlights. Too many specialty fibers can overwhelm a photo canvas.";
  return "Use the selected thread library for the full palette, then optionally substitute one or two accent colors with silk or metallic thread for highlights.";
}

function makeCard(title, body) {
  return { title, body };
}

function mergeCards(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const key = card.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderGuide(guide) {
  const detected = guide.detections.map((item) => `<span class="detected-pill">${escapeHtml(item.label)} ${Math.round(item.score * 100)}%</span>`).join("");
  const manual = guide.manualTags.map((tag) => `<span class="detected-pill">note: ${escapeHtml(titleCase(tag))}</span>`).join("");
  guideDom.output.innerHTML = `
    <div class="vision-status"><strong>Image recognition hints</strong><div class="detected-list">${detected || manual ? detected + manual : "<span class='detected-pill'>color analysis only</span>"}</div></div>
    ${guide.cards.map((card) => `<article class="guide-card"><strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(card.body)}</span></article>`).join("")}
  `;
}

function renderFinishedCanvas(image, guide) {
  const settings = getCanvasSettings();
  const gridW = Math.round(settings.width * settings.mesh);
  const gridH = Math.round(settings.height * settings.mesh);
  const source = document.createElement("canvas");
  source.width = gridW;
  source.height = gridH;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  sourceCtx.fillStyle = "#fffaf4";
  sourceCtx.fillRect(0, 0, gridW, gridH);
  const rect = computeImageDrawRect(image, gridW, gridH, settings.fitMode);
  sourceCtx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
  const pixels = sourceCtx.getImageData(0, 0, gridW, gridH).data;
  const cell = Math.max(4, Math.min(8, Math.floor(900 / Math.max(gridW, gridH))));
  const canvas = guideDom.renderCanvas;
  const pad = 32;
  canvas.width = gridW * cell + pad * 2;
  canvas.height = gridH * cell + pad * 2;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f2e7d8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffaf4";
  ctx.fillRect(pad - 10, pad - 10, gridW * cell + 20, gridH * cell + 20);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const i = (y * gridW + x) * 4;
      const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
      const px = pad + x * cell;
      const py = pad + y * cell;
      drawStitch(ctx, px, py, cell, rgb, chooseRenderStitch(rgb, guide));
    }
  }
  ctx.strokeStyle = "rgba(38,31,26,.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad - 10, pad - 10, gridW * cell + 20, gridH * cell + 20);
}

function drawStitch(ctx, x, y, size, rgb, stitchType) {
  const base = `rgb(${rgb.map((v) => Math.round(v)).join(",")})`;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, size, size);
  const light = rgb.map((v) => Math.min(255, v + 35));
  const dark = rgb.map((v) => Math.max(0, v - 40));
  ctx.lineWidth = Math.max(1, size * 0.22);
  ctx.lineCap = "round";
  if (stitchType === "mosaic") {
    ctx.strokeStyle = `rgb(${light.join(",")})`;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.15, y + size * 0.85);
    ctx.lineTo(x + size * 0.85, y + size * 0.15);
    ctx.stroke();
    ctx.strokeStyle = `rgb(${dark.join(",")})`;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.1, y + size * 0.45);
    ctx.lineTo(x + size * 0.45, y + size * 0.1);
    ctx.stroke();
  } else if (stitchType === "vertical") {
    ctx.strokeStyle = `rgb(${light.join(",")})`;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, y + size * 0.12);
    ctx.lineTo(x + size * 0.5, y + size * 0.88);
    ctx.stroke();
  } else if (stitchType === "knot") {
    ctx.fillStyle = `rgb(${light.join(",")})`;
    ctx.beginPath();
    ctx.arc(x + size * 0.5, y + size * 0.5, Math.max(1.4, size * 0.33), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgb(${dark.join(",")})`;
    ctx.stroke();
  } else {
    ctx.strokeStyle = `rgb(${light.join(",")})`;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.1, y + size * 0.85);
    ctx.lineTo(x + size * 0.9, y + size * 0.15);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${dark.join(",")},.34)`;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.18, y + size * 0.95);
    ctx.lineTo(x + size * 0.98, y + size * 0.18);
    ctx.stroke();
  }
}

function chooseRenderStitch(rgb, guide) {
  const { h, s, v } = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  if (guide.texture === "high" && h > 75 && h < 155 && s > 0.18) return "mosaic";
  if (guide.texture === "high" && h > 18 && h < 55 && s > 0.2) return "vertical";
  if (guide.texture !== "low" && (h < 12 || h > 345) && s > 0.25) return "knot";
  return "basketweave";
}

function getCanvasSettings() {
  const preset = SIZE_PRESETS[guideDom.sizePreset.value];
  return {
    width: preset ? preset[0] : clamp(Number(guideDom.customWidth.value) || 8, 1, 24),
    height: preset ? preset[1] : clamp(Number(guideDom.customHeight.value) || 10, 1, 24),
    mesh: Number(guideDom.meshCount.value) || 18,
    fitMode: guideDom.fitMode.value || "crop"
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

function downloadGuideText() {
  if (!lastGuide) return;
  const lines = ["Suggested Stitch Guide", "", `Skill: ${titleCase(lastGuide.skill)}`, `Texture: ${titleCase(lastGuide.texture)}`, "", ...lastGuide.cards.map((card) => `${card.title}: ${card.body}`)];
  downloadBlob(new Blob([lines.join("\n")], { type: "text/plain" }), "sdneedle-stitch-guide.txt");
}

function downloadFinishedRender() {
  if (!lastGuide) return;
  guideDom.renderCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, "sdneedle-finished-stitch-render.png");
  }, "image/png");
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

function setGuideStatus(text) {
  guideDom.status.textContent = text;
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function titleCase(value) {
  return String(value).replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()).trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
