const smartDom = {
  button: document.querySelector('#generateStitchGuideButton'),
  output: document.querySelector('#stitchGuideOutput'),
  status: document.querySelector('#visionStatus'),
  source: document.querySelector('#sourcePreview'),
  notes: document.querySelector('#sceneNotes'),
  skill: document.querySelector('#stitchSkill'),
  texture: document.querySelector('#texturePreference'),
  primary: document.querySelector('#threadType'),
  accents: document.querySelector('#accentThreadTypes'),
  render: document.querySelector('#finishedRenderCanvas'),
  downloadGuide: document.querySelector('#downloadStitchGuideButton'),
  downloadRender: document.querySelector('#downloadFinishedRenderButton'),
  sizePreset: document.querySelector('#sizePreset'),
  width: document.querySelector('#customWidth'),
  height: document.querySelector('#customHeight'),
  mesh: document.querySelector('#meshCount'),
  fit: document.querySelector('#fitMode')
};

const SIZE_PRESETS_SMART = { '5x7': [5, 7], '8x10': [8, 10], '9x12': [9, 12], '11x14': [11, 14] };
const HF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
let clipPipelinePromise = null;
let smartGuide = null;

const CANDIDATES = [
  ['martini', 'a martini glass'], ['cocktail', 'a cocktail or mixed drink'], ['tequila', 'a tequila glass or shot glass'],
  ['glassware', 'glassware with reflections'], ['rocket', 'a rocket ship'], ['music', 'music notes'], ['books', 'books'],
  ['pills', 'pills or medicine capsules'], ['flowers', 'flowers'], ['orangeTree', 'an orange tree'], ['crab', 'a crab'],
  ['stateMap', 'a map of a US state'], ['flightPath', 'a dotted airplane flight path'], ['coffee', 'a coffee cup'],
  ['phone', 'a cell phone'], ['portrait', 'a portrait of people'], ['pet', 'a dog or cat'], ['building', 'a building or house'],
  ['landscape', 'a landscape'], ['decorativeCanvas', 'a decorative illustrated needlepoint canvas'], ['food', 'food or dessert']
];

initSmartGuideV2();

function initSmartGuideV2() {
  if (!smartDom.button) return;
  smartDom.button.addEventListener('click', handleSmartGuideClick, true);
  smartDom.downloadGuide?.addEventListener('click', downloadSmartGuide, true);
  smartDom.downloadRender?.addEventListener('click', downloadSmartRender, true);
}

async function handleSmartGuideClick(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!smartDom.source || smartDom.source.hidden || !smartDom.source.src) {
    setSmartStatus('Upload an image first.');
    return;
  }
  setSmartStatus('Running smart recognition: motif prompts, image colors, texture, and manual notes...');
  const manual = extractManualTags(smartDom.notes?.value || '');
  const scene = analyzeImage(smartDom.source);
  const clip = await classifyMotifs(smartDom.source);
  const tags = fuseTags({ manual, scene, clip });
  smartGuide = buildPersonalGuide({ tags, manual, scene, clip });
  renderSmartGuide(smartGuide);
  renderSmartFinished(smartDom.source, smartGuide);
  if (smartDom.downloadGuide) smartDom.downloadGuide.disabled = false;
  if (smartDom.downloadRender) smartDom.downloadRender.disabled = false;
  const top = smartGuide.tags.slice(0, 6).map((t) => t.label).join(', ');
  setSmartStatus('Smart guide ready. Motifs used: ' + (top || 'color and composition only') + '.');
}

async function classifyMotifs(image) {
  try {
    const pipe = await getClipPipeline();
    const labels = CANDIDATES.map(([, label]) => label);
    const out = await pipe(image.src, labels);
    return normalizeClipOutput(out).slice(0, 8).map((item) => {
      const pair = CANDIDATES.find(([, label]) => label === item.label) || [];
      return { tag: pair[0] || item.label, label: item.label, score: item.score || 0 };
    });
  } catch (error) {
    console.warn('Smart CLIP unavailable; using local analysis only.', error);
    return [];
  }
}

async function getClipPipeline() {
  if (!clipPipelinePromise) {
    clipPipelinePromise = import(HF_URL).then(async ({ pipeline }) => pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', { dtype: 'q8' }));
  }
  return clipPipelinePromise;
}

function normalizeClipOutput(out) {
  const list = Array.isArray(out) ? out : [];
  return list.map((item) => ({ label: item.label, score: Number(item.score || 0) })).sort((a, b) => b.score - a.score);
}

function extractManualTags(text) {
  const lower = String(text).toLowerCase();
  const map = {
    martini: ['martini', 'olive'], cocktail: ['cocktail', 'drink', 'old fashioned'], tequila: ['tequila', 'shot glass', 'salt rim'],
    glassware: ['glass', 'cup'], rocket: ['rocket', 'nasa', 'space'], music: ['music', 'note', 'treble'], books: ['book'],
    pills: ['pill', 'medicine', 'capsule'], flowers: ['flower', 'floral', 'bouquet'], orangeTree: ['orange tree', 'oranges'],
    crab: ['crab'], stateMap: ['state', 'map', 'maryland', 'florida'], flightPath: ['flight', 'flight path', 'route', 'dotted line'],
    coffee: ['coffee'], phone: ['phone'], portrait: ['person', 'people', 'face', 'portrait'], pet: ['dog', 'cat', 'pet'],
    building: ['house', 'building'], landscape: ['landscape', 'sky', 'water'], food: ['food', 'dessert', 'pizza']
  };
  const tags = [];
  for (const [tag, words] of Object.entries(map)) if (words.some((w) => lower.includes(w))) tags.push({ tag, score: 1, source: 'manual', label: tag });
  return tags;
}

function analyzeImage(image) {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = Math.max(1, Math.round(120 * image.naturalHeight / image.naturalWidth));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = { dark: 0, light: 0, sky: 0, foliage: 0, skin: 0, warm: 0, red: 0, blue: 0, neutral: 0 };
  const hist = new Map();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 16) continue;
    total++;
    const hsv = rgbToHsv(r, g, b);
    if (hsv.v < 0.18) buckets.dark++;
    else if (hsv.s < 0.12 && hsv.v > 0.78) buckets.light++;
    else if (hsv.h > 185 && hsv.h < 225 && hsv.s > 0.16) buckets.sky++;
    else if (hsv.h > 75 && hsv.h < 155 && hsv.s > 0.18) buckets.foliage++;
    else if (hsv.h > 16 && hsv.h < 52 && hsv.s > 0.14 && hsv.v > 0.32) buckets.skin++;
    else if (hsv.h < 14 || hsv.h > 345) buckets.red++;
    else if (hsv.h > 205 && hsv.h < 265) buckets.blue++;
    else if (hsv.h > 25 && hsv.h < 72 && hsv.s > 0.16) buckets.warm++;
    else buckets.neutral++;
    const key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  const pct = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, total ? v / total : 0]));
  const style = inferStyle({ hist, total, pct });
  return { pct, style, dominant: dominantFamilies(pct) };
}

function inferStyle({ hist, total, pct }) {
  const uniqueRatio = total ? hist.size / total : 0;
  if (uniqueRatio < 0.12 && (pct.light + pct.warm + pct.red + pct.foliage > 0.45)) return 'illustrated painted-canvas style';
  if (pct.skin > 0.08) return 'portrait/photo canvas style';
  if (pct.sky + pct.foliage > 0.25) return 'landscape/travel canvas style';
  if (pct.dark > 0.25) return 'high-contrast graphic canvas style';
  return 'decorative illustrated canvas style';
}

function dominantFamilies(pct) {
  return Object.entries(pct).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
}

function fuseTags({ manual, scene, clip }) {
  const map = new Map();
  const add = (tag, score, source, label) => {
    if (!tag) return;
    const current = map.get(tag) || { tag, score: 0, sources: [], label: titleCase(tag) };
    current.score = Math.max(current.score, score);
    current.sources.push(source);
    current.label = label || current.label;
    map.set(tag, current);
  };
  manual.forEach((m) => add(m.tag, 1, 'manual', titleCase(m.tag)));
  clip.forEach((c) => { if (c.score > 0.09) add(c.tag, c.score, 'smart AI', cleanCandidateLabel(c.label)); });
  if (scene.pct.skin > 0.06) add('portrait', 0.55, 'color analysis', 'portrait / skin areas');
  if (scene.pct.foliage > 0.07) add('foliage', 0.45, 'color analysis', 'greenery / foliage');
  if (scene.pct.sky > 0.08) add('background', 0.45, 'color analysis', 'sky / background');
  if (scene.pct.dark > 0.14) add('darkArea', 0.42, 'color analysis', 'dark contrast areas');
  if (scene.pct.warm > 0.12) add('warmArea', 0.42, 'color analysis', 'warm tan / gold areas');
  add('background', 0.25, 'default', 'background');
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 9);
}

function cleanCandidateLabel(label) { return String(label).replace(/^a |^an /i, ''); }

function buildPersonalGuide({ tags, manual, scene, clip }) {
  const skill = smartDom.skill?.value || 'confident';
  const texture = smartDom.texture?.value || 'balanced';
  const primary = smartDom.primary?.selectedOptions?.[0]?.textContent?.trim() || 'selected primary thread';
  const accents = [...(smartDom.accents?.selectedOptions || [])].map((o) => o.textContent.split('—')[0].trim());
  const cards = [];
  cards.push(card('Design style', designStyleText(scene, tags, primary, accents)));
  cards.push(card('Color story', colorStoryText(scene, primary, accents)));
  for (const item of tags) cards.push(recommendTag(item.tag, skill, texture, primary, accents));
  cards.push(card('Personalized finishing plan', finishingPlan(skill, texture, accents)));
  cards.push(card('Thread strategy', threadStrategy(primary, accents)));
  return { tags, manual, scene, clip, cards: mergeCards(cards), primary, accents, skill, texture };
}

function designStyleText(scene, tags, primary, accents) {
  const motif = tags.filter((t) => !['background', 'darkArea', 'warmArea'].includes(t.tag)).map((t) => t.label).slice(0, 4).join(', ');
  return 'Recommended style: ' + scene.style + '. Main motifs: ' + (motif || 'dominant subject and background') + '. Use ' + primary + ' for coverage; use accent fibers only for texture, sparkle, or focal details.';
}

function colorStoryText(scene, primary, accents) {
  const family = scene.dominant.map(titleCase).join(', ');
  return 'Dominant color families detected: ' + family + '. Keep broad color areas calm, preserve high contrast outlines, and reserve accent threads (' + (accents.join(', ') || 'none selected') + ') for the brightest highlights or tactile details.';
}

function recommendTag(tag, skill, texture, primary, accents) {
  const high = texture === 'high';
  const advanced = skill === 'advanced';
  const hasMetallic = accents.some((a) => /lame|fyre|kreinik|metallic/i.test(a));
  const hasVelvet = accents.some((a) => /velvet/i.test(a));
  const map = {
    martini: ['Martini glass', 'Skip Tent or T-Stitch for transparent glass; backstitch rim/stem; Smyrna Cross or French knots for olives. ' + (hasMetallic ? 'Use metallic only for rim highlights.' : '')],
    cocktail: ['Cocktail / drink', 'Cashmere or Scotch stitches for ice, skip tent for glass, backstitch edges, and a few metallic/silk highlights for reflections.'],
    tequila: ['Tequila / shot glass', 'Tent or skip tent for glass; French-knot salt rim; backstitch the glass edge. Keep liquid color simple.'],
    glassware: ['Glassware', 'Use open/skip tent for transparency, backstitch rim lines, and Cashmere blocks for ice/reflections.'],
    rocket: ['Rocket', 'Basketweave body; upright Gobelin flame; backstitch outline. ' + (hasMetallic ? 'Use metallic braid for flame/window highlights.' : 'Add one bright accent color for flame/window highlights.')],
    music: ['Music notes', 'Backstitch stems and outlines; Mosaic stitch for filled notes; keep symbols high contrast.'],
    books: ['Books', 'Basketweave covers, long-stitch or Gobelin spines, and backstitch title lines.'],
    pills: ['Pills', 'Upright Gobelin for capsule bodies, backstitch split lines, Smyrna Cross shine dots.'],
    flowers: ['Flowers', high ? 'French knots for centers, Lazy Daisy petals, Smyrna Cross accent flowers, basketweave leaves.' : 'Basketweave petals with French-knot centers and backstitched stems.'],
    orangeTree: ['Orange tree', 'Random Mosaic leaves, backstitch branches, and ' + (hasVelvet ? 'velvet or padded satin oranges for raised fruit.' : 'Smyrna Cross oranges for raised fruit.')],
    crab: ['Crab', 'Mosaic shell texture, backstitch claws, and small flag-color blocks if Maryland detailing is present.'],
    stateMap: ['State / map shapes', 'Basketweave fill, backstitch border, and tiny mosaic/continental blocks for internal flag or landmark details.'],
    flightPath: ['Flight path', 'Backstitch or couching along the route; use metallic only if the route should sparkle.'],
    coffee: ['Coffee cup', 'Basketweave cup, backstitch logo/edge, Cashmere sleeve, French-knot foam or highlight if needed.'],
    phone: ['Phone / screen', 'Basketweave dark screen, backstitch edges, small satin/Gobelin highlights for buttons or screen shine.'],
    portrait: ['Faces / skin / portrait areas', advanced ? 'Basketweave only over face and skin with subtle color changes. Put decorative stitches in clothing/background so facial detail is not distorted.' : 'Basketweave for skin and faces. Avoid heavy texture over eyes, lips, and noses.'],
    pet: ['Pet / animal', hasVelvet ? 'Basketweave face details; Petite Very Velvet or directional long stitch for fur texture.' : 'Basketweave body with short backstitch fur lines.'],
    foliage: ['Leaves / greenery', high ? 'Random Mosaic leaves with at least three greens; Smyrna Cross on focal leaves.' : 'Basketweave leaves with occasional Mosaic clusters.'],
    background: ['Background', advanced ? 'Basketweave base with optional Diagonal Mosaic or open darning in quiet background zones.' : 'Basketweave for stable, low-distortion background coverage.'],
    darkArea: ['Dark contrast areas', 'Use at least two dark shades so black/dark areas do not become flat. Basketweave base; backstitch edges only where needed.'],
    warmArea: ['Warm tan / gold areas', 'Cashmere or Diagonal Mosaic for wood/gold/tan texture; Basketweave if the area is visually busy.'],
    food: ['Food / dessert', 'Mosaic and Smyrna Cross for texture; French knots for seeds, toppings, or sparkle.'],
    decorativeCanvas: ['Decorative illustration', 'Use Basketweave for detailed icons, then assign specialty stitches by object: glass = skip tent, leaves = mosaic, dots = French knots, metallic = highlights.']
  };
  const [title, body] = map[tag] || [titleCase(tag), 'Basketweave base with backstitch outlines; add decorative stitches only where texture helps the subject.'];
  return card(title, body);
}

function finishingPlan(skill, texture, accents) {
  return 'Work detailed focal points first in Basketweave, then large background areas, then add decorative stitches and accent fibers last. Selected accents: ' + (accents.join(', ') || 'none') + '. Test every specialty fiber on the edge before committing.';
}

function threadStrategy(primary, accents) {
  return 'Primary coverage: ' + primary + '. Texture accents: ' + (accents.join(', ') || 'none selected') + '. Use the chart colors as the base shopping list, then substitute accent fibers only for the stitch-guide areas that benefit from texture or shine.';
}

function card(title, body) { return { title, body }; }
function mergeCards(cards) { const s = new Set(); return cards.filter((c) => { const k = c.title.toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); }

function renderSmartGuide(guide) {
  const hints = guide.tags.map((t) => '<span class="detected-pill">' + escapeHtml(t.label) + ' ' + Math.round(t.score * 100) + '%</span>').join('');
  smartDom.output.innerHTML = '<div class="vision-status"><strong>Smart image recognition hints</strong><div class="detected-list">' + (hints || '<span class="detected-pill">color/style analysis</span>') + '</div></div>' + guide.cards.map((c) => '<article class="guide-card"><strong>' + escapeHtml(c.title) + '</strong><span>' + escapeHtml(c.body) + '</span></article>').join('');
}

function renderSmartFinished(image, guide) {
  const set = getCanvasSettings();
  const gridW = Math.round(set.width * set.mesh), gridH = Math.round(set.height * set.mesh);
  const src = document.createElement('canvas');
  src.width = gridW; src.height = gridH;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.fillStyle = '#fffaf4'; sctx.fillRect(0, 0, gridW, gridH);
  const r = computeDraw(image, gridW, gridH, set.fit);
  sctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  const pix = sctx.getImageData(0, 0, gridW, gridH).data;
  const cell = Math.max(4, Math.min(8, Math.floor(920 / Math.max(gridW, gridH))));
  const pad = 32, canvas = smartDom.render;
  canvas.width = gridW * cell + pad * 2; canvas.height = gridH * cell + pad * 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2e7d8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
    const i = (y * gridW + x) * 4;
    const rgb = [pix[i], pix[i + 1], pix[i + 2]];
    drawTexturedStitch(ctx, pad + x * cell, pad + y * cell, cell, rgb, guide);
  }
  ctx.strokeStyle = 'rgba(38,31,26,.35)'; ctx.lineWidth = 2; ctx.strokeRect(pad - 10, pad - 10, gridW * cell + 20, gridH * cell + 20);
}

function drawTexturedStitch(ctx, x, y, size, rgb, guide) {
  ctx.fillStyle = 'rgb(' + rgb.map(Math.round).join(',') + ')'; ctx.fillRect(x, y, size, size);
  const hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  const light = rgb.map((v) => Math.min(255, v + 38));
  const dark = rgb.map((v) => Math.max(0, v - 42));
  ctx.lineWidth = Math.max(1, size * 0.22); ctx.lineCap = 'round';
  const mosaic = guide.texture === 'high' && ((hsv.h > 75 && hsv.h < 155) || (hsv.h > 20 && hsv.h < 70));
  const knot = guide.texture !== 'low' && (hsv.h < 12 || hsv.h > 345) && hsv.s > 0.22;
  if (knot) { ctx.fillStyle = 'rgb(' + light.join(',') + ')'; ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, Math.max(1.4, size * .33), 0, Math.PI * 2); ctx.fill(); return; }
  ctx.strokeStyle = 'rgb(' + light.join(',') + ')'; ctx.beginPath(); ctx.moveTo(x + size * .12, y + size * .85); ctx.lineTo(x + size * .88, y + size * .15); ctx.stroke();
  if (mosaic) { ctx.strokeStyle = 'rgb(' + dark.join(',') + ')'; ctx.beginPath(); ctx.moveTo(x + size * .1, y + size * .45); ctx.lineTo(x + size * .45, y + size * .1); ctx.stroke(); }
}

function getCanvasSettings() {
  const p = SIZE_PRESETS_SMART[smartDom.sizePreset?.value];
  return { width: p ? p[0] : Number(smartDom.width?.value || 8), height: p ? p[1] : Number(smartDom.height?.value || 10), mesh: Number(smartDom.mesh?.value || 18), fit: smartDom.fit?.value || 'crop' };
}
function computeDraw(img, w, h, fit) { const iw = img.naturalWidth, ih = img.naturalHeight, sr = iw / ih, tr = w / h; if (fit === 'contain') { const sc = Math.min(w / iw, h / ih), dw = iw * sc, dh = ih * sc; return { sx: 0, sy: 0, sw: iw, sh: ih, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh }; } if (sr > tr) { const sw = ih * tr; return { sx: (iw - sw) / 2, sy: 0, sw, sh: ih, dx: 0, dy: 0, dw: w, dh: h }; } const sh = iw / tr; return { sx: 0, sy: (ih - sh) / 2, sw: iw, sh, dx: 0, dy: 0, dw: w, dh: h }; }
function downloadSmartGuide(event) { if (!smartGuide) return; event?.preventDefault(); event?.stopImmediatePropagation(); const txt = ['Suggested Stitch Guide', '', ...smartGuide.cards.map((c) => c.title + ': ' + c.body)].join('\n'); downloadBlob(new Blob([txt], { type: 'text/plain' }), 'sdneedle-smart-stitch-guide.txt'); }
function downloadSmartRender(event) { if (!smartGuide) return; event?.preventDefault(); event?.stopImmediatePropagation(); smartDom.render.toBlob((b) => { if (b) downloadBlob(b, 'sdneedle-smart-finished-render.png'); }, 'image/png'); }
function downloadBlob(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
function setSmartStatus(t) { if (smartDom.status) smartDom.status.textContent = t; }
function rgbToHsv(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0; if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: max === 0 ? 0 : d / max, v: max }; }
function titleCase(v) { return String(v).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(); }
function escapeHtml(v) { return String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
