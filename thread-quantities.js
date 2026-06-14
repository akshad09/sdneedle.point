const qtyDom = {
  swatches: document.querySelector('#swatchList'),
  mesh: document.querySelector('#meshCount'),
  sizePreset: document.querySelector('#sizePreset'),
  width: document.querySelector('#customWidth'),
  height: document.querySelector('#customHeight'),
  primary: document.querySelector('#threadType'),
  accents: document.querySelector('#accentThreadTypes'),
  guideOutput: document.querySelector('#stitchGuideOutput')
};

const SIZE_PRESETS_QTY = { '5x7': [5, 7], '8x10': [8, 10], '9x12': [9, 12], '11x14': [11, 14] };
const UNIT_YARDS = { dmc: 8.7, dmc_perle: 27, essentials: 10, vineyard_silk: 30, pepper_pot_silk: 30, planet_earth_silk: 30, planet_earth_wool: 28, silk_ivory: 28, appleton_wool: 27, waverly: 20, paternayan_wool: 8, splendor: 8, soie_dalger: 5, silk_lame_braid: 10, fyre_werks: 10, petite_very_velvet: 10, neon_rays_plus: 10, rainbow_gallery: 10, kreinik_metallic: 10 };
const ACCENT_PCT = { pepper_pot_silk: 0.06, vineyard_silk: 0.10, silk_ivory: 0.12, planet_earth_wool: 0.14, splendor: 0.06, soie_dalger: 0.06, silk_lame_braid: 0.035, fyre_werks: 0.035, petite_very_velvet: 0.08, neon_rays_plus: 0.055, rainbow_gallery: 0.055, kreinik_metallic: 0.03, dmc_perle: 0.08 };

let qtyBusy = false;
let lastQty = '';

initThreadQuantities();

function initThreadQuantities() {
  if (!qtyDom.swatches) return;
  [qtyDom.mesh, qtyDom.sizePreset, qtyDom.width, qtyDom.height, qtyDom.primary, qtyDom.accents].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', scheduleQuantityUpdate);
    el.addEventListener('change', scheduleQuantityUpdate);
  });
  new MutationObserver(function () {
    if (!qtyBusy) scheduleQuantityUpdate();
  }).observe(qtyDom.swatches, { childList: true, subtree: true });
  scheduleQuantityUpdate();
}

function scheduleQuantityUpdate() {
  window.requestAnimationFrame(updateThreadQuantities);
}

function updateThreadQuantities() {
  const rows = Array.from(qtyDom.swatches.querySelectorAll('.swatch-row'));
  const accents = selectedAccentValues();
  const sig = JSON.stringify({ rows: rows.length, mesh: qtyDom.mesh && qtyDom.mesh.value, primary: qtyDom.primary && qtyDom.primary.value, accents: accents });
  if (sig === lastQty) return;
  lastQty = sig;
  qtyBusy = true;
  rows.forEach(updatePrimaryRow);
  updateAccentRows();
  updateQuantitySummary();
  qtyBusy = false;
}

function updatePrimaryRow(row) {
  const small = row.querySelector('small');
  if (!small) return;
  const base = small.dataset.baseText || small.textContent.trim();
  small.dataset.baseText = base;
  const stitches = parseStitches(base);
  if (!stitches) return;
  const q = estimateThread(stitches, Number(qtyDom.mesh.value || 18), 'basketweave');
  small.textContent = stripEstimate(base) + ' - est. ' + fmt(q.yards) + ' yd / ' + Math.round(q.inches).toLocaleString() + ' in' + unitsText(q.yards, qtyDom.primary.value);
}

function updateAccentRows() {
  const selected = selectedAccentValues();
  Array.from(qtyDom.swatches.querySelectorAll('.accent-swatch-row')).forEach(function (row) {
    const small = row.querySelector('small');
    if (!small) return;
    const base = small.dataset.baseText || stripReserve(small.textContent.trim());
    small.dataset.baseText = base;
    const key = findAccentKey(row.textContent, selected);
    const q = estimateAccent(key);
    small.textContent = base + ' - reserve ' + fmt(q.yards) + ' yd / ' + Math.round(q.inches).toLocaleString() + ' in';
  });
}

function updateQuantitySummary() {
  const existing = document.querySelector('#threadQuantitySummary');
  if (existing) existing.remove();
  if (!qtyDom.guideOutput) return;
  const total = estimateThread(totalStitches(), Number(qtyDom.mesh.value || 18), 'basketweave');
  const selected = selectedAccentLabels();
  const accentHtml = selected.map(function (item) {
    const q = estimateAccent(item.value);
    return '<span>• ' + esc(item.label) + ' accent reserve: ' + fmt(q.yards) + ' yd / ' + Math.round(q.inches).toLocaleString() + ' in</span>';
  }).join('');
  const card = document.createElement('article');
  card.id = 'threadQuantitySummary';
  card.className = 'guide-card texture-plan-card';
  card.innerHTML = '<strong>Estimated thread to buy</strong><span>Full-canvas basketweave estimate for the primary chart: ' + fmt(total.yards) + ' yd / ' + Math.round(total.inches).toLocaleString() + ' in' + unitsText(total.yards, qtyDom.primary.value) + '. Buy extra for large single-color backgrounds and dye-lot matching.</span>' + (accentHtml ? '<div class="texture-plan-list">' + accentHtml + '</div>' : '');
  qtyDom.guideOutput.appendChild(card);
}

function estimateThread(stitches, mesh, stitch) {
  const front = Math.SQRT2 / Math.max(1, mesh || 18);
  const factors = { basketweave: 1.65, continental: 1.75, halfCross: 1.25, gobelin: 1.55, mosaic: 1.8, frenchKnot: 2.4, backstitch: 1.1 };
  const inches = stitches * front * (factors[stitch] || factors.basketweave) * 1.15;
  return { inches: inches, yards: inches / 36 };
}

function estimateAccent(key) {
  const pct = ACCENT_PCT[key] || 0.05;
  const stitch = key && (key.indexOf('metallic') >= 0 || key.indexOf('lame') >= 0 || key.indexOf('fyre') >= 0) ? 'backstitch' : key && key.indexOf('velvet') >= 0 ? 'frenchKnot' : 'mosaic';
  return estimateThread(totalStitches() * pct, Number(qtyDom.mesh.value || 18), stitch);
}

function totalStitches() {
  const preset = SIZE_PRESETS_QTY[qtyDom.sizePreset.value];
  const width = preset ? preset[0] : Number(qtyDom.width.value || 8);
  const height = preset ? preset[1] : Number(qtyDom.height.value || 10);
  const mesh = Number(qtyDom.mesh.value || 18);
  return Math.round(width * mesh) * Math.round(height * mesh);
}

function parseStitches(text) {
  const match = String(text).match(/([0-9,]+) stitches/i);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
}

function unitsText(yards, key) {
  const unit = UNIT_YARDS[key];
  if (!unit) return '';
  const count = Math.max(1, Math.ceil(yards / unit));
  return ' - buy about ' + count + ' unit' + (count === 1 ? '' : 's') + ' at about ' + unit + ' yd/unit';
}

function selectedAccentValues() {
  return Array.from(qtyDom.accents ? qtyDom.accents.selectedOptions : []).map(function (o) { return o.value; });
}

function selectedAccentLabels() {
  return Array.from(qtyDom.accents ? qtyDom.accents.selectedOptions : []).map(function (o) { return { value: o.value, label: o.textContent.split('—')[0].trim() }; });
}

function findAccentKey(text, selected) {
  const lower = String(text).toLowerCase();
  return selected.find(function (key) { return lower.indexOf(key.split('_')[0]) >= 0; }) || selected[0] || '';
}

function stripEstimate(text) { return String(text).replace(/ - est\..*$/i, ''); }
function stripReserve(text) { return String(text).replace(/ - reserve.*$/i, ''); }
function fmt(value) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 }); }
function esc(value) { return String(value).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
