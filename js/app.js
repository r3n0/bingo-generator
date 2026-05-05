/**
 * app.js — Main application entry point
 *
 * Orchestrates: image management, UI updates, card generation, PDF export.
 */

import { saveImage, deleteImage, loadAllImages, clearAllImages } from './db.js';
import { buildPool, generateCards }                              from './bingo.js';
import { exportToPDF }                                           from './pdf.js';

// ============================================================
// STATE
// ============================================================
const state = {
  /** @type {Array<{id:string, dataUrl:string, order:number}>} */
  images: [],
  /** @type {Array<Array>|null} Last generated card set */
  lastCards: null,
};

// ============================================================
// DOM REFS
// ============================================================
const imageGrid       = document.getElementById('image-grid');
const btnClearImages  = document.getElementById('btn-clear-images');
const btnPreview      = document.getElementById('btn-preview');
const btnExport       = document.getElementById('btn-export');
const btnClosePreview = document.getElementById('btn-close-preview');
const previewSection  = document.getElementById('preview-section');
const previewGrid     = document.getElementById('cards-preview-grid');
const previewCount    = document.getElementById('preview-count');
const loadingModal    = document.getElementById('loading-modal');
const loadingDesc     = document.getElementById('loading-desc');
const progressBar     = document.getElementById('progress-bar');
const validationMsg   = document.getElementById('validation-msg');
const toastEl         = document.getElementById('toast');

const inputTitle      = document.getElementById('card-title');
const inputRange      = document.getElementById('number-range');
const inputWords      = document.getElementById('words-input');
const inputCardCount  = document.getElementById('card-count');
const toggleFreeSpace = document.getElementById('free-space-toggle');
const freeSpaceLabel  = document.getElementById('free-space-label');
const wordsCount      = document.getElementById('words-count');

const statImages  = document.getElementById('stat-images');
const statNumbers = document.getElementById('stat-numbers');
const statWords   = document.getElementById('stat-words');
const statTotal   = document.getElementById('stat-total');

// ============================================================
// TOAST
// ============================================================
let toastTimeout;
function showToast(msg, type = 'info', duration = 3500) {
  clearTimeout(toastTimeout);
  toastEl.textContent = msg;
  toastEl.className   = `toast ${type} visible`;
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, duration);
}

// ============================================================
// VALIDATION MESSAGE
// ============================================================
function showValidation(msg, type = 'info') {
  validationMsg.textContent = msg;
  validationMsg.className   = `validation-msg ${type}`;
  validationMsg.style.display = 'block';
}

function clearValidation() {
  validationMsg.style.display = 'none';
}

// ============================================================
// STATS UPDATE
// ============================================================
function updateStats() {
  const numRange  = parseInt(inputRange.value, 10) || 0;
  const wordsRaw  = inputWords.value;
  const wordList  = wordsRaw.split(',').map(w => w.trim()).filter(Boolean);

  statImages.textContent  = state.images.length;
  statNumbers.textContent = numRange > 0 ? numRange : 0;
  statWords.textContent   = wordList.length;
  statTotal.textContent   = state.images.length + (numRange > 0 ? numRange : 0) + wordList.length;

  // Update words hint
  wordsCount.textContent = `${wordList.length} palabra${wordList.length !== 1 ? 's' : ''}`;
}

// ============================================================
// IMAGE GRID RENDERING
// ============================================================

/** Generate a unique image ID */
function generateId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Render the entire image grid from state.images */
function renderImageGrid() {
  imageGrid.innerHTML = '';

  // Filled slots
  state.images.forEach((imgRecord, idx) => {
    const slot = createFilledSlot(imgRecord, idx + 1);
    imageGrid.appendChild(slot);
  });

  // One empty "add" slot at the end
  imageGrid.appendChild(createEmptySlot());

  // Show/hide clear button
  btnClearImages.style.display = state.images.length > 0 ? 'flex' : 'none';

  updateStats();
}

/** Create a filled image slot element */
function createFilledSlot(imgRecord, idx) {
  const slot = document.createElement('div');
  slot.className = 'image-slot filled';
  slot.dataset.id = imgRecord.id;
  slot.title = `Imagen ${idx} — haz clic para eliminar`;

  const img = document.createElement('img');
  img.src = imgRecord.dataUrl;
  img.alt = `Imagen ${idx}`;
  img.loading = 'lazy';

  const deleteOverlay = document.createElement('div');
  deleteOverlay.className = 'slot-delete';
  deleteOverlay.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>`;

  const badge = document.createElement('span');
  badge.className = 'slot-index';
  badge.textContent = idx;

  slot.appendChild(img);
  slot.appendChild(deleteOverlay);
  slot.appendChild(badge);

  slot.addEventListener('click', () => handleDeleteImage(imgRecord.id));

  // Animate in
  slot.style.opacity = '0';
  slot.style.transform = 'scale(0.8)';
  requestAnimationFrame(() => {
    slot.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    slot.style.opacity = '1';
    slot.style.transform = 'scale(1)';
  });

  return slot;
}

/** Create the empty "add new" slot */
function createEmptySlot() {
  const slot  = document.createElement('div');
  slot.className = 'image-slot empty';
  slot.id = 'add-image-slot';
  slot.title = 'Haz clic para subir una imagen';
  slot.setAttribute('role', 'button');
  slot.setAttribute('tabindex', '0');
  slot.setAttribute('aria-label', 'Agregar imagen');

  slot.innerHTML = `
    <span class="slot-icon">+</span>
    <span class="slot-label">Agregar<br>imagen</span>
    <input type="file" class="slot-input" accept="image/*" multiple id="file-upload-input" />
  `;

  const fileInput = slot.querySelector('.slot-input');

  slot.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });

  slot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

  // Drag & Drop support
  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    handleFileSelect(e.dataTransfer.files);
  });

  return slot;
}

// ============================================================
// IMAGE HANDLING
// ============================================================

/** Convert a File to a base64 data URL */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsDataURL(file);
  });
}

/** Handle one or more selected files */
async function handleFileSelect(files) {
  if (!files || files.length === 0) return;
  const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (fileArr.length === 0) {
    showToast('Solo se aceptan archivos de imagen (JPG, PNG, GIF, WebP, etc.)', 'error');
    return;
  }

  for (const file of fileArr) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const record  = {
        id:      generateId(),
        dataUrl,
        order:   state.images.length,
      };
      await saveImage(record);
      state.images.push(record);
    } catch (err) {
      console.error('Error saving image:', err);
      showToast(`Error al guardar imagen: ${file.name}`, 'error');
    }
  }

  renderImageGrid();
  showToast(`${fileArr.length} imagen${fileArr.length > 1 ? 'es' : ''} agregada${fileArr.length > 1 ? 's' : ''}`, 'success');
  clearValidation();
}

/** Delete an image by ID */
async function handleDeleteImage(id) {
  try {
    await deleteImage(id);
    state.images = state.images.filter(img => img.id !== id);
    // Re-index orders
    state.images.forEach((img, i) => { img.order = i; });
    renderImageGrid();
    showToast('Imagen eliminada', 'info');
    // Invalidate cached cards
    state.lastCards = null;
  } catch (err) {
    console.error('Error deleting image:', err);
    showToast('Error al eliminar la imagen', 'error');
  }
}

/** Clear all images */
async function handleClearImages() {
  if (!confirm('¿Eliminar todas las imágenes? Esta acción no se puede deshacer.')) return;
  try {
    await clearAllImages();
    state.images = [];
    renderImageGrid();
    state.lastCards = null;
    showToast('Galería limpiada', 'info');
  } catch (err) {
    console.error('Error clearing images:', err);
    showToast('Error al limpiar la galería', 'error');
  }
}

// ============================================================
// CARD GENERATION
// ============================================================

/** Build pool & generate cards from current UI state */
function generateCardSet() {
  clearValidation();

  const pool = buildPool(
    state.images,
    inputRange.value,
    inputWords.value
  );

  const count      = Math.max(1, Math.min(200, parseInt(inputCardCount.value, 10) || 10));
  const freeSpace  = toggleFreeSpace.checked;

  const { cards, error } = generateCards(pool, count, freeSpace);

  if (error) {
    showValidation(error, cards.length > 0 ? 'info' : 'error');
    if (cards.length === 0) return null;
    showToast(`Generadas ${cards.length} tarjetas (menos de las solicitadas)`, 'info');
  }

  state.lastCards = cards;
  return cards;
}

// ============================================================
// PREVIEW RENDERING
// ============================================================

/** Render a single cell element */
function renderCell(cell) {
  const div = document.createElement('div');
  div.className = 'card-cell';

  if (cell === null) {
    div.classList.add('free-space');
    div.innerHTML = '★';
    div.title = 'Espacio libre';
    return div;
  }

  if (cell.type === 'number') {
    const span = document.createElement('span');
    span.className = 'cell-number';
    span.textContent = cell.value;
    div.appendChild(span);
  } else if (cell.type === 'word') {
    const span = document.createElement('span');
    span.className = 'cell-word';
    span.textContent = cell.value;
    div.appendChild(span);
  } else if (cell.type === 'image') {
    const img = document.createElement('img');
    img.src = cell.value;
    img.alt = 'Imagen de bingo';
    img.loading = 'lazy';
    div.appendChild(img);
  }

  return div;
}

/** Render a full bingo card element */
function renderCardEl(grid, cardIndex) {
  const title = inputTitle.value.trim() || '¡BINGO!';

  const card = document.createElement('div');
  card.className = 'bingo-card';
  card.style.animationDelay = `${(cardIndex - 1) * 0.05}s`;

  // Header
  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="card-title-text">${escapeHtml(title)}</span>
    <span class="card-number-badge">#${cardIndex}</span>
  `;
  card.appendChild(header);

  // BINGO column labels
  const bingoRow = document.createElement('div');
  bingoRow.className = 'bingo-header-row';
  for (const letter of ['B', 'I', 'N', 'G', 'O']) {
    const cell = document.createElement('div');
    cell.className = 'bingo-header-cell';
    cell.textContent = letter;
    bingoRow.appendChild(cell);
  }
  card.appendChild(bingoRow);

  // Grid
  const grid5x5 = document.createElement('div');
  grid5x5.className = 'card-grid';
  for (const cellData of grid) {
    grid5x5.appendChild(renderCell(cellData));
  }
  card.appendChild(grid5x5);

  return card;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Show preview section with generated cards */
function showPreview(cards) {
  previewGrid.innerHTML = '';

  cards.forEach((grid, i) => {
    const el = renderCardEl(grid, i + 1);
    previewGrid.appendChild(el);
  });

  previewCount.textContent = cards.length;
  previewSection.style.display = 'block';

  // Smooth scroll to preview
  setTimeout(() => {
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ============================================================
// EXPORT
// ============================================================

async function handleExport() {
  const cards = state.lastCards || generateCardSet();
  if (!cards || cards.length === 0) {
    showToast('No hay tarjetas para exportar. Revisa los datos ingresados.', 'error');
    return;
  }

  const title = inputTitle.value.trim() || '¡BINGO!';

  loadingModal.style.display = 'flex';
  progressBar.style.width = '0%';
  loadingDesc.textContent = `Preparando ${cards.length} tarjetas...`;

  try {
    await exportToPDF(cards, title, (progress) => {
      progressBar.style.width = `${progress}%`;
      loadingDesc.textContent = `Renderizando tarjeta ${Math.ceil(progress / 100 * cards.length)} de ${cards.length}...`;
    });
    showToast(`PDF exportado con ${cards.length} tarjetas ✓`, 'success', 5000);
  } catch (err) {
    console.error('PDF export error:', err);
    showToast('Error al generar el PDF. Revisa la consola.', 'error');
  } finally {
    loadingModal.style.display = 'none';
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function attachListeners() {
  // Image management
  btnClearImages.addEventListener('click', handleClearImages);

  // Preview
  btnPreview.addEventListener('click', () => {
    const cards = generateCardSet();
    if (cards && cards.length > 0) {
      showPreview(cards);
    } else if (!cards) {
      showToast('No se pudieron generar tarjetas. Verifica que el pool tenga suficientes elementos.', 'error');
    }
  });

  // Close preview
  btnClosePreview.addEventListener('click', () => {
    previewSection.style.display = 'none';
    state.lastCards = null;
  });

  // Export
  btnExport.addEventListener('click', handleExport);

  // Live stats update
  inputRange.addEventListener('input', () => {
    updateStats();
    state.lastCards = null;
  });

  inputWords.addEventListener('input', () => {
    updateStats();
    state.lastCards = null;
  });

  inputCardCount.addEventListener('input', () => {
    state.lastCards = null;
  });

  inputTitle.addEventListener('input', () => {
    // If preview is open, update card titles in real time
    document.querySelectorAll('.card-title-text').forEach(el => {
      el.textContent = inputTitle.value.trim() || '¡BINGO!';
    });
  });

  toggleFreeSpace.addEventListener('change', () => {
    freeSpaceLabel.textContent = toggleFreeSpace.checked ? 'Activado' : 'Desactivado';
    state.lastCards = null;
  });
}

// ============================================================
// INIT
// ============================================================

async function init() {
  // Load persisted images from IndexedDB
  try {
    const saved = await loadAllImages();
    state.images = saved;
  } catch (err) {
    console.warn('Could not load images from DB:', err);
    state.images = [];
  }

  renderImageGrid();
  attachListeners();
  updateStats();

  console.log('%c🎱 Bingo Generator Pro loaded!', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');
}

init();
