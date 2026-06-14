import { getPalette } from "./palettes.js";

const accentDom = {
  primary: document.querySelector("#threadType"),
  accents: document.querySelector("#accentThreadTypes"),
  swatches: document.querySelector("#swatchList"),
  guideOutput: document.querySelector("#stitchGuideOutput")
};

const ACCENT_ROLES = {
  pepper_pot_silk: { role: "Detail", use: "faces, lettering, ornaments, small details", picks: [18, 19, 20, 21, 37, 40] },
  vineyard_silk: { role: "Sheen", use: "luxury sheen, decorative areas, heirloom accents", picks: [1, 4, 19, 35, 41, 44] },
  silk_ivory: { role: "Soft texture", use: "clothing, animals, backgrounds, tactile coverage", picks: [2, 10, 18, 25, 30, 42] },
  planet_earth_wool: { role: "Wool coverage", use: "matte 13-mesh coverage and larger textured areas", picks: [3, 10, 14, 28, 33, 38] },
  splendor: { role: "Fine silk", use: "24-mesh detail, delicate color work, smooth shading", picks: [1, 18, 23, 31, 37, 43] },
  soie_dalger: { role: "Fine silk", use: "faces, lettering, fine detail, delicate shading", picks: [0, 18, 19, 36, 41, 45] },
  silk_lame_braid: { role: "Metallic", use: "sparkle, highlights, jewelry, stars, glass reflections", picks: [0, 1, 3, 4, 8, 12] },
  fyre_werks: { role: "Sparkle", use: "high shine, reflections, water/glass, ornaments", picks: [1, 3, 5, 9, 10, 12] },
  petite_very_velvet: { role: "Velvet", use: "fur, snow, pillows, plush raised texture", picks: [0, 2, 4, 6, 8, 12] },
  neon_rays_plus: { role: "Gloss", use: "florals, bows, glossy decorative stitches", picks: [18, 23, 27, 31, 41, 45] },
  rainbow_gallery: { role: "Specialty", use: "decorative fiber effects and texture accents", picks: [0, 20, 27, 34, 42, 45] },
  kreinik_metallic: { role: "Metallic", use: "metallic lines, outlining, shine, small highlight strokes", picks: [0, 1, 3, 5, 8, 10] },
  dmc_perle: { role: "Raised cotton", use: "decorative stitch definition and raised cotton texture", picks: [0, 10, 20, 30, 40, 50] }
};

let rendering = false;
let lastSignature = "";

initAccentSwatches();

function initAccentSwatches() {
  if (!accentDom.swatches || !accentDom.accents) return;
  accentDom.primary?.addEventListener("change", scheduleAccentSwatches);
  accentDom.accents.addEventListener("change", scheduleAccentSwatches);
  new MutationObserver(() => {
    if (rendering) return;
    scheduleAccentSwatches();
  }).observe(accentDom.swatches, { childList: true });
  scheduleAccentSwatches();
}

function scheduleAccentSwatches() {
  window.requestAnimationFrame(renderAccentSwatches);
}

function renderAccentSwatches() {
  if (!accentDom.swatches) return;
  const selected = getSelectedAccentThreads();
  const primary = getSelectedOptionLabel(accentDom.primary);
  const baseCount = accentDom.swatches.querySelectorAll(".swatch-row").length;
  const signature = JSON.stringify({ selected: selected.map((item) => item.value), primary, baseCount });
  if (signature === lastSignature && accentDom.swatches.querySelector("#accentSwatchSection")) return;
  lastSignature = signature;

  rendering = true;
  accentDom.swatches.querySelector("#accentSwatchSection")?.remove();
  accentDom.swatches.querySelector("#primarySwatchNote")?.remove();

  const note = document.createElement("div");
  note.id = "primarySwatchNote";
  note.className = "primary-swatch-note";
  note.textContent = `Primary chart swatches above use ${primary}. Accent selections below are texture/finish threads for substitutions or decorative areas, not full-chart color replacements.`;
  accentDom.swatches.appendChild(note);

  if (selected.length) {
    const section = document.createElement("section");
    section.id = "accentSwatchSection";
    section.className = "accent-swatch-section";
    section.innerHTML = `<div class="accent-swatch-heading"><strong>Texture / accent thread swatches</strong><span>These update from your selected accent threads. Use them where the stitch guide calls for sparkle, velvet, sheen, raised texture, or fine detail.</span></div>`;
    for (const item of selected) {
      getRepresentativeColors(item.value).forEach((color) => section.appendChild(createAccentRow(item, color)));
    }
    accentDom.swatches.appendChild(section);
  }

  rendering = false;
}

function createAccentRow(thread, color) {
  const role = ACCENT_ROLES[thread.value] || { role: "Accent", use: "texture-specific accent work" };
  const row = document.createElement("article");
  row.className = "accent-swatch-row";
  row.innerHTML = `
    <span class="accent-chip" style="background:${escapeHtml(color.hex)}" aria-hidden="true"></span>
    <div>
      <strong>${escapeHtml(thread.label)} ${escapeHtml(color.number)} — ${escapeHtml(color.name)}</strong>
      <small>${escapeHtml(color.hex.toUpperCase())} · ${escapeHtml(role.use)}</small>
    </div>
    <span class="accent-role-pill">${escapeHtml(role.role)}</span>
  `;
  return row;
}

function getRepresentativeColors(key) {
  try {
    const palette = getPalette(key);
    const colors = palette.colors || [];
    const role = ACCENT_ROLES[key];
    if (!colors.length) return [];
    const pickIndexes = role?.picks || [0, Math.floor(colors.length / 4), Math.floor(colors.length / 2), Math.floor(colors.length * 0.75), colors.length - 1];
    const seen = new Set();
    return pickIndexes
      .map((index) => colors[Math.max(0, Math.min(colors.length - 1, index))])
      .filter(Boolean)
      .filter((color) => {
        const key = `${color.number}-${color.hex}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  } catch (error) {
    console.warn("Accent palette unavailable", key, error);
    return [];
  }
}

function getSelectedAccentThreads() {
  return [...(accentDom.accents?.selectedOptions || [])].map((option) => ({ value: option.value, label: option.textContent.split("—")[0].trim() }));
}

function getSelectedOptionLabel(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || "selected primary thread";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
