const PROJECT_SAVE_KEY = 'sdneedle.point.autosave.v2';

ensureProjectFileStyles();

const projectDom = {
  panelMount: document.querySelector('#export-panel'),
  saveButton: document.querySelector('#saveProjectButton'),
  loadButton: document.querySelector('#loadSavedButton'),
  imageInput: document.querySelector('#imageInput'),
  sourcePreview: document.querySelector('#sourcePreview'),
  sizePreset: document.querySelector('#sizePreset'),
  customWidth: document.querySelector('#customWidth'),
  customHeight: document.querySelector('#customHeight'),
  mesh: document.querySelector('#meshCount'),
  primary: document.querySelector('#threadType'),
  accents: document.querySelector('#accentThreadTypes'),
  fit: document.querySelector('#fitMode'),
  detail: document.querySelector('#detailLevel'),
  maxColors: document.querySelector('#maxColors'),
  cleanup: document.querySelector('#cleanupThreshold'),
  dither: document.querySelector('#ditherToggle'),
  skill: document.querySelector('#stitchSkill'),
  texture: document.querySelector('#texturePreference'),
  notes: document.querySelector('#sceneNotes'),
  generateGuide: document.querySelector('#generateStitchGuideButton')
};

initProjectFiles();

function ensureProjectFileStyles() {
  if (document.querySelector('link[href$="project-files.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './project-files.css';
  document.head.appendChild(link);
}

function initProjectFiles() {
  injectProjectPanel();
  if (projectDom.saveButton) {
    projectDom.saveButton.textContent = 'Download project file';
    projectDom.saveButton.addEventListener('click', downloadProjectFile, true);
  }
}

function injectProjectPanel() {
  if (!projectDom.panelMount || document.querySelector('#projectFilePanel')) return;
  const section = document.createElement('section');
  section.id = 'projectFilePanel';
  section.className = 'project-file-panel';
  section.innerHTML = `
    <h3>Save / reopen project</h3>
    <p class="help-text">Download a project file so the image, mesh, thread choices, accent threads, notes, and layout can be reopened later on any computer.</p>
    <div class="project-file-actions">
      <button class="primary-project" id="downloadProjectFileButton" type="button">Download project file</button>
      <label class="project-import-label" for="importProjectFileInput">Open project file<input id="importProjectFileInput" type="file" accept=".sdneedle,.json,application/json" /></label>
    </div>
    <div class="project-file-status" id="projectFileStatus">Use Download Project File instead of relying on browser storage. Reopen the file here later to restore the same image and settings.</div>
  `;
  projectDom.panelMount.parentNode.insertBefore(section, projectDom.panelMount);
  document.querySelector('#downloadProjectFileButton')?.addEventListener('click', downloadProjectFile);
  document.querySelector('#importProjectFileInput')?.addEventListener('change', importProjectFile);
}

async function downloadProjectFile(event) {
  event?.preventDefault();
  event?.stopImmediatePropagation();
  const payload = await buildProjectPayload();
  if (!payload.imageDataUrl) {
    setProjectStatus('Upload an image before downloading a project file.');
    return;
  }
  const name = slug(payload.imageName || 'sdneedle-project') + '.sdneedle.json';
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), name);
  localStorage.setItem(PROJECT_SAVE_KEY, JSON.stringify(payload));
  setProjectStatus('Project file downloaded. You can reopen it later using Open project file.');
}

async function buildProjectPayload() {
  let imageDataUrl = '';
  let imageName = 'sdneedle-project';
  const stored = safeParse(localStorage.getItem(PROJECT_SAVE_KEY));
  if (stored?.imageDataUrl) {
    imageDataUrl = stored.imageDataUrl;
    imageName = stored.imageName || imageName;
  }
  if (projectDom.sourcePreview && !projectDom.sourcePreview.hidden && projectDom.sourcePreview.src) {
    imageDataUrl = projectDom.sourcePreview.src;
    imageName = stored?.imageName || imageName;
  }
  return { type: 'sdneedle.point.project', version: 2, savedAt: new Date().toISOString(), imageName, imageDataUrl, settings: readSettings(), stitchGuide: readGuideSettings() };
}

function readSettings() {
  return { sizePreset: value(projectDom.sizePreset, '8x10'), width: Number(value(projectDom.customWidth, 8)), height: Number(value(projectDom.customHeight, 10)), mesh: Number(value(projectDom.mesh, 18)), threadType: value(projectDom.primary, 'essentials'), accentThreadTypes: selectedValues(projectDom.accents), fitMode: value(projectDom.fit, 'crop'), detailLevel: value(projectDom.detail, 'portrait'), maxColors: Number(value(projectDom.maxColors, 36)), cleanupThreshold: Number(value(projectDom.cleanup, 6)), dither: Boolean(projectDom.dither?.checked) };
}

function readGuideSettings() {
  return { skill: value(projectDom.skill, 'confident'), texture: value(projectDom.texture, 'balanced'), notes: projectDom.notes?.value || '' };
}

async function importProjectFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload?.imageDataUrl || !payload?.settings) throw new Error('Invalid project file.');
    applySettings(payload.settings);
    applyGuideSettings(payload.stitchGuide || {});
    localStorage.setItem(PROJECT_SAVE_KEY, JSON.stringify({ settings: payload.settings, imageDataUrl: payload.imageDataUrl, imageName: payload.imageName || file.name.replace(/\.sdneedle\.json$|\.json$/i, ''), savedAt: payload.savedAt || new Date().toISOString() }));
    projectDom.loadButton?.click();
    window.setTimeout(() => { applySettings(payload.settings); applyGuideSettings(payload.stitchGuide || {}); projectDom.generateGuide?.click(); }, 1200);
    setProjectStatus('Project file opened. Image, layout, mesh, thread choices, and notes are being restored.');
  } catch (error) {
    console.error(error);
    setProjectStatus('Could not open that project file. Use a .sdneedle.json file downloaded from this site.');
  } finally {
    event.target.value = '';
  }
}

function applySettings(settings) {
  setValue(projectDom.sizePreset, settings.sizePreset || 'custom');
  setValue(projectDom.customWidth, settings.width || 8);
  setValue(projectDom.customHeight, settings.height || 10);
  setValue(projectDom.mesh, settings.mesh || 18);
  setValue(projectDom.primary, settings.threadType || 'essentials');
  setMultiValue(projectDom.accents, settings.accentThreadTypes || []);
  setValue(projectDom.fit, settings.fitMode || 'crop');
  setValue(projectDom.detail, settings.detailLevel || 'portrait');
  setValue(projectDom.maxColors, settings.maxColors || 36);
  setValue(projectDom.cleanup, settings.cleanupThreshold ?? 6);
  if (projectDom.dither) projectDom.dither.checked = Boolean(settings.dither);
  dispatchAll();
}

function applyGuideSettings(settings) {
  setValue(projectDom.skill, settings.skill || 'confident');
  setValue(projectDom.texture, settings.texture || 'balanced');
  if (projectDom.notes) projectDom.notes.value = settings.notes || '';
}

function dispatchAll() {
  [projectDom.sizePreset, projectDom.customWidth, projectDom.customHeight, projectDom.mesh, projectDom.primary, projectDom.accents, projectDom.fit, projectDom.detail, projectDom.maxColors, projectDom.cleanup, projectDom.dither].forEach((el) => { if (!el) return; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
}

function selectedValues(select) { return [...(select?.selectedOptions || [])].map((option) => option.value); }
function setMultiValue(select, values) { if (!select) return; const set = new Set(values || []); [...select.options].forEach((option) => { option.selected = set.has(option.value); }); }
function value(el, fallback) { return el?.value ?? fallback; }
function setValue(el, val) { if (el) el.value = String(val); }
function safeParse(text) { try { return text ? JSON.parse(text) : null; } catch { return null; } }
function slug(text) { return String(text || 'sdneedle-project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sdneedle-project'; }
function setProjectStatus(text) { const el = document.querySelector('#projectFileStatus'); if (el) el.textContent = text; }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
