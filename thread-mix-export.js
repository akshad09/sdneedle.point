const mixDom = {
  primary: document.querySelector("#threadType"),
  accents: document.querySelector("#accentThreadTypes"),
  guideOutput: document.querySelector("#stitchGuideOutput"),
  guideButton: document.querySelector("#generateStitchGuideButton"),
  chartPdfButton: document.querySelector("#printPatternButton"),
  sourcePreview: document.querySelector("#sourcePreview"),
  chartCanvas: document.querySelector("#patternCanvas"),
  renderCanvas: document.querySelector("#finishedRenderCanvas")
};

initThreadMixExport();

function initThreadMixExport() {
  if (!mixDom.primary || !mixDom.accents || !mixDom.guideOutput) return;

  mixDom.primary.addEventListener("change", updateThreadPlanCard);
  mixDom.accents.addEventListener("change", updateThreadPlanCard);
  mixDom.guideButton?.addEventListener("click", () => waitForGuideThenUpdate());

  if (mixDom.chartPdfButton) {
    mixDom.chartPdfButton.textContent = "Download chart + stitch guide PDF";
    mixDom.chartPdfButton.addEventListener("click", handleProjectPdfClick, true);
  }

  updateThreadPlanCard();
}

async function waitForGuideThenUpdate() {
  const start = Date.now();
  while (Date.now() - start < 9000) {
    await wait(300);
    if (document.querySelector("#stitchGuideOutput .guide-card:not(#textureThreadPlanCard)")) break;
  }
  updateThreadPlanCard();
}

async function handleProjectPdfClick(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!mixDom.chartCanvas || !mixDom.chartCanvas.width) {
    toastProject("Upload an image first.");
    return;
  }

  await ensureGuideExists();
  updateThreadPlanCard();
  toastProject("Building chart + stitch guide PDF...");

  const pages = [
    drawProjectCoverPage(),
    drawChartPage(),
    ...drawLegendPages(),
    ...drawGuidePages(),
    drawFinishedRenderPage()
  ].filter(Boolean);

  const pdf = await buildPdf(pages.map((canvas) => ({ canvas, pageWidthPt: 612, pageHeightPt: 792 })));
  downloadBlob(pdf, "sdneedle-chart-stitch-guide.pdf");
}

async function ensureGuideExists() {
  if (document.querySelector("#stitchGuideOutput .guide-card:not(#textureThreadPlanCard)")) return;
  if (!mixDom.sourcePreview || mixDom.sourcePreview.hidden || !mixDom.sourcePreview.src) return;
  mixDom.guideButton?.click();
  const start = Date.now();
  while (Date.now() - start < 9000) {
    await wait(300);
    if (document.querySelector("#stitchGuideOutput .guide-card:not(#textureThreadPlanCard)")) return;
  }
}

function updateThreadPlanCard() {
  const primary = getSelectedOptionLabel(mixDom.primary);
  const accents = getSelectedOptions(mixDom.accents);
  const signature = JSON.stringify({ primary, accents: accents.map((item) => item.value) });
  const existing = document.querySelector("#textureThreadPlanCard");
  if (existing?.dataset.signature === signature) return;
  existing?.remove();

  const card = document.createElement("article");
  card.id = "textureThreadPlanCard";
  card.className = "guide-card texture-plan-card";
  card.dataset.signature = signature;
  const accentText = accents.length
    ? accents.map((item) => `<span>• ${escapeHtml(item.label)} — ${escapeHtml(textureUse(item.value))}</span>`).join("")
    : `<span>• No accent threads selected yet. Add metallics, velvet, silk, or ribbon-style threads for texture-specific areas.</span>`;

  card.innerHTML = `<strong>Thread mix / texture plan</strong><span>Primary coverage thread: ${escapeHtml(primary)}. Use it for the main color chart and broad stitching. Add selected accent threads only where their texture helps the subject.</span><div class="texture-plan-list">${accentText}</div>`;
  mixDom.guideOutput.appendChild(card);
}

function textureUse(value) {
  const uses = {
    pepper_pot_silk: "crisp faces, lettering, ornaments, small details",
    vineyard_silk: "luxury sheen on heirloom or decorative areas",
    silk_ivory: "soft clothing, animals, backgrounds, larger textured areas",
    planet_earth_wool: "13-mesh wool coverage and matte texture",
    splendor: "fine silk detail on 24 mesh",
    soie_dalger: "delicate fine silk shading and detail",
    silk_lame_braid: "metallic highlights, sparkle, stars, jewelry, glass reflections",
    fyre_werks: "high sparkle, reflections, water/glass shine, ornaments",
    petite_very_velvet: "fur, snow, plush, pillows, soft raised texture",
    neon_rays_plus: "florals, bows, decorative glossy stitches",
    rainbow_gallery: "specialty accents and decorative fiber effects",
    kreinik_metallic: "metallic outlining, shine, small highlight lines",
    essentials: "durable all-around background and main coverage",
    dmc: "general cotton color matching and accessible substitutions",
    dmc_perle: "raised cotton texture and decorative stitch definition",
    appleton_wool: "traditional tapestry wool texture",
    waverly: "needlepoint wool coverage and classic matte texture",
    paternayan_wool: "legacy Persian wool planning",
    planet_earth_silk: "silk sheen and smooth decorative areas"
  };
  return uses[value] || "texture-specific accent work";
}

function getSelectedOptionLabel(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || "Selected primary thread";
}

function getSelectedOptions(select) {
  return [...(select?.selectedOptions || [])].map((option) => ({ value: option.value, label: option.textContent.trim() }));
}

function drawProjectCoverPage() {
  const canvas = pageCanvas();
  const ctx = canvas.getContext("2d");
  drawPageBase(ctx, canvas, "sdneedle.point", "Needlepoint chart + stitch guide");
  const primary = getSelectedOptionLabel(mixDom.primary);
  const accents = getSelectedOptions(mixDom.accents).map((item) => item.label);
  drawWrapped(ctx, "This PDF combines the generated chart, color legend, stitch recommendations, thread mix plan, and finished stitched render preview.", 72, 210, 1500, 38, "30px Arial");
  drawWrapped(ctx, `Primary thread: ${primary}`, 72, 340, 1500, 34, "28px Arial");
  drawWrapped(ctx, `Accent / texture threads: ${accents.length ? accents.join(", ") : "none selected"}`, 72, 395, 1500, 34, "28px Arial");
  drawWrapped(ctx, "Use the primary thread for the chart. Use accent threads selectively for texture: metallics for shine, velvet for plush/fur/snow, silk for sheen/detail, and wool/silk blends for tactile coverage.", 72, 500, 1500, 36, "28px Arial");
  return canvas;
}

function drawChartPage() {
  const canvas = pageCanvas();
  const ctx = canvas.getContext("2d");
  drawPageBase(ctx, canvas, "Chart", "Current preview with grid, colors, and symbols");
  if (!mixDom.chartCanvas || !mixDom.chartCanvas.width) return canvas;
  const box = fitBox(mixDom.chartCanvas.width, mixDom.chartCanvas.height, 1500, 1880);
  ctx.drawImage(mixDom.chartCanvas, (canvas.width - box.width) / 2, 205, box.width, box.height);
  return canvas;
}

function drawLegendPages() {
  const rows = [...document.querySelectorAll("#swatchList .swatch-row")].map((row) => ({
    color: row.querySelector(".swatch-chip")?.style.background || "#ffffff",
    main: row.querySelector("strong")?.textContent?.trim() || "Thread",
    detail: row.querySelector("small")?.textContent?.trim() || "",
    symbol: row.querySelector(".symbol-pill")?.textContent?.trim() || ""
  }));
  if (!rows.length) return [];

  const pages = [];
  const perPage = 34;
  for (let start = 0; start < rows.length; start += perPage) {
    const canvas = pageCanvas();
    const ctx = canvas.getContext("2d");
    drawPageBase(ctx, canvas, "Thread legend", `${rows.length} mapped colors`);
    rows.slice(start, start + perPage).forEach((row, index) => {
      const col = index % 2;
      const line = Math.floor(index / 2);
      const x = 72 + col * 760;
      const y = 215 + line * 96;
      ctx.fillStyle = row.color;
      ctx.fillRect(x, y, 56, 56);
      ctx.strokeStyle = "#222";
      ctx.strokeRect(x, y, 56, 56);
      ctx.fillStyle = "#111";
      ctx.font = "700 27px Arial";
      ctx.fillText(`${row.symbol} ${row.main}`, x + 75, y + 24);
      ctx.font = "23px Arial";
      drawWrapped(ctx, row.detail, x + 75, y + 55, 620, 26, "23px Arial", 2);
    });
    pages.push(canvas);
  }
  return pages;
}

function drawGuidePages() {
  const cards = [...document.querySelectorAll("#stitchGuideOutput .guide-card")].map((card) => ({
    title: card.querySelector("strong")?.textContent?.trim() || "Guide",
    body: card.textContent.replace(card.querySelector("strong")?.textContent || "", "").trim().replace(/\s+/g, " ")
  }));
  if (!cards.length) cards.push({ title: "Suggested stitch guide", body: "Generate a guide in the website before exporting to include object-specific stitch recommendations." });

  const pages = [];
  let canvas = pageCanvas();
  let ctx = canvas.getContext("2d");
  drawPageBase(ctx, canvas, "Suggested stitch guide", "Object-aware recommendations and texture plan");
  let y = 210;

  for (const card of cards) {
    const needed = estimateTextHeight(`${card.title}. ${card.body}`, 1350, 29) + 85;
    if (y + needed > 2070) {
      pages.push(canvas);
      canvas = pageCanvas();
      ctx = canvas.getContext("2d");
      drawPageBase(ctx, canvas, "Suggested stitch guide", "continued");
      y = 210;
    }
    ctx.fillStyle = "#7c3441";
    ctx.font = "700 32px Arial";
    ctx.fillText(card.title, 72, y);
    ctx.fillStyle = "#241c17";
    y = drawWrapped(ctx, card.body, 72, y + 42, 1450, 34, "28px Arial") + 32;
  }
  pages.push(canvas);
  return pages;
}

function drawFinishedRenderPage() {
  if (!mixDom.renderCanvas || !mixDom.renderCanvas.width || !mixDom.renderCanvas.height) return null;
  const canvas = pageCanvas();
  const ctx = canvas.getContext("2d");
  drawPageBase(ctx, canvas, "Finished stitched render", "Approximate texture simulation for planning");
  const box = fitBox(mixDom.renderCanvas.width, mixDom.renderCanvas.height, 1400, 1840);
  ctx.drawImage(mixDom.renderCanvas, (canvas.width - box.width) / 2, 210, box.width, box.height);
  return canvas;
}

function pageCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1700;
  canvas.height = 2200;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawPageBase(ctx, canvas, title, subtitle) {
  ctx.fillStyle = "#fffaf4";
  ctx.fillRect(0, 0, canvas.width, 160);
  ctx.fillStyle = "#261f1a";
  ctx.font = "700 58px Arial";
  ctx.fillText(title, 72, 86);
  ctx.font = "28px Arial";
  ctx.fillStyle = "#685a4d";
  ctx.fillText(subtitle, 72, 128);
  ctx.strokeStyle = "#d7c7b6";
  ctx.beginPath();
  ctx.moveTo(72, 160);
  ctx.lineTo(canvas.width - 72, 160);
  ctx.stroke();
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, font, maxLines = Infinity) {
  ctx.font = font;
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines++;
      line = word;
      if (lines >= maxLines) return y;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function estimateTextHeight(text, maxWidth, lineHeight) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = "28px Arial";
  let lines = 1;
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines++;
      line = word;
    } else line = test;
  }
  return lines * lineHeight;
}

async function buildPdf(pages) {
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
    add("\nendobj\n");
  };
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const prepared = [];
  for (const page of pages) prepared.push({ ...page, image: await canvasToJpegBytes(page.canvas, 0.91) });
  const totalObjects = 2 + prepared.length * 3;
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Kids [${prepared.map((_, index) => `${3 + index * 3} 0 R`).join(" ")}] /Count ${prepared.length} >>`]);
  prepared.forEach((page, index) => {
    const pageObj = 3 + index * 3;
    const contentObj = pageObj + 1;
    const imageObj = pageObj + 2;
    const pageW = page.pageWidthPt || 612;
    const pageH = page.pageHeightPt || 792;
    const fit = fitBox(page.image.width, page.image.height, pageW, pageH);
    const x = (pageW - fit.width) / 2;
    const y = (pageH - fit.height) / 2;
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

function toastProject(message) {
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
